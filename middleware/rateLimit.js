module.exports = function rateLimit(options = {}) {

  const max = options.max || 60;

  const windowMs = options.windowMs || 60 * 1000;


  const requests = new Map();


  return function(req, res, next) {

    const ip = req.ip || req.connection.remoteAddress;


    const now = Date.now();


    if (!requests.has(ip)) {
      requests.set(ip, []);
    }


    let times = requests.get(ip);


    times = times.filter(
      t => now - t < windowMs
    );


    if (times.length >= max) {

      return res.status(429).json({
        code:429,
        message:"请求过于频繁"
      });

    }


    times.push(now);

    requests.set(ip,times);


    next();

  }

}
