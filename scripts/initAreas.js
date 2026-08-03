/**
 * 初始化湖南省14个地市基础区域数据
 * 用法: node scripts/initAreas.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Area = require('../models/Area');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/cotton_pest';

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
  { name: '湘西州', adcode: 433100, center: [109.61, 28.90] },
];

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('已连接 MongoDB:', mongoose.connection.host);

    await Area.deleteMany({});
    await Area.insertMany(
      CITIES.map(item => ({
        adcode: item.adcode,
        name: item.name,
        level: 'city',
        center: {
          type: 'Point',
          coordinates: item.center
        }
      }))
    );

    const count = await Area.countDocuments();
    console.log(`区域数据初始化完成，共 ${count} 条`);

    await mongoose.disconnect();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
