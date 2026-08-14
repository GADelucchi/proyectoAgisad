const rateLimit = require('express-rate-limit')
const env = require('../config/env')

const loginFailedAttemptsLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    console.warn(`[rate-limit] login 429 ip=${req.ip}`)
    res.status(429).json({
      message: 'Demasiados intentos fallidos de inicio de sesión. Reintentá más tarde.',
    })
  },
})

module.exports = {
  loginFailedAttemptsLimiter,
}