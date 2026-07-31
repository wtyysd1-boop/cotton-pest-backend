const express = require('express');
const router = express.Router();
const Area = require('../models/Area');

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
        name: a.name,
        center: a.center.coordinates
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
