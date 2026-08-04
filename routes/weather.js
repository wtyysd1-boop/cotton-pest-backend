const express = require('express');
const router = express.Router();
const Area = require('../models/Area');

function weatherText(code) {
  if (code === 0) return '晴';
  if (code >= 1 && code <= 3) return '多云';
  if (code === 45 || code === 48) return '雾';
  if (code >= 51 && code <= 67) return '小雨';
  if (code >= 71 && code <= 77) return '降雪';
  if (code >= 80 && code <= 82) return '阵雨';
  if (code >= 95 && code <= 99) return '雷雨';
  return '未知';
}

async function fetchOpenMeteo(lat, lng) {
  const url = 'https://api.open-meteo.com/v1/forecast?' +
    'latitude=' + lat + '&longitude=' + lng +
    '&current=temperature_2m,relative_humidity_2m,weather_code' +
    '&timezone=Asia%2FShanghai';
  console.log('weather url:', url);
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) {
    throw new Error('Open-Meteo HTTP ' + resp.status);
  }
  const data = await resp.json();
  console.log('weather response:', JSON.stringify(data));
  const current = data.current || {};
  const time = current.time || '';
  return {
    temperature: current.temperature_2m != null ? current.temperature_2m : null,
    humidity: current.relative_humidity_2m != null ? current.relative_humidity_2m : null,
    weather: weatherText(current.weather_code),
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
      console.log('area:', area);
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
    console.error(err);
    res.json({ code: 1, message: err.message || '天气获取失败' });
  }
});

module.exports = router;
