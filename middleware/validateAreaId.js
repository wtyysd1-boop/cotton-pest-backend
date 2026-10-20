// Reject partial numbers and nested query objects before they reach MongoDB.
module.exports = function validateAreaId(req, res, next) {
  const areaId = req.params.areaId ?? req.query.areaId;
  if (areaId !== undefined && areaId !== 'all' &&
      (typeof areaId !== 'string' || !/^\d{6}$/.test(areaId))) {
    return res.status(400).json({ code: 400, message: 'areaId 格式不正确' });
  }
  next();
};
