const axios = require('axios');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'weather-errors.log');

// 确保日志目录存在
function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * 根据经纬度调用和风天气实时天气 API
 * @param {number} lng - 经度
 * @param {number} lat - 纬度
 * @returns {Promise<{temperature: number|null, humidity: number|null, condition: string}>}
 */
async function fetchWeather(lng, lat) {
  const key = process.env.QWEATHER_KEY;
  if (!key || key === 'your_qweather_api_key_here') {
    console.warn('[Weather] QWEATHER_KEY \u672A\u914D\u7F6E\uFF0C\u8DF3\u8FC7\u5929\u6C14\u83B7\u53D6');
    return { temperature: null, humidity: null, condition: '\u672A\u77E5' };
  }

  try {
    // 和风天气实时天气 API v7
    const host = "api.qweather.com";
    const url = "https://" + host + "/v7/weather/now"
    const resp = await axios.get(url, {
      params: {
        location: '' + lng + ',' + lat,
        key: key
      },
      timeout: 5000
    });

    if (resp.data && resp.data.code === '200') {
      const now = resp.data.now;
      return {
        temperature: now.temp ? parseFloat(now.temp) : null,
        humidity: now.humidity ? parseInt(now.humidity, 10) : null,
        condition: now.text || '\u672A\u77E5'
      };
    }

    // API 返回了非成功 code
    console.warn('[Weather] API \u8FD4\u56DE\u5F02\u5E38:', resp.data?.code);
    logError('API code=' + (resp.data?.code || '') + ', response=' + JSON.stringify(resp.data));
    return { temperature: null, humidity: null, condition: '\u672A\u77E5' };

  } catch (err) {
    // 超时、限流、网络错误等——降级处理，不让上报接口崩溃
    console.warn('[Weather] \u83B7\u53D6\u5931\u8D25:', err.message);
    logError('lat=' + lat + ', lng=' + lng + ', error=' + err.message);

    // 区分不同错误类型以便排查
    if (err.code === 'ECONNABORTED') {
      console.warn('[Weather] API \u8BF7\u6C42\u8D85\u65F6');
    } else if (err.response) {
      // 记录响应体内容，方便排查 403/401 等权限问题
      const respBody = typeof err.response.data === 'object'
        ? JSON.stringify(err.response.data)
        : String(err.response.data);
      console.warn('[Weather] HTTP \u72B6\u6001\u7801:', err.response.status, respBody);
      logError('status=' + err.response.status + ', body=' + respBody);
    }

    return { temperature: null, humidity: null, condition: '\u672A\u77E5' };
  }
}

/**
 * 将天气错误写入日志文件
 * @param {string} message
 */
function logError(message) {
  try {
    ensureLogDir();
    const line = '[' + new Date().toISOString() + '] ' + message + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (e) {
    console.error('[Weather] \u5199\u5165\u65E5\u5FD7\u5931\u8D25:', e.message);
  }
}

module.exports = { fetchWeather };
