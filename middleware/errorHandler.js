/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);

  // Mongoose 数据验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      code: 400,
      message: '数据验证失败',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  // MongoDB 重复键错误
  if (err.code === 11000) {
    return res.status(409).json({
      code: 409,
      message: '数据已存在',
      fields: err.keyValue
    });
  }

  // Mongoose CastError (ID 格式错误等)
  if (err.name === 'CastError') {
    return res.status(400).json({
      code: 400,
      message: '参数格式错误',
      field: err.path
    });
  }

  // 默认 500
  res.status(500).json({
    code: 500,
    message: process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message
  });
}

module.exports = errorHandler;
