const axios = require('axios');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'weather-errors.log');
const CACHE_TTL_MS = 10 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 60 * 1000;
const GLOBAL_UPSTREAM_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

const weatherCache = new Map();
const failureCache = new Map();
const inFlightRequests = new Map();
let globalUpstreamCooldownUntil = 0;

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

function normalizeCoordinates(lng, lat) {
  const longitude = Number(lng);
  const latitude = Number(lat);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error('Invalid weather coordinates');
  }
  return {
    longitude: longitude.toFixed(4),
    latitude: latitude.toFixed(4)
  };
}

function coordinateKey(lng, lat) {
  const coords = normalizeCoordinates(lng, lat);
  return coords.longitude + ',' + coords.latitude;
}

function pruneMap(map) {
  while (map.size > MAX_CACHE_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

function readCache(key) {
  const entry = weatherCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
    console.log('[Weather] cache hit key=' + key);
    return {
      ...entry.data,
      cached: true,
      stale: false,
      cacheTime: new Date(entry.timestamp).toISOString()
    };
  }

  console.log('[Weather] cache expired key=' + key);
  return null;
}

function readLastSuccessfulCache(key) {
  const entry = weatherCache.get(key);
  if (!entry) return null;
  return {
    ...entry.data,
    cached: true,
    stale: true,
    cacheTime: new Date(entry.timestamp).toISOString()
  };
}

function writeCache(key, data) {
  weatherCache.set(key, {
    data: { ...data },
    timestamp: Date.now()
  });
  pruneMap(weatherCache);
  console.log('[Weather] cached key=' + key + ' ttlMinutes=' + Math.round(CACHE_TTL_MS / 60000));
}

function failureCooldownActive(key) {
  const entry = failureCache.get(key);
  if (!entry) return false;
  if (Date.now() - entry.timestamp < entry.cooldownMs) return true;
  failureCache.delete(key);
  return false;
}

function recordFailure(key, err) {
  const status = err && err.response && err.response.status;
  failureCache.set(key, {
    timestamp: Date.now(),
    cooldownMs: status === 429 ? FAILURE_COOLDOWN_MS : Math.min(FAILURE_COOLDOWN_MS, 15000)
  });
  pruneMap(failureCache);
}

function globalCooldownActive() {
  const now = Date.now();
  if (globalUpstreamCooldownUntil && now >= globalUpstreamCooldownUntil) {
    console.log('[Weather] global upstream cooldown expired');
    globalUpstreamCooldownUntil = 0;
  }
  return globalUpstreamCooldownUntil > now;
}

function activateGlobalCooldown(err) {
  const status = err && err.response && err.response.status;
  if (status !== 429) return;

  globalUpstreamCooldownUntil = Date.now() + GLOBAL_UPSTREAM_COOLDOWN_MS;
  console.warn('[Weather] Open-Meteo 429');
  console.warn(
    '[Weather] global upstream cooldown activated until ' +
    new Date(globalUpstreamCooldownUntil).toISOString()
  );
}

async function getWithCache(key, requestFn) {
  const cached = readCache(key);
  if (cached) return cached;

  if (globalCooldownActive()) {
    console.warn('[Weather] global cooldown active');
    const lastSuccessful = readLastSuccessfulCache(key);
    if (lastSuccessful) {
      console.warn('[Weather] using last successful cache key=' + key);
      return lastSuccessful;
    }
    const err = new Error('Open-Meteo global upstream cooldown active');
    err.code = 'OPEN_METEO_GLOBAL_COOLDOWN';
    throw err;
  }

  if (failureCooldownActive(key)) {
    console.warn('[Weather] request cooldown active key=' + key);
    throw new Error('Weather request cooldown active');
  }

  if (inFlightRequests.has(key)) {
    console.log('[Weather] in-flight request reused key=' + key);
    return inFlightRequests.get(key);
  }

  console.log('[Weather] cache miss key=' + key);
  console.log('[Weather] requesting upstream key=' + key);

  const request = requestFn()
    .then(data => {
      console.log('[Weather] Open-Meteo success key=' + key);
      writeCache(key, data);
      return { ...data, cached: false, stale: false, cacheTime: null };
    })
    .catch(err => {
      activateGlobalCooldown(err);
      recordFailure(key, err);
      if (err && err.response && err.response.status === 429) {
        const lastSuccessful = readLastSuccessfulCache(key);
        if (lastSuccessful) {
          console.warn('[Weather] using last successful cache key=' + key);
          return lastSuccessful;
        }
      }
      throw err;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, request);
  return request;
}

function logOpenMeteoFailure(key, err) {
  const status = err && err.response && err.response.status;
  const detail = err && err.message ? err.message : String(err);
  if (status === 429) {
    console.warn('[Weather] Open-Meteo HTTP 429 key=' + key);
  } else {
    console.warn('[Weather] Open-Meteo request failed key=' + key + ' error=' + detail);
  }
  logError('key=' + key + ' status=' + (status || '') + ' error=' + detail);
}

function isWeatherAvailable(weather) {
  return !!weather &&
    weather.temperature != null &&
    weather.humidity != null &&
    weather.condition !== '未知';
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
async function fetchWeatherUncached(lng, lat, timestamp) {
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
      if (err.response && err.response.status === 429) throw err;
    }
  }

  console.warn('[Weather] Open-Meteo 未返回可用数据:', lat, lng, targetKey);
  return { temperature: null, humidity: null, condition: '未知' };
}

async function requestOpenMeteoCurrent(lng, lat) {
  const resp = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: lat,
      longitude: lng,
      current: 'temperature_2m,relative_humidity_2m,weather_code',
      timezone: 'Asia/Shanghai'
    },
    timeout: 8000
  });
  const current = resp.data && resp.data.current;
  if (!current) {
    throw new Error('Open-Meteo response missing current weather');
  }

  const time = current.time || '';
  return {
    temperature: current.temperature_2m != null ? Number(current.temperature_2m) : null,
    humidity: current.relative_humidity_2m != null ? Number(current.relative_humidity_2m) : null,
    condition: weatherText(current.weather_code),
    weather: weatherText(current.weather_code),
    updateTime: time ? time.replace('T', ' ').slice(0, 16) : ''
  };
}

async function fetchOpenMeteoCurrent(lng, lat) {
  if (!Number.isFinite(Number(lng)) || !Number.isFinite(Number(lat))) {
    console.warn('[Weather] Open-Meteo invalid coordinates:', lng, lat);
    return null;
  }

  let key;
  try {
    key = 'current:' + coordinateKey(lng, lat);
    const weather = await getWithCache(key, () => requestOpenMeteoCurrent(lng, lat));
    if (!isWeatherAvailable(weather)) return null;
    return weather;
  } catch (err) {
    if (err.code === 'OPEN_METEO_GLOBAL_COOLDOWN' ||
        (err.response && err.response.status === 429)) {
      console.warn('[Weather] no cached weather available key=' + key);
      return null;
    }
    logOpenMeteoFailure(key || coordinateKey(lng, lat), err);
    return null;
  }
}

async function fetchWeather(lng, lat, timestamp) {
  if (!Number.isFinite(Number(lng)) || !Number.isFinite(Number(lat))) {
    console.warn('[Weather] Open-Meteo invalid coordinates:', lng, lat);
    return { temperature: null, humidity: null, condition: '未知' };
  }

  let key;
  try {
    const at = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(at.getTime())) {
      return { temperature: null, humidity: null, condition: '未知' };
    }
    const parts = shanghaiParts(at);
    const day = parts.year + '-' + parts.month + '-' + parts.day;
    const hour = parts.hour === '24' ? '00' : parts.hour;
    key = 'history:' + coordinateKey(lng, lat) + ':' + day + 'T' + hour;

    const weather = await getWithCache(key, () => {
      return fetchWeatherUncached(lng, lat, at).then(data => {
        if (!isWeatherAvailable(data)) {
          throw new Error('Open-Meteo hourly weather unavailable');
        }
        return data;
      });
    });
    return weather;
  } catch (err) {
    if (err.code === 'OPEN_METEO_GLOBAL_COOLDOWN' ||
        (err.response && err.response.status === 429)) {
      console.warn('[Weather] no cached weather available key=' + key);
      return { temperature: null, humidity: null, condition: '未知' };
    }
    logOpenMeteoFailure(key || coordinateKey(lng, lat), err);
    return { temperature: null, humidity: null, condition: '未知' };
  }
}

module.exports = {
  fetchWeather,
  fetchOpenMeteoCurrent
};
