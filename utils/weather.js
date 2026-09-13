const axios = require('axios');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'weather-errors.log');

function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function logError(message) {
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, '[' + new Date().toISOString() + '] ' + message + '\n', 'utf-8');
  } catch (e) {
    console.error('[Weather] 写入日志失败:', e.message);
  }
}

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

function shanghaiParts(date) {
  const parts = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  }).formatToParts(date).forEach(p => {
    if (p.type !== 'literal') parts[p.type] = p.value;
  });
  return parts;
}

async function requestHourly(apiUrl, lat, lng, day) {
  const resp = await axios.get(apiUrl, {
    params: {
      latitude: lat,
      longitude: lng,
      hourly: 'temperature_2m,relative_humidity_2m,weather_code',
      timezone: 'Asia/Shanghai',
      start_date: day,
      end_date: day
    },
    timeout: 8000
  });
  const hourly = resp.data && resp.data.hourly;
  if (!hourly || !Array.isArray(hourly.time) || !hourly.time.length) return null;
  return hourly;
}

function pickHour(hourly, targetKey) {
  const times = hourly.time || [];
  const exact = times.indexOf(targetKey);
  if (exact >= 0) return exact;

  const day = targetKey.slice(0, 10);
  const hour = parseInt(targetKey.slice(11, 13), 10);
  let best = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    if (times[i].slice(0, 10) !== day) continue;
    const h = parseInt(times[i].slice(11, 13), 10);
    const diff = Math.abs(h - hour);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/**
 * 根据上报经纬度和上报时间获取 Open-Meteo 历史小时天气
 * @param {number} lng 经度
 * @param {number} lat 纬度
 * @param {Date|string} timestamp 上报时间，缺省为当前时间
 * @returns {Promise<{temperature:number|null,humidity:number|null,condition:string}>}
 */
async function fetchWeather(lng, lat, timestamp) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat) ||
      lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    console.warn('[Weather] 经纬度非法，跳过天气获取:', lng, lat);
    return { temperature: null, humidity: null, condition: '未知' };
  }

  const at = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(at.getTime())) {
    console.warn('[Weather] 上报时间非法，跳过天气获取:', timestamp);
    return { temperature: null, humidity: null, condition: '未知' };
  }

  const parts = shanghaiParts(at);
  const day = parts.year + '-' + parts.month + '-' + parts.day;
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const targetKey = day + 'T' + hour + ':00';

  // 近期数据走 forecast，较早历史数据走 archive
  const apis = [
    'https://api.open-meteo.com/v1/forecast',
    'https://archive-api.open-meteo.com/v1/archive'
  ];

  for (const api of apis) {
    try {
      const hourly = await requestHourly(api, lat, lng, day);
      if (!hourly) continue;
      const idx = pickHour(hourly, targetKey);
      if (idx < 0) continue;

      const temperature = hourly.temperature_2m ? hourly.temperature_2m[idx] : null;
      const humidity = hourly.relative_humidity_2m ? hourly.relative_humidity_2m[idx] : null;
      const code = hourly.weather_code ? hourly.weather_code[idx] : null;
      if (temperature == null && humidity == null) continue;

      return {
        temperature: temperature != null ? Number(temperature) : null,
        humidity: humidity != null ? Number(humidity) : null,
        condition: weatherText(code)
      };
    } catch (err) {
      logError(api + ' day=' + day + ' lat=' + lat + ' lng=' + lng + ' error=' + err.message);
    }
  }

  console.warn('[Weather] Open-Meteo 未返回可用数据:', lat, lng, targetKey);
  return { temperature: null, humidity: null, condition: '未知' };
}

module.exports = { fetchWeather };
