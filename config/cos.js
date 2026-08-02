require('dotenv').config();

const COS = require("cos-nodejs-sdk-v5");


const cos = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY
});

const BUCKET = process.env.COS_BUCKET || "cotton-pest-image-1462213945";
const REGION = process.env.COS_REGION || "ap-guangzhou";


function uploadToCOS(buffer, name, type) {
    return new Promise((resolve, reject) => {
        const safeName = String(name || 'file').replace(/[^\w.\-]+/g, '_');
        const key = "images/" + Date.now() + "_" + safeName;

        cos.putObject({
            Bucket: BUCKET,
            Region: REGION,
            Key: key,
            Body: buffer,
            ContentType: type
        }, function (err, data) {
            if (err) {
                reject(err);
                return;
            }
            resolve(
                "https://" + BUCKET + ".cos." + REGION + ".myqcloud.com/" + key
            );
        });
    });
}


module.exports = {
    uploadToCOS
};
