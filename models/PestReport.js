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

    temperature: {

      type: Number,

      default: null,

      comment: '气温(℃)'

    },

    humidity: {

      type: Number,

      default: null,

      comment: '相对湿度(%)'

    },

    condition: {

      type: String,

      default: '未知',

      comment: '天气现象文本'

    }

  },


  pestInfo: {


    isInfested: {

      type: Boolean,

      required: true,

      comment: '是否有虫害'

    },


    species: {

      type: String,


      /*
       * 与 routes/reports.js 中 PEST_MAP 对应
       * AI识别结果转换后的虫害ID
       */

      enum: [

        // 棉铃虫
        'bollworm',

        // 棉叶螨
        'spider_mite',

        // 棉蚜
        'aphid',

        // 盲蝽
        'lygus',

        // 白粉虱、烟粉虱、棉粉虱
        'whitefly',

        // 夜蛾
        'noctuid',

        // 棉叶蝉
        'leafhopper',

        // 棉蓟马
        'thrips',

        // 美洲潜斑蝇
        'leafminer',

        // 枯萎病
        'fusarium_wilt',

        // 黄萎病
        'verticillium_wilt',

        // 健康
        'none'

      ],


      default: 'none',

      comment: '虫害类型ID'

    },


    severity: {

      type: String,

      enum: [

        '轻',

        '中',

        '重',

        '特重',

        '无'

      ],

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

    enum: [

      'pending',

      'completed',

      'failed'

    ],

    default: 'completed'

  }


}, {


  timestamps: true,


  collection: 'pestreports'


});



// 地理空间索引

pestReportSchema.index({

  location: '2dsphere'

});



// 复合索引：按区域+时间查询

pestReportSchema.index({

  areaId: 1,

  timestamp: -1

});



// 按时间查询

pestReportSchema.index({

  timestamp: -1

});



module.exports = mongoose.model('PestReport', pestReportSchema);
