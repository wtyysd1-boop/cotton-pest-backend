const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    comment: '区域名称，如"长沙市"'
  },
  adcode: {
    type: Number,
    required: true,
    unique: true,
    comment: '行政区划代码，如 430100'
  },
  level: {
    type: String,
    enum: ['city', 'district', 'county'],
    default: 'city',
    comment: '行政级别'
  },
  latitude: {
    type: Number,
    default: null,
    comment: '区域中心纬度'
  },
  longitude: {
    type: Number,
    default: null,
    comment: '区域中心经度'
  },
  center: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      comment: '[经度, 纬度]'
    }
  }
}, {
  timestamps: true,
  collection: 'areas'
});


areaSchema.index({ 'center': '2dsphere' });

module.exports = mongoose.model('Area', areaSchema);

