const express = require('express');
const router = express.Router();
const PestReport = require('../models/PestReport');
const Area = require('../models/Area');

// 综合风险评分模型：虫害率40分 + 趋势30分 + 天气20分 + 重点虫害10分
const FOCUS_PEST_SPECIES = ['spider_mite', 'bollworm', 'noctuid'];

function addRateRisk(rate, reasons) {
  if (rate >= 70) {
    reasons.push('当前虫害发生比例较高');
    return 40;
  }
  if (rate >= 40) {
    reasons.push('当前虫害发生比例偏高');
    return 30;
  }
  if (rate >= 20) {
    reasons.push('当前存在一定比例的虫害发生');
    return 15;
  }
  return 0;
}

function addTrendRisk(trend, reasons) {
  if (!Array.isArray(trend) || trend.length < 2) {
    return 0;
  }

  const current = trend[trend.length - 1].infested || 0;
  const previous = trend[trend.length - 2].infested || 0;

  if (previous === 0) {
    if (current > 0) {
      reasons.push('近期虫害数量增长明显');
      return 30;
    }
    return 0;
  }

  const growth = ((current - previous) / previous) * 100;
  if (growth >= 50) {
    reasons.push('近期虫害数量增长明显');
    return 30;
  }
  if (growth >= 20) {
    reasons.push('虫害数量呈增长趋势');
    return 15;
  }
  return 0;
}

function addWeatherRisk(avgTemperature, avgHumidity, reasons) {
  if (avgTemperature === null || avgTemperature === undefined || avgHumidity === null || avgHumidity === undefined) {
    return 0;
  }
  if (avgTemperature >= 25 && avgHumidity >= 60) {
    reasons.push('当前温湿度适宜虫害发生');
    return 20;
  }
  return 0;
}

function addSpeciesRisk(speciesDistribution, reasons) {
  const hasFocusPest = speciesDistribution.some(item => FOCUS_PEST_SPECIES.includes(item.species));
  if (hasFocusPest) {
    reasons.push('发现重点监测虫害类型');
    return 10;
  }
  return 0;
}

function assessRisk({ rate, avgTemperature, avgHumidity, trend, speciesDistribution }) {
  const reasons = [];
  let score = 0;

  score += addRateRisk(rate, reasons);
  score += addTrendRisk(trend, reasons);
  score += addWeatherRisk(avgTemperature, avgHumidity, reasons);
  score += addSpeciesRisk(speciesDistribution, reasons);

  score = Math.min(100, Math.max(0, Math.round(score)));

  let riskLevel = '低风险';
  if (score >= 80) {
    riskLevel = '极高风险';
  } else if (score >= 60) {
    riskLevel = '高风险';
  } else if (score >= 30) {
    riskLevel = '中风险';
  }

  return { riskScore: score, riskLevel, riskReasons: reasons };
}

function calcConfidence(sampleCount) {
  if (sampleCount < 10) {
    return {
      confidence: '低',
      description: '监测数据较少，风险结果仅供参考'
    };
  }
  if (sampleCount < 50) {
    return {
      confidence: '中',
      description: '已有一定监测数据，风险判断具有参考价值'
    };
  }
  return {
    confidence: '高',
    description: '监测数据充足，风险判断较可靠'
  };
}

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
          infested: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$pestInfo.species', 'none'] },
                    { $gt: ['$pestInfo.confidence', 0.3] }
                  ]
                },
                1,
                0
              ]
            }
          },
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
      { $match: { ...matchStage, 'pestInfo.species': { $ne: 'none' } } },
      { $group: { _id: '$pestInfo.species', count: { $sum: 1 } } },
      { $project: { _id: 0, species: '$_id', count: 1 } },
      { $sort: { count: -1 } }
    ];
    const speciesDist = await PestReport.aggregate(speciesPipeline);

    // 严重程度分布
    const severityPipeline = [
      { $match: { ...matchStage, 'pestInfo.species': { $ne: 'none' } } },
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
          infested: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$pestInfo.species', 'none'] },
                    { $gt: ['$pestInfo.confidence', 0.3] }
                  ]
                },
                1,
                0
              ]
            }
          },
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

    const risk = assessRisk({
      rate: base.rate,
      avgTemperature: base.avgTemperature,
      avgHumidity: base.avgHumidity,
      trend: trendData,
      speciesDistribution: speciesDist
    });

    const sampleCount = base.total;
    const confidenceInfo = calcConfidence(sampleCount);

    // 样本过少时，最高只显示疑似高风险，避免少量样本导致误报
    let riskLevel = risk.riskLevel;
    if (sampleCount < 3 && (riskLevel === '高风险' || riskLevel === '极高风险')) {
      riskLevel = '疑似高风险';
    }

    res.json({
      code: 0,
      data: {
        areaId,
        timeRange: range,
        total: base.total,
        infested: base.infested,
        rate: parseFloat(base.rate.toFixed(2)),
        riskScore: risk.riskScore,
        riskLevel,
        riskReasons: risk.riskReasons,
        sampleCount,
        confidence: confidenceInfo.confidence,
        confidenceDescription: confidenceInfo.description,
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
  whitefly: '白粉虱',
  noctuid: '夜蛾',
  leafhopper: '棉叶蝉',
  thrips: '棉蓟马',
  leafminer: '斑潜蝇',
  fusarium_wilt: '枯萎病',
  verticillium_wilt: '黄萎病',
  none: '健康'
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
