const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadToCOS } = require('../config/cos');

const configuredLimit = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB);
const maxFileSizeMB = Number.isFinite(configuredLimit) && configuredLimit > 0
  ? configuredLimit
  : 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeMB * 1024 * 1024 }
});

function receiveImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        code: 413,
        message: `图片大小不能超过 ${maxFileSizeMB}MB`
      });
    }

    return next(err);
  });
}

router.post('/upload-image', receiveImage, async (req, res) => {
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
    const errorCode = err && err.code ? ` (${err.code})` : '';
    const errorMessage = err && err.message ? err.message : '未知错误';
    console.error(`COS上传失败${errorCode}: ${errorMessage}`);

    res.status(500).json({
      code: 500,
      message: errorMessage
    });
  }
});

module.exports = router;
