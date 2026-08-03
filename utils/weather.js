const axios = require('axios');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'weather-errors.log');


// 确保日志目录存在
function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}


/**
 * 使用 Open-Meteo 获取实时天气
 * 免费
 * 无需 API Key
 *
 * @param {number} lng 经度
 * @param {number} lat 纬度
 */
async function fetchWeather(lng, lat) {

  try {

    const url = "https://api.open-meteo.com/v1/forecast";


    const resp = await axios.get(url, {

      params: {

        latitude: lat,

        longitude: lng,

        current:
          "temperature_2m,relative_humidity_2m,weather_code"

      },

      timeout: 5000

    });


    const now = resp.data.current;


    return {

      temperature:
        now.temperature_2m ?? null,


      humidity:
        now.relative_humidity_2m ?? null,


      condition:
        weatherCodeText(now.weather_code)

    };


  } catch (err) {


    console.warn(
      "[Weather] 获取失败:",
      err.message
    );


    logError(
      "lat=" + lat +
      ", lng=" + lng +
      ", error=" + err.message
    );


    return {

      temperature: null,

      humidity: null,

      condition: "未知"

    };

  }

}



/**
 * Open-Meteo weather_code 转中文
 */
function weatherCodeText(code) {


  const map = {


    0: "晴",

    1: "大部晴朗",

    2: "少云",

    3: "阴天",


    45: "雾",

    48: "雾凇",


    51: "小雨",

    53: "中雨",

    55: "大雨",


    61: "小雨",

    63: "中雨",

    65: "大雨",


    71: "小雪",

    73: "中雪",

    75: "大雪",


    80: "阵雨",

    81: "强阵雨",

    82: "暴雨",


    95: "雷雨",

    96: "雷雨伴冰雹",

    99: "雷雨伴冰雹"


  };


  return map[code] || "未知";

}



/**
 * 写天气错误日志
 */
function logError(message) {

  try {


    ensureLogDir();


    const line =
      "[" +
      new Date().toISOString() +
      "] " +
      message +
      "\n";


    fs.appendFileSync(
      LOG_FILE,
      line,
      "utf-8"
    );


  } catch(e) {


    console.error(
      "[Weather] 日志写入失败:",
      e.message
    );


  }

}



module.exports = {
  fetchWeather
};
