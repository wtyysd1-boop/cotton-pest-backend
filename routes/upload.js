const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadToCOS } = require('../config/cos');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/upload-image', upload.single('image'), async (req, res) => {
  console.log("1 收到上传请求");

  console.log(
    "图片大小:",
    req.file ? req.file.size : "没有文件"
  );

  try {
    if (!req.file) {
      return res.json({
        code: 1,
        message: 'no image'
      });
    }

    console.log("2 开始上传COS");

    const url = await uploadToCOS(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    console.log("3 COS完成:", url);

    res.json({
      code: 0,
      url
    });
  } catch (err) {
    console.log("COS错误:", err);

    res.status(500).json({
      code: 500,
      message: err.message
    });
  }
});

module.exports = router;
