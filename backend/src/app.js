const express = require('express')
const cors = require('cors')
const env = require('./config/env')

const routes = require('./routes')
const { notFound, errorHandler } = require('./middlewares/error.middleware')

const app = express()

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
