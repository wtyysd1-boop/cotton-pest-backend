const mongoose = require('mongoose');

const ExpertReportSchema = new mongoose.Schema({
  pestName: { type: String, trim: true, maxlength: 100 },
  expertName: { type: String, trim: true, maxlength: 50 },
  contact: { type: String, trim: true, maxlength: 100 },

  location: {
    type: {
      type: String,
      default: "Point"
    },
    coordinates: {
      type: [Number],
      default: [0,0]
    }
  },

  pestInfo: {
    species: String,
    confidence: Number,
    severity: String
  },

  imageUrl: String,

  expertResult: String,

  status: {
    type: String,
    default: "pending"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

ExpertReportSchema.index({
  location:"2dsphere"
});

module.exports = mongoose.model('ExpertReport', ExpertReportSchema);
