const express = require('express');
const router = express.Router();
const Area = require('../models/Area');
const { fetchOpenMeteoCurrent } = require('../utils/weather');

/**
 * GET /api/weather/area/:areaId
 * 根据区域坐标调用 Open-Meteo 返回实时天气
 */
router.get('/area/:areaId', async (req, res) => {
  try {
    const { areaId } = req.params;
    let lat;
    let lng;
    let areaName = '湖南省';

    if (areaId === 'all') {
      lat = 27.5;
      lng = 111.8;
    } else {
      const area = await Area.findOne(
        { adcode: parseInt(areaId, 10) },
        { name: 1, latitude: 1, longitude: 1, center: 1, _id: 0 }
      ).lean();
      console.log('area:', area);
      if (!area) {
        return res.json({ code: 1, message: '天气获取失败' });
      }
      areaName = area.name;
      lat = area.latitude;
      lng = area.longitude;
      if ((lat == null || lng == null) && Array.isArray(area.center && area.center.coordinates)) {
        lng = area.center.coordinates[0];
        lat = area.center.coordinates[1];
      }
      console.log('weather coordinate', lat, lng);
    }

    if (lat == null || lng == null) {
      return res.json({ code: 1, message: '天气获取失败' });
    }

    const weather = await fetchOpenMeteoCurrent(lng, lat);
    if (!weather) {
      return res.json({ code: 1, message: '暂无实时天气数据' });
    }

    res.json({
      code: 0,
      data: {
        area: areaName,
        temperature: weather.temperature,
        humidity: weather.humidity,
        weather: weather.weather,
        updateTime: weather.updateTime
      }
    });
  } catch (err) {
    console.error(err);
    res.json({ code: 1, message: err.message || '天气获取失败' });
  }
});

module.exports = router;
