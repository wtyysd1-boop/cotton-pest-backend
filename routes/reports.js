const express = require('express');
const router = express.Router();
const PestReport = require('../models/PestReport');
const ExpertReport = require('../models/ExpertReport');
const { fetchWeather } = require('../utils/weather');
const requireApiKey = require('../middleware/requireApiKey');
const rateLimit = require('../middleware/rateLimit');
const { checkHunanCity } = require('../utils/hunanGeo');

const ALLOWED_SPECIES = [
  'bollworm', 'spider_mite', 'aphid', 'lygus', 'whitefly',
  'noctuid', 'leafhopper', 'thrips', 'leafminer',
  'fusarium_wilt', 'verticillium_wilt', 'none'
];
const SEVERITY_LEVELS = ['轻', '中', '重', '特重', '无'];

function normalizeImageUrl(value) {
  const text = String(value || '').trim();
  if (text.length === 0 || text.length > 2000) return '';
  if (!/^https?:\/\/.+/i.test(text)) return '';
  return text;
}

/**
 * POST /api/reports/submit
 * 接收AI识别结果，自动调和风天气补全气象数据后写入MongoDB
 *
 * 请求体：
 * {
 *   "areaId": 430100,
 *   "location": { "type": "Point", "coordinates": [112.94, 28.23] },
 *   "timestamp": "2026-07-03T10:30:00.000Z",          // 可选，默认当前时间
 *   "pestInfo": {
 *     "isInfested": true,
 *     "species": "bollworm",
 *     "severity": "中",
 *     "confidence": 0.93
 *   },
 *   "imageUrl": "https://..."                          // 可选
 * }
 */
router.post('/submit', rateLimit({ max: 20 }), requireApiKey, async (req, res, next) => {
  try {
    const { areaId, location, timestamp, pestInfo, imageUrl } = req.body;

    // 参数校验
    if (!location || !location.coordinates || location.coordinates.length !== 2) {
      return res.status(400).json({ code: 400, message: '缺少有效的 location.coordinates [经度, 纬度]' });
    }
    const lng = Number(location.coordinates[0]);
    const lat = Number(location.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({ code: 400, message: '经纬度超出有效范围' });
    }
    // 经纬度必须属于湖南省，否则不纳入统计
    const cityInfo = checkHunanCity(lng, lat);
    if (!cityInfo) {
      return res.status(400).json({ code: 400, message: '该点不属于湖南省，不纳入统计' });
    }
    const areaIdNum = Number(cityInfo.adcode);
    if (!pestInfo || (pestInfo.isInfested !== true && pestInfo.isInfested !== false)) {
      return res.status(400).json({ code: 400, message: 'pestInfo.isInfested 必须是布尔值' });
    }
    const isInfested = pestInfo.isInfested;
    const species = ALLOWED_SPECIES.includes(pestInfo.species)
      ? pestInfo.species
      : (isInfested ? null : 'none');
    if (isInfested && !species) {
      return res.status(400).json({ code: 400, message: '有虫害时必须提供合法 species' });
    }
    const severity = SEVERITY_LEVELS.includes(pestInfo.severity)
      ? pestInfo.severity
      : (isInfested ? '中' : '无');
    let confidence = pestInfo.confidence == null ? null : Number(pestInfo.confidence);
    if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      return res.status(400).json({ code: 400, message: 'confidence 必须是 0 到 1 之间的数字' });
    }
    let parsedTimestamp = new Date();
    if (timestamp) {
      parsedTimestamp = new Date(timestamp);
      if (isNaN(parsedTimestamp.getTime())) {
        return res.status(400).json({ code: 400, message: 'timestamp 格式不正确' });
      }
    }

    // 根据坐标自动获取天气数据（如失败则降级为 null/未知）
    try {

  report.weather = await fetchWeather(lng, lat);

} catch(e) {

  console.log("天气获取失败:", e);

  report.weather = null;

}

    const report = new PestReport({
      areaId: areaIdNum,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      timestamp: parsedTimestamp,
      weather: {
        temperature: weather.temperature,
        humidity: weather.humidity,
        condition: weather.condition
      },
      pestInfo: {
        isInfested,
        species,
        severity,
        confidence
      },
      imageUrl: normalizeImageUrl(imageUrl),
      processingStatus: 'completed'
    });

    const saved = await report.save();

    res.status(201).json({
      code: 0,
      message: '上报成功',
      data: { id: saved._id.toString() }
    });
  } catch (err) {
    next(err);
  }
});


/**
 * GET /api/reports
 * 获取上报记录列表（含经纬度），用于地图具体点位标记
 */
router.get("/", async (req, res, next) => {
  try {
    const { range, limit, areaId } = req.query;
    const query = {};
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 1000);
    if (range) {
      const days = { "1d": 1, "3d": 3, "7d": 7 }[range] || 7;
      query.timestamp = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
    if (areaId && areaId !== "all") {
      const parsedAreaId = parseInt(areaId, 10);
      if (isNaN(parsedAreaId)) {
        return res.status(400).json({ code: 400, message: 'areaId 格式不正确' });
      }
      query.areaId = parsedAreaId;
    }
    const reports = await PestReport.find(query)
      .select("areaId location.coordinates timestamp weather pestInfo.isInfested pestInfo.species pestInfo.severity imageUrl")
      .sort({ timestamp: -1 })
      .limit(safeLimit);
    res.json({
      code: 0,
      data: reports.map(r => ({
        id: r._id.toString(),
        areaId: r.areaId,
        lng: r.location.coordinates[0],
        lat: r.location.coordinates[1],
        timestamp: r.timestamp,
        temperature: r.weather ? r.weather.temperature : null,
        humidity: r.weather ? r.weather.humidity : null,
        condition: r.weather ? r.weather.condition : null,
        isInfested: r.pestInfo ? r.pestInfo.isInfested : false,
        species: r.pestInfo ? r.pestInfo.species : null,
        severity: r.pestInfo ? r.pestInfo.severity : null,
        imageUrl: r.imageUrl || ""
      }))
    });
  } catch (err) {
    next(err);
  }
});


// ── 小程序整合：病虫害中文名 → 内部ID 映射 ──

const PEST_MAP = {
  "棉铃虫": { id: "bollworm", name: "棉铃虫", infested: true },
  "棉叶螨": { id: "spider_mite", name: "红蜘蛛", infested: true },
  "棉蚜": { id: "aphid", name: "蚜虫", infested: true },
  "盲蝽": { id: "lygus", name: "盲蝽象", infested: true },
  "白粉虱": { id: "whitefly", name: "白粉虱", infested: true },
  "烟粉虱": { id: "whitefly", name: "烟粉虱", infested: true },
  "棉粉虱": { id: "whitefly", name: "棉粉虱", infested: true },
  "夜蛾": { id: "noctuid", name: "夜蛾", infested: true },
  "棉叶蝉": { id: "leafhopper", name: "棉叶蝉", infested: true },
  "棉蓟马": { id: "thrips", name: "棉蓟马", infested: true },
  "美洲潜斑蝇": { id: "leafminer", name: "斑潜蝇", infested: true },
  "枯萎病": { id: "fusarium_wilt", name: "枯萎病", infested: true },
  "黄萎病": { id: "verticillium_wilt", name: "黄萎病", infested: true },
  "健康": { id: "none", name: "健康", infested: false },
  "健康叶片": { id: "none", name: "健康", infested: false }
};

// 湖南省14地市坐标（用于经纬度 → areaId 转换）
const CITIES = [
  { name: '长沙市', adcode: 430100, center: [112.94, 28.23] },
  { name: '株洲市', adcode: 430200, center: [113.13, 27.83] },
  { name: '湘潭市', adcode: 430300, center: [112.91, 27.81] },
  { name: '衡阳市', adcode: 430400, center: [112.57, 26.90] },
  { name: '邵阳市', adcode: 430500, center: [111.47, 27.25] },
  { name: '岳阳市', adcode: 430600, center: [113.13, 29.37] },
  { name: '常德市', adcode: 430700, center: [111.70, 29.03] },
  { name: '张家界市', adcode: 430800, center: [110.48, 29.13] },
  { name: '益阳市', adcode: 430900, center: [112.32, 28.60] },
  { name: '郴州市', adcode: 431000, center: [113.01, 25.79] },
  { name: '永州市', adcode: 431100, center: [111.61, 26.43] },
  { name: '怀化市', adcode: 431200, center: [109.93, 27.55] },
  { name: '娄底市', adcode: 431300, center: [112.01, 27.73] },
  { name: '湘西州', adcode: 433100, center: [109.61, 28.90] }
];

function findNearestCity(lng, lat) {
  let minDist = Infinity, nearest = 430100;
  CITIES.forEach(c => {
    const d = Math.sqrt(Math.pow(c.center[0] - lng, 2) + Math.pow(c.center[1] - lat, 2));
    if (d < minDist) { minDist = d; nearest = c.adcode; }
  });
  return nearest;
}

/**
 * POST /api/reports/miniapp
 * 接收小程序识别结果，转换为 PestReport 格式存入 MongoDB
 */
router.post('/miniapp', rateLimit({ max: 60 }), requireApiKey, async (req, res, next) => {
  try {
    const { results, photo, location, time } = req.body;
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ code: 400, message: '缺少识别结果' });
    }
    const cleanResults = results
      .filter(item => item && (item.clz || item.class))
      .map(item => ({
        clz: String(item.clz || item.class),
        prob: parseFloat(item.prob) || 0
      }));
    if (cleanResults.length === 0) {
      return res.status(400).json({ code: 400, message: '缺少识别结果' });
    }
    // 取置信度最高的结果
    const top = cleanResults.reduce((a, b) => (a.prob > b.prob ? a : b));
    const pest = PEST_MAP[top.clz] || { id: 'none', name: top.clz || '未知', infested: false };
    let lng = 112.94;
    let lat = 28.23;
    if (location && (location.lng != null || location.lat != null)) {
      lng = Number(location.lng);
      lat = Number(location.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return res.status(400).json({ code: 400, message: '经纬度超出有效范围' });
      }
    }
    const cityInfo = checkHunanCity(lng, lat);
    if (!cityInfo) {
      return res.status(400).json({ code: 400, message: '该点不属于湖南省，不纳入统计' });
    }
    const areaId = Number(cityInfo.adcode);
    const timestamp = time ? new Date(time) : new Date();
    if (isNaN(timestamp.getTime())) {
      return res.status(400).json({ code: 400, message: 'time 格式不正确' });
    }
    const prob = parseFloat(top.prob) || 0;
    const confidence = Math.min(Math.max(prob > 1 ? prob / 100 : prob, 0), 1); // 小程序返回 0-100

    const report = new PestReport({
      areaId,
      location: { type: 'Point', coordinates: [lng, lat] },
      timestamp,
      pestInfo: {
        isInfested: pest.infested,
        species: pest.id,
        severity: pest.infested ? '中' : '无',
        confidence
      },
      imageUrl: normalizeImageUrl(photo),
      processingStatus: 'completed'
    });
    report.weather = await fetchWeather(lng, lat);
    const saved = await report.save();
    res.json({ code: 0, message: '导入成功', data: { id: saved._id.toString() } });
  } catch (err) {
    console.error("miniapp同步错误:", err);
    res.status(500).json({
      code: 500,
      message: err.message || "服务器内部错误"
    });
  }
});

/**
 * POST /api/reports/expert
 * 接收小程序专家鉴定表单
 */
router.post('/expert', rateLimit({ max: 10, message: '专家鉴定提交过于频繁' }), requireApiKey, async (req, res, next) => {
  try {
    const { name, expert, contact, photo } = req.body || {};
    const pestName = String(name || '').trim();
    const expertName = String(expert || '').trim();
    const contactInfo = String(contact || '').trim();

    if (!pestName || !expertName || !contactInfo) {
      return res.status(400).json({ code: 400, message: '请填写病虫害名称、专家姓名和联系方式' });
    }

    const saved = await ExpertReport.create({
      pestName: pestName.slice(0, 100),
      expertName: expertName.slice(0, 50),
      contact: contactInfo.slice(0, 100),
      imageUrl: normalizeImageUrl(photo)
    });

    res.status(201).json({
      code: 0,
      message: '提交成功',
      data: { id: saved._id.toString() }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
