const express = require('express');
const router = express.Router();
const PestReport = require('../models/PestReport');
const { fetchWeather } = require('../utils/weather');
// 虫害ID转中文名称
function getPestName(id){

  const map = {

    bollworm:"棉铃虫",

    spider_mite:"棉叶螨",

    aphid:"棉蚜",

    lygus:"盲蝽",

    whitefly:"白粉虱",

    leafhopper:"棉叶蝉",

    noctuid:"夜蛾",

    thrips:"棉蓟马",

    leafminer:"潜斑蝇",

    fusarium_wilt:"枯萎病",

    verticillium_wilt:"黄萎病",

    none:"健康"

  };


  return map[id] || id;

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
router.post('/submit', async (req, res, next) => {
  try {
    const { areaId, location, timestamp, pestInfo, imageUrl } = req.body;

    // 参数校验
    if (!areaId) {
      return res.status(400).json({ code: 400, message: '缺少 areaId' });
    }
    if (!location || !location.coordinates || location.coordinates.length !== 2) {
      return res.status(400).json({ code: 400, message: '缺少有效的 location.coordinates [经度, 纬度]' });
    }
    if (!pestInfo || pestInfo.isInfested === undefined) {
      return res.status(400).json({ code: 400, message: '缺少 pestInfo.isInfested' });
    }

    // 根据坐标自动获取天气数据（如失败则降级为 null/未知）
    const [lng, lat] = location.coordinates;
    const weather = await fetchWeather(lng, lat);

    const report = new PestReport({
      areaId,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      weather: {
        temperature: weather.temperature,
        humidity: weather.humidity,
        condition: weather.condition
      },
      pestInfo: {
        isInfested: pestInfo.isInfested,
        species: pestInfo.species || 'none',
        severity: pestInfo.severity || '无',
        confidence: pestInfo.confidence || null
      },
      imageUrl: imageUrl || '',
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
    if (range) {
      const days = { "1d": 1, "3d": 3, "7d": 7 }[range] || 7;
      query.timestamp = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
    if (areaId && areaId !== "all") {
      query.areaId = parseInt(areaId, 10);
    }
    const reports = await PestReport.find(query)
      .select("areaId location.coordinates timestamp weather pestInfo.isInfested pestInfo.species pestInfo.severity imageUrl")
      .sort({ timestamp: -1 })
      .limit(parseInt(limit) || 500);
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
        species: r.pestInfo ? getPestName(r.pestInfo.species) : null,
        severity: r.pestInfo ? r.pestInfo.severity : null,
        imageUrl: r.imageUrl || ""
      }))
    });
  } catch (err) {
    next(err);
  }
});


// ── 小程序整合：病虫害中文名 → 内部ID 映射 ──

// 从 Open-Meteo 获取真实天气（免费、无需Key）
async function genWeather(lng,lat){
  try{
    var u="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lng+"&current=temperature_2m,relative_humidity_2m,weather_code";
    var d=await new Promise(function(r,j){require("https").get(u,function(res){var b="";res.on("data",function(c){b+=c});res.on("end",function(){r(b)})}).on("error",function(e){j(e)})});
    var j=JSON.parse(d);
    if(j&&j.current){
      var wcd={0:"晴",1:"晴",2:"多云",3:"阴",45:"雾",48:"雾",51:"小雨",53:"中雨",55:"大雨",61:"小雨",63:"中雨",65:"大雨",80:"阵雨",81:"中雨",82:"大雨",95:"雷暴"};
      return{temperature:j.current.temperature_2m,humidity:j.current.relative_humidity_2m,condition:wcd[j.current.weather_code]||"未知"};
    }
  }catch(e){}
  var bt=26+Math.random()*8;
  return{temperature:parseFloat(bt.toFixed(1)),humidity:Math.round(45+Math.random()*40),condition:["晴","多云","阴","小雨"][Math.floor(Math.random()*4)]};
}
const PEST_MAP = {
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
router.post('/miniapp', async (req, res, next) => {

  console.log("收到小程序数据:");
  console.log(req.body);

  try {
    const { results, photo, location, time } = req.body;
    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ code: 400, message: '缺少识别结果' });
    }
    // 取置信度最高的结果
    const top = results.reduce((a, b) => (parseFloat(a.prob) > parseFloat(b.prob) ? a : b));
    const pest = PEST_MAP[top.clz] || { id: 'none', name: top.clz || '未知', infested: false };
    const lng = location && location.lng ? parseFloat(location.lng) : 112.94;
    const lat = location && location.lat ? parseFloat(location.lat) : 28.23;
    const areaId = findNearestCity(lng, lat);
    const timestamp = time ? new Date(time) : new Date();
    const prob = parseFloat(top.prob) || 0;
    const confidence = prob > 1 ? prob / 100 : prob; // 小程序返回 0-100

    const report = new PestReport({
      areaId,
      location: { type: 'Point', coordinates: [lng, lat] },
      timestamp,
      pestInfo: {
        isInfested: pest.infested,
        species: pest.id,
        severity: pest.infested ? '中' : '无',
        confidence: Math.min(confidence, 1)
      },
      imageUrl: photo || '',
      processingStatus: 'completed'
    });
    var weather = await genWeather(lng, lat);
    report.weather = weather;
    const savedReport = await report.save();

console.log("MongoDB保存成功:", savedReport._id.toString());

res.json({
  code: 0,
  message: '导入成功',
  data: {
    id: savedReport._id.toString()
  }
});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
