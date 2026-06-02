const jwt = require('jsonwebtoken')
const env = require('../config/env')
const HttpError = require('../utils/httpError')

function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Token requerido'))
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    req.user = payload
    return next()
  } catch (_err) {
    return next(new HttpError(401, 'Token invalido o expirado'))
  }
}

function requireRoles(...allowedRoles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) return next(new HttpError(401, 'No autenticado'))
    if (!allowedRoles.includes(req.user.rol)) {
      return next(new HttpError(403, 'No tenes permisos para esta accion'))
    }
    return next()
  }
}

module.exports = {
  requireAuth,
  requireRoles,
}
