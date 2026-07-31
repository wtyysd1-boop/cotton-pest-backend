/**
 * 种子数据生成器
 * 向 MongoDB 写入模拟的虫害上报数据，用于开发测试
 *
 * 使用方式: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Area = require('./models/Area');
const PestReport = require('./models/PestReport');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cotton_pest';

const CITIES = [
  { name: '长沙市', adcode: 430100, center: ['Point', [112.94, 28.23]] },
  { name: '株洲市', adcode: 430200, center: ['Point', [113.13, 27.83]] },
  { name: '湘潭市', adcode: 430300, center: ['Point', [112.91, 27.81]] },
  { name: '衡阳市', adcode: 430400, center: ['Point', [112.57, 26.90]] },
  { name: '邵阳市', adcode: 430500, center: ['Point', [111.47, 27.25]] },
  { name: '岳阳市', adcode: 430600, center: ['Point', [113.13, 29.37]] },
  { name: '常德市', adcode: 430700, center: ['Point', [111.70, 29.03]] },
  { name: '张家界市', adcode: 430800, center: ['Point', [110.48, 29.13]] },
  { name: '益阳市', adcode: 430900, center: ['Point', [112.32, 28.60]] },
  { name: '郴州市', adcode: 431000, center: ['Point', [113.01, 25.79]] },
  { name: '永州市', adcode: 431100, center: ['Point', [111.61, 26.43]] },
  { name: '怀化市', adcode: 431200, center: ['Point', [109.93, 27.55]] },
  { name: '娄底市', adcode: 431300, center: ['Point', [112.01, 27.73]] },
  { name: '湘西州', adcode: 433100, center: ['Point', [109.61, 28.90]] },
];

const PEST_TYPES = ['bollworm', 'spider_mite', 'aphid', 'lygus', 'whitefly'];
const SEVERITY = ['轻', '中', '重', '特重'];
const CONDITIONS = ['晴', '多云', '阴', '小雨', '中雨'];

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

function genReport(city, dayOffset) {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  date.setHours(randInt(6, 22), randInt(0, 59), randInt(0, 59));

  const isInfested = Math.random() < 0.65;
  const species = isInfested ? PEST_TYPES[randInt(0, 4)] : 'none';
  const severity = isInfested ? SEVERITY[randInt(0, 3)] : '无';

  return {
    areaId: city.adcode,
    location: {
      type: 'Point',
      coordinates: [
        parseFloat((city.center[1][0] + rand(-0.3, 0.3)).toFixed(6)),
        parseFloat((city.center[1][1] + rand(-0.25, 0.25)).toFixed(6))
      ]
    },
    timestamp: date,
    weather: {
      temperature: parseFloat((24 + rand(-5, 10)).toFixed(1)),
      humidity: Math.round(45 + Math.random() * 45),
      condition: CONDITIONS[randInt(0, 4)]
    },
    pestInfo: {
      isInfested,
      species,
      severity,
      confidence: isInfested ? parseFloat((0.78 + Math.random() * 0.2).toFixed(2)) : null
    },
    processingStatus: 'completed'
  };
}

async function seed() {
  console.log('连接 MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('已连接:', mongoose.connection.host);

  // 清空旧数据
  await Area.deleteMany({});
  await PestReport.deleteMany({});
  console.log('旧数据已清空');

  // 写入区域数据
  const areas = CITIES.map(c => ({
    name: c.name,
    adcode: c.adcode,
    level: 'city',
    center: { type: c.center[0], coordinates: c.center[1] }
  }));
  await Area.insertMany(areas);
  console.log(`区域数据写入: ${areas.length} 个城市`);

  // 生成虫害上报数据
  const reports = [];
  const TOTAL = 700;
  for (let i = 0; i < TOTAL; i++) {
    const city = CITIES[randInt(0, 13)];
    reports.push(genReport(city, randInt(0, 7)));
  }

  // 主要棉区多加一些数据（长沙、常德、岳阳、益阳、衡阳）
  const keyAdcodes = [430100, 430700, 430600, 430900, 430400];
  for (let i = 0; i < 200; i++) {
    const ac = keyAdcodes[randInt(0, 4)];
    const city = CITIES.find(c => c.adcode === ac);
    if (city) reports.push(genReport(city, randInt(0, 7)));
  }

  reports.sort((a, b) => a.timestamp - b.timestamp);
  await PestReport.insertMany(reports);
  console.log(`虫害上报数据写入: ${reports.length} 条`);

  // 验证
  const count = await PestReport.countDocuments();
  console.log(`\n✅ 种子数据生成完成！数据库中共 ${count} 条记录`);
  console.log('   运行 npm start 启动服务后即可查看\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('种子数据生成失败:', err);
  process.exit(1);
});
