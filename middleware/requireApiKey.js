module.exports = function requireApiKey(req, res, next) {

  const key = req.headers['x-api-key'];

  const correctKey = process.env.API_KEY;

  if (!correctKey) {
    return res.status(500).json({
      code: 500,
      message: "API_KEY未配置"
    });
  }


  if (key !== correctKey) {
    return res.status(401).json({
      code: 401,
      message: "API Key错误"
    });
  }


  next();

};
