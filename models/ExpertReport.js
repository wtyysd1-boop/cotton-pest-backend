const mongoose = require('mongoose');

const expertReportSchema = new mongoose.Schema({
  pestName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    comment: '病虫害名称'
  },
  expertName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    comment: '专家姓名'
  },
  contact: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    comment: '联系方式'
  },
  imageUrl: {
    type: String,
    default: '',
    maxlength: 2000,
    comment: '虫害图片URL'
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed'],
    default: 'pending'
  }
}, {
  timestamps: true,
  collection: 'expertreports'
});

module.exports = mongoose.model('ExpertReport', expertReportSchema);
