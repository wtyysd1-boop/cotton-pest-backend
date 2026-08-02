const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadToCOS } = require('../config/cos');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    console.log("收到图片上传请求");
    const file = req.file;

    if (!file) {
      return res.json({
        code: 1,
        message: 'no image'
      });
    }

    console.log("开始上传COS", file.originalname);

    const url = await uploadToCOS(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    console.log("COS成功", url);

    res.json({
      code: 0,
      url
    });
  } catch (e) {
    console.log(e);

    res.status(500).json({
      code: 500,
      message: e.message
    });
  }
});

module.exports = router;
