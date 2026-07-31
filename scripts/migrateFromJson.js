/**
 * 从旧版 reports.json 迁移数据到 MongoDB
 *
 * 使用方式: npm run migrate
 * 要求: reports.json 在 backend/data/ 目录下
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const PestReport = require('../models/PestReport');
const Area = require('../models/Area');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cotton_pest';
const JSON_PATH = path.join(__dirname, '..', 'data', 'reports.json');

async function migrate() {
  // 1. 检查 JSON 文件是否存在
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`❌ 未找到 ${JSON_PATH}`);
    console.log('   请将旧版 reports.json 放在 backend/data/ 目录下');
    process.exit(1);
  }

  // 2. 读取 JSON 数据
  const raw = fs.readFileSync(JSON_PATH, 'utf-8');
  let oldReports;
  try {
    oldReports = JSON.parse(raw);
  } catch (e) {
    console.error('❌ JSON 解析失败:', e.message);
    process.exit(1);
  }
  console.log(`📄 读取到 ${oldReports.length} 条旧数据`);

  // 3. 连接 MongoDB
  console.log('连接 MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('已连接:', mongoose.connection.host);

  // 4. 检查 Area 集合是否有数据
  const areaCount = await Area.countDocuments();
  if (areaCount === 0) {
    console.warn('⚠️  Area 集合为空，请先运行 npm run seed 导入区域数据');
    console.warn('   迁移将继续，但 areaId 关联可能不完整');
  } else {
    console.log(`✅ Area 集合中有 ${areaCount} 条区域数据`);
  }

  // 5. 转换数据格式
  const newReports = oldReports.map(r => ({
    areaId: parseInt(r.areaId, 10),
    location: r.location || {
      type: 'Point',
      coordinates: r.lng != null && r.lat != null ? [r.lng, r.lat] : [112.94, 28.23]
    },
    timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
    weather: {
      temperature: r.temperature || r.weatherSnapshot?.temperature || null,
      humidity: r.humidity || r.weatherSnapshot?.humidity || null,
      condition: r.condition || r.weatherSnapshot?.condition || '未知'
    },
    pestInfo: {
      isInfested: r.isInfested ?? r.pestInfo?.isInfested ?? true,
      species: r.species || r.pestInfo?.species || 'none',
      severity: r.severity || r.pestInfo?.severity || '无',
      confidence: r.confidence || r.pestInfo?.confidence || null
    },
    imageUrl: r.imageUrl || '',
    processingStatus: 'completed'
  }));

  // 6. 写入 MongoDB
  console.log(`写入 ${newReports.length} 条数据到 MongoDB...`);
  await PestReport.insertMany(newReports, { ordered: false });
  const total = await PestReport.countDocuments();
  console.log(`✅ 迁移完成！MongoDB 中现有 ${total} 条虫害上报记录`);

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
