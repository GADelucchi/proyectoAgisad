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

// Rate limiting global - 100 requests por IP cada 15 minutos
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests máximo
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Demasiadas solicitudes. Reintentá en 15 minutos.',
  },
  skip: (req) => {
    // No aplicar rate limit a GET / (health check)
    return req.method === 'GET' && req.path === '/'
  },
})

app.use('/api', globalLimiter)

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
