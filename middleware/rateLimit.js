module.exports = function rateLimit({ max = 60, windowMs = 60000, message = '请求过于频繁' } = {}) {
  const requests = new Map();
  let nextCleanup = 0;
  return function (req, res, next) {
    const now = Date.now();
    if (now >= nextCleanup) {
      for (const [ip, times] of requests) {
        if (now - times[times.length - 1] >= windowMs) requests.delete(ip);
      }
      nextCleanup = now + windowMs;
    }
    const ip = req.ip || req.socket.remoteAddress;
    const times = (requests.get(ip) || []).filter(t => now - t < windowMs);
    if (times.length >= max) {
      res.set('Retry-After', String(Math.ceil((times[0] + windowMs - now) / 1000)));
      return res.status(429).json({ code: 429, message });
    }
    times.push(now);
    requests.set(ip, times);
    next();
  };
};
