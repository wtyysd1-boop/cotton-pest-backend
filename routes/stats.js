const express = require('express');
const router = express.Router();
const PestReport = require('../models/PestReport');
const Area = require('../models/Area');

/**
 * GET /api/stats/region/:areaId?range=1d|3d|7d
 * 返回该区域指定时间窗口内的聚合统计
 *
 * 全部使用 MongoDB 聚合管道（Aggregate），不手动过滤数据
 */
router.get('/region/:areaId', async (req, res, next) => {
  try {
    const { areaId } = req.params;
    const range = req.query.range || '1d';

    // 计算时间窗口起点
    const rangeMap = { '1d': 1, '3d': 3, '7d': 7 };
    const days = rangeMap[range] || 1;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // $match 阶段：按区域和时间范围过滤
    const matchStage = { timestamp: { $gte: since } };
    if (areaId !== 'all') {
      matchStage.areaId = parseInt(areaId, 10);
    }

    const pipeline = [
      { $match: matchStage },

      // 基础统计
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          infested: { $sum: { $cond: ['$pestInfo.isInfested', 1, 0] } },
          avgTemperature: { $avg: '$weather.temperature' },
          avgHumidity: { $avg: '$weather.humidity' }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          infested: 1,
          rate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$infested', '$total'] }, 100] },
              0
            ]
          },
          avgTemperature: { $round: ['$avgTemperature', 1] },
          avgHumidity: { $round: ['$avgHumidity', 0] }
        }
      }
    ];

    const baseStats = await PestReport.aggregate(pipeline);
    const base = baseStats[0] || { total: 0, infested: 0, rate: 0, avgTemperature: null, avgHumidity: null };

    // 虫害类型分布
    const speciesPipeline = [
      { $match: { ...matchStage, 'pestInfo.isInfested': true } },
      { $group: { _id: '$pestInfo.species', count: { $sum: 1 } } },
      { $project: { _id: 0, species: '$_id', count: 1 } },
      { $sort: { count: -1 } }
    ];
    const speciesDist = await PestReport.aggregate(speciesPipeline);

    // 严重程度分布
    const severityPipeline = [
      { $match: { ...matchStage, 'pestInfo.isInfested': true } },
      { $group: { _id: '$pestInfo.severity', count: { $sum: 1 } } },
      { $project: { _id: 0, level: '$_id', count: 1 } },
      { $sort: { level: 1 } }
    ];
    const severityDist = await PestReport.aggregate(severityPipeline);

    // 按天的趋势数据
    const trendPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          total: { $sum: 1 },
          infested: { $sum: { $cond: ['$pestInfo.isInfested', 1, 0] } },
          avgTemp: { $avg: '$weather.temperature' }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          total: 1,
          infested: 1,
          rate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$infested', '$total'] }, 100] },
              0
            ]
          },
          avgTemp: { $round: ['$avgTemp', 1] }
        }
      }
    ];
    const trendData = await PestReport.aggregate(trendPipeline);

    res.json({
      code: 0,
      data: {
        areaId,
        timeRange: range,
        total: base.total,
        infested: base.infested,
        rate: parseFloat(base.rate.toFixed(2)),
        avgTemperature: base.avgTemperature,
        avgHumidity: base.avgHumidity,
        speciesDistribution: speciesDist.map(s => ({
          species: s.species,
          name: SPECIES_NAMES[s.species] || s.species,
          count: s.count
        })),
        severityDistribution: severityDist.map(s => ({
          level: s.level,
          count: s.count
        })),
        trend: trendData
      }
    });
  } catch (err) {
    next(err);
  }
});

// 虫害类型名称映射
const SPECIES_NAMES = {
  bollworm: '棉铃虫',
  spider_mite: '红蜘蛛',
  aphid: '蚜虫',
  lygus: '盲蝽象',
  whitefly: '白粉虱'
};

/**
 * GET /api/stats/focus-areas
 * 最近7天上报数量最多的前3个区域
 */
router.get('/focus-areas', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const topAreas = await PestReport.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: '$areaId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
      { $project: { _id: 0, areaId: '$_id', count: 1 } }
    ]);

    const areaIds = topAreas.map(a => a.areaId);
    const areas = areaIds.length
      ? await Area.find({ adcode: { $in: areaIds } }, { name: 1, adcode: 1, _id: 0 })
      : [];
    const nameMap = new Map(areas.map(a => [a.adcode, a.name]));

    res.json({
      code: 0,
      data: topAreas.map(a => ({
        areaId: a.areaId,
        name: nameMap.get(a.areaId) || '区域' + a.areaId,
        count: a.count,
        level: a.count >= 10 ? '高风险' : a.count >= 5 ? '中风险' : '低风险'
      }))
    });
  } catch (err) {
    next(err);
  }
});

const SPECIES_SUGGESTIONS = {
  leafhopper: {
    pest: '棉叶蝉',
    suggestion: '加强田间巡查，及时清除杂草，可采用吡虫啉等药剂防治。'
  },
  noctuid: {
    pest: '夜蛾',
    suggestion: '重点监测幼虫发生情况，及时开展药剂防治。'
  },
  spider_mite: {
    pest: '红蜘蛛',
    suggestion: '加强田间检查，发现叶螨及时防治。'
  },
  unknown: {
    pest: '未知',
    suggestion: '加强虫情监测，根据发生情况开展综合防治。'
  }
};

/**
 * GET /api/stats/suggestion
 * 最近7天出现最多的虫害及防治建议
 */
router.get('/suggestion', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const topSpecies = await PestReport.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: '$pestInfo.species', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    const species = topSpecies.length ? topSpecies[0]._id : null;
    const data = SPECIES_SUGGESTIONS[species] || SPECIES_SUGGESTIONS.unknown;

    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
