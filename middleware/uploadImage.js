const multer = require('multer');
const { uploadToCOS } = require('../config/cos');

module.exports = function uploadImage(field, defaultLimitMB, legacy = false) {
  const configured = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB);
  const limitMB = Number.isFinite(configured) && configured > 0 ? configured : defaultLimitMB;
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.floor(limitMB * 1024 * 1024), files: 1, fields: 20, parts: 21 }
  }).single(field);
  return [
    (req, res, next) => receive(req, res, err => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ code: 413, message: '图片大小不能超过 ' + limitMB + 'MB' });
      }
      err.status = 400;
      next(err);
    }),
    async (req, res, next) => {
      try {
        if (!req.file) {
          return legacy
            ? res.status(400).json({ code: 400, message: '没有收到文件' })
            : res.json({ code: 1, message: 'no image' });
        }
        const { buffer, originalname, mimetype } = req.file;
        const url = await uploadToCOS(buffer, originalname, mimetype);
        res.json({ code: 0, url });
      } catch (err) { next(err); }
    }
  ];
};
