const express = require('express');
const router = express.Router();
const Area = require('../models/Area');

const WEATHER_CODES = {
  0: '晴',
  1: '多云',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '雾',
  51: '小雨',
  53: '小雨',
  55: '小雨',
  56: '小雨',
  57: '小雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '小雨',
  67: '中雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪',
  80: '阵雨',
  81: '阵雨',
  82: '强阵雨',
  85: '阵雪',
  86: '强阵雪',
  95: '雷阵雨',
  96: '雷阵雨',
  99: '强雷雨'
};

async function fetchOpenMeteo(lat, lng) {
  const url = 'https://api.open-meteo.com/v1/forecast?' +
    'latitude=' + lat + '&longitude=' + lng +
    '&current_weather=true&relative_humidity_2m=true&hourly=relative_humidity_2m' +
    '&timezone=Asia%2FShanghai';
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) {
    throw new Error('Open-Meteo HTTP ' + resp.status);
  }
  const data = await resp.json();
  const current = data.current_weather || {};
  const hourly = data.hourly || {};
  const time = current.time || '';
  const hourIndex = Array.isArray(hourly.time) ? hourly.time.indexOf(time) : -1;
  let humidity = null;
  if (hourIndex >= 0 && Array.isArray(hourly.relative_humidity_2m)) {
    humidity = hourly.relative_humidity_2m[hourIndex];
  } else if (Array.isArray(hourly.relative_humidity_2m) && hourly.relative_humidity_2m.length) {
    humidity = hourly.relative_humidity_2m[hourly.relative_humidity_2m.length - 1];
  }
  return {
    temperature: current.temperature != null ? Math.round(current.temperature) : null,
    humidity: humidity != null ? Math.round(humidity) : null,
    weather: WEATHER_CODES[current.weathercode] || '未知',
    updateTime: time ? time.replace('T', ' ').slice(0, 16) : ''
  };
}

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
        { name: 1, latitude: 1, longitude: 1, _id: 0 }
      ).lean();
      if (!area) {
        return res.json({ code: 1, message: '天气获取失败' });
      }
      areaName = area.name;
      lat = area.latitude;
      lng = area.longitude;
    }

    if (lat == null || lng == null) {
      return res.json({ code: 1, message: '天气获取失败' });
    }

    const weather = await fetchOpenMeteo(lat, lng);
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
    console.error('[Weather] 获取失败:', err.message);
    res.json({ code: 1, message: '天气获取失败' });
  }
});

module.exports = router;
