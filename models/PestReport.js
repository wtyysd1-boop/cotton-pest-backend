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

    temperature:{
      type:Number,
      default:null,
      comment:'气温'
    },

    humidity:{
      type:Number,
      default:null,
      comment:'湿度'
    },

    condition:{
      type:String,
      default:'未知',
      comment:'天气'
    }

  },


  pestInfo:{


    // 是否有虫害
    isInfested:{
      type:Boolean,
      required:true,
      comment:'是否虫害'
    },


    // 虫害类型
    species:{


      type:String,


      enum:[

        // 原来的
        'bollworm',
        'spider_mite',
        'aphid',
        'lygus',
        'whitefly',


        // 新增
        'leafhopper',       // 棉叶蝉
        'noctuid',          // 夜蛾
        'thrips',           // 棉蓟马
        'leafminer',        // 潜斑蝇


        // 病害
        'fusarium_wilt',
        'verticillium_wilt',


        // 健康
        'none'

      ],


      default:'none',

      comment:'虫害类型ID'

    },



    // 危害等级
    severity:{


      type:String,


      enum:[

        '轻',
        '中',
        '重',
        '特重',
        '无'

      ],


      default:'无'

    },



    // AI置信度

    confidence:{


      type:Number,

      default:null,


      min:0,

      max:1,


      comment:'AI识别概率'

    }


  },



  imageUrl:{


    type:String,

    default:'',

    comment:'图片地址'

  },



  processingStatus:{


    type:String,


    enum:[

      'pending',
      'completed',
      'failed'

    ],


    default:'completed'


  }


},{

  timestamps:true,

  collection:'pestreports'

});



// 地理索引

pestReportSchema.index({

  location:'2dsphere'

});


// 区域+时间查询

pestReportSchema.index({

  areaId:1,

  timestamp:-1

});


// 时间查询

pestReportSchema.index({

 timestamp:-1

});



module.exports = mongoose.model(
  'PestReport',
  pestReportSchema
);
