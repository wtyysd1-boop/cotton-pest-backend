const express = require('express');
const router = express.Router();
const Area = require('../models/Area');


const HUNAN_AREAS = [
  {
    name: "长沙市",
    adcode: 430100,
    level: "city",
    center: {
      type: "Point",
      coordinates: [112.938814, 28.228209]
    }
  },
  {
    name: "株洲市",
    adcode: 430200,
    level: "city",
    center: {
      type: "Point",
      coordinates: [113.134002, 27.827433]
    }
  },
  {
    name: "湘潭市",
    adcode: 430300,
    level: "city",
    center: {
      type: "Point",
      coordinates: [112.944052, 27.82973]
    }
  },
  {
    name: "衡阳市",
    adcode: 430400,
    level: "city",
    center: {
      type: "Point",
      coordinates: [112.571997, 26.89323]
    }
  },
  {
    name: "邵阳市",
    adcode: 430500,
    level: "city",
    center: {
      type: "Point",
      coordinates: [111.467791, 27.238892]
    }
  },
  {
    name: "岳阳市",
    adcode: 430600,
    level: "city",
    center: {
      type: "Point",
      coordinates: [113.132855, 29.37029]
    }
  },
  {
    name: "常德市",
    adcode: 430700,
    level: "city",
    center: {
      type: "Point",
      coordinates: [111.698497, 29.031673]
    }
  },
  {
    name: "张家界市",
    adcode: 430800,
    level: "city",
    center: {
      type: "Point",
      coordinates: [110.479191, 29.117096]
    }
  },
  {
    name: "益阳市",
    adcode: 430900,
    level: "city",
    center:{
      type:"Point",
      coordinates:[112.35518,28.55386]
    }
  },
  {
    name:"郴州市",
    adcode:431000,
    level:"city",
    center:{
      type:"Point",
      coordinates:[113.014717,25.77051]
    }
  },
  {
    name:"永州市",
    adcode:431100,
    level:"city",
    center:{
      type:"Point",
      coordinates:[111.612146,26.420394]
    }
  },
  {
    name:"怀化市",
    adcode:431200,
    level:"city",
    center:{
      type:"Point",
      coordinates:[109.97824,27.550082]
    }
  },
  {
    name:"娄底市",
    adcode:431300,
    level:"city",
    center:{
      type:"Point",
      coordinates:[111.994499,27.699838]
    }
  },
  {
    name:"湘西州",
    adcode:433100,
    level:"city",
    center:{
      type:"Point",
      coordinates:[109.739735,28.314296]
    }
  }
];


router.get("/", async(req,res,next)=>{

try{

for(const area of HUNAN_AREAS){

 await Area.updateOne(
   {
    adcode:area.adcode
   },
   area,
   {
    upsert:true
   }
 );

}


res.json({
 code:0,
 message:"湖南区域初始化完成",
 count:HUNAN_AREAS.length
});


}catch(err){

 next(err);

}

});


module.exports = router;
