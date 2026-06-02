const rateLimit = require('express-rate-limit')

const loginFailedAttemptsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: 'Demasiados intentos fallidos de inicio de sesión. Reintentá en 10 minutos.',
  },
})

module.exports = {
  loginFailedAttemptsLimiter,
}