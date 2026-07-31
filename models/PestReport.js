const mongoose = require('mongoose');

const pestReportSchema = new mongoose.Schema({
  areaId: {
    type: Number,
    required: true,
    index: true,
    comment: '所属区域行政区划代码'
  },
  location: {
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
  },
  timestamp: {
    type: Date,
    default: Date.now,
    comment: '上报时间'
  },
  weather: {
    temperature: { type: Number, default: null, comment: '气温(℃)' },
    humidity: { type: Number, default: null, comment: '相对湿度(%)' },
    condition: { type: String, default: '未知', comment: '天气现象文本' }
  },
  pestInfo: {
    isInfested: { type: Boolean, required: true, comment: '是否有虫害' },
    species: {
      type: String,
      enum: ['bollworm', 'spider_mite', 'aphid', 'lygus', 'whitefly', 'none'],
      default: 'none',
      comment: '虫害类型ID'
    },
    severity: {
      type: String,
      enum: ['轻', '中', '重', '特重', '无'],
      default: '无',
      comment: '危害程度'
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
      comment: 'AI识别置信度'
    }
  },
  imageUrl: {
    type: String,
    default: '',
    comment: '虫害图片URL'
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true,
  collection: 'pestreports'
});

// 地理空间索引
pestReportSchema.index({ location: '2dsphere' });
// 复合索引：按区域+时间查询
pestReportSchema.index({ areaId: 1, timestamp: -1 });
// 按时间查询
pestReportSchema.index({ timestamp: -1 });

module.exports = mongoose.model('PestReport', pestReportSchema);
