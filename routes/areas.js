const express = require('express');
const router = express.Router();
const Area = require('../models/Area');

// 湖南省地市行政区划映射（adcode -> 中文名称）
const HUNAN_AREA_NAMES = {
  430100: '长沙市',
  430200: '株洲市',
  430300: '湘潭市',
  430400: '衡阳市',
  430500: '邵阳市',
  430600: '岳阳市',
  430700: '常德市',
  430800: '张家界市',
  430900: '益阳市',
  431000: '郴州市',
  431100: '永州市',
  431200: '怀化市',
  431300: '娄底市',
  433100: '湘西州'
};

/**
 * GET /api/areas
 * 返回湖南省14个地市列表（供小程序区域选择器和地图初始化使用）
 */
router.get('/', async (req, res, next) => {
  try {
    const areas = await Area.find(
      { level: 'city' },
      { name: 1, adcode: 1, 'center.coordinates': 1, _id: 0 }
    ).sort({ adcode: 1 });

    res.json({
      code: 0,
      data: areas.map(a => ({
        id: a.adcode.toString(),
        name: HUNAN_AREA_NAMES[a.adcode] || a.name,
        center: a.center.coordinates
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
