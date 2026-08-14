const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const env = require('./config/env')

const routes = require('./routes')
const { notFound, errorHandler } = require('./middlewares/error.middleware')

const app = express()

app.set('trust proxy', env.TRUST_PROXY)

// Seguridad: Helmet.js - Headers de protección
app.use(helmet())

// CORS configuration
const allowedOrigins = new Set(
  env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true)
      }
      return callback(new Error('Origen no permitido por CORS'))
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
  })
)

// Rate limiting global. Va después de CORS para que la respuesta 429 sea legible por el navegador.
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // No aplicar rate limit a GET / (health check) ni a OPTIONS (CORS preflight)
    return (req.method === 'GET' && req.path === '/') || req.method === 'OPTIONS'
  },
  handler: (req, res) => {
    console.warn(`[rate-limit] global 429 ip=${req.ip} ${req.method} ${req.originalUrl}`)
    res.status(429).json({
      message: 'Demasiadas solicitudes. Esperá unos minutos y reintentá.',
    })
  },
})

app.use('/api', globalLimiter)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// HTTPS Enforcement - Redireccionar HTTP a HTTPS en producción
if (env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`)
    }
    next()
  })
}

app.get('/', (_req, res) => {
  res.json({
    name: 'Agisad API',
    status: 'ok',
    version: '1.0.0',
  })
})

app.use('/api', routes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
