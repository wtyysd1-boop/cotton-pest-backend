const express = require("express");
const router = express.Router();

const Area = require("../models/Area");


router.get("/", async (req, res) => {

    try {

        const areas = [
            {
                id: "430100",
                name: "长沙市"
            },
            {
                id: "430200",
                name: "株洲市"
            },
            {
                id: "430300",
                name: "湘潭市"
            },
            {
                id: "430400",
                name: "衡阳市"
            },
            {
                id: "430500",
                name: "邵阳市"
            },
            {
                id: "430600",
                name: "岳阳市"
            },
            {
                id: "430700",
                name: "常德市"
            },
            {
                id: "430800",
                name: "张家界市"
            },
            {
                id: "430900",
                name: "益阳市"
            },
            {
                id: "431000",
                name: "郴州市"
            },
            {
                id: "431100",
                name: "永州市"
            },
            {
                id: "431200",
                name: "怀化市"
            },
            {
                id: "431300",
                name: "娄底市"
            },
            {
                id: "433100",
                name: "湘西土家族苗族自治州"
            }
        ];


        // 防止重复写入
        await Area.deleteMany({});


        await Area.insertMany(areas);


        res.json({
            code:0,
            message:"Area初始化成功",
            count:areas.length
        });


    } catch(error){

        console.error(error);

        res.status(500).json({
            code:500,
            message:error.message
        });

    }

});


module.exports = router;
