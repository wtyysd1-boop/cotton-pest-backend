const crypto = require('crypto');

// 开发环境默认值，生产环境请务必通过环境变量 API_KEY 覆盖
const DEFAULT_API_KEY = 'cotton-pest-2026-miniapp-key';

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY || DEFAULT_API_KEY;
  const provided = req.get('x-api-key');

  if (!provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ code: 401, message: '缺少或错误的 API Key' });
  }

  next();
}

module.exports = requireApiKey;
