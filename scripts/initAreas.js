require('dotenv').config();
/**
 * 初始化湖南省14个地市基础区域数据
 * 用法: node scripts/initAreas.js
 */
const mongoose = require('mongoose');
const Area = require('../models/Area');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cotton_pest';

const CITIES = [
  { name: '长沙市', adcode: 430100, latitude: 28.23, longitude: 112.94, center: [112.94, 28.23] },
  { name: '株洲市', adcode: 430200, latitude: 27.83, longitude: 113.13, center: [113.13, 27.83] },
  { name: '湘潭市', adcode: 430300, latitude: 27.81, longitude: 112.91, center: [112.91, 27.81] },
  { name: '衡阳市', adcode: 430400, latitude: 26.90, longitude: 112.57, center: [112.57, 26.90] },
  { name: '邵阳市', adcode: 430500, latitude: 27.25, longitude: 111.47, center: [111.47, 27.25] },
  { name: '岳阳市', adcode: 430600, latitude: 29.37, longitude: 113.13, center: [113.13, 29.37] },
  { name: '常德市', adcode: 430700, latitude: 29.03, longitude: 111.70, center: [111.70, 29.03] },
  { name: '张家界市', adcode: 430800, latitude: 29.13, longitude: 110.48, center: [110.48, 29.13] },
  { name: '益阳市', adcode: 430900, latitude: 28.60, longitude: 112.32, center: [112.32, 28.60] },
  { name: '郴州市', adcode: 431000, latitude: 25.79, longitude: 113.01, center: [113.01, 25.79] },
  { name: '永州市', adcode: 431100, latitude: 26.43, longitude: 111.61, center: [111.61, 26.43] },
  { name: '怀化市', adcode: 431200, latitude: 27.55, longitude: 109.93, center: [109.93, 27.55] },
  { name: '娄底市', adcode: 431300, latitude: 27.73, longitude: 112.01, center: [112.01, 27.73] },
  { name: '湘西州', adcode: 433100, latitude: 28.90, longitude: 109.61, center: [109.61, 28.90] },
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
        latitude: item.latitude,
        longitude: item.longitude,
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
