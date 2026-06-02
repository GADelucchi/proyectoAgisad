const dotenv = require('dotenv')

dotenv.config()

function asNumber(value, name) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Variable de entorno inválida: ${name}`)
  }

  return parsed
}

function asBoolean(value, name, defaultValue = undefined) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  if (typeof value === 'boolean') return value

  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false

  throw new Error(`Variable de entorno inválida: ${name}`)
}

function requiredString(name) {
  const value = process.env[name]
  if (value === undefined || value === null || value === '') {
    throw new Error(`Falta la variable de entorno requerida: ${name}`)
  }

  return value
}

const env = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: asNumber(process.env.PORT, 'PORT'),
  DB_HOST: requiredString('DB_HOST'),
  DB_PORT: asNumber(process.env.DB_PORT, 'DB_PORT'),
  DB_USER: requiredString('DB_USER'),
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: requiredString('DB_NAME'),
  DB_CONNECTION_LIMIT: asNumber(process.env.DB_CONNECTION_LIMIT, 'DB_CONNECTION_LIMIT'),
  DB_SSL: asBoolean(process.env.DB_SSL, 'DB_SSL', false),
  DB_SSL_REJECT_UNAUTHORIZED: asBoolean(
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
    'DB_SSL_REJECT_UNAUTHORIZED',
    true
  ),
  DB_SSL_CA: process.env.DB_SSL_CA,
  JWT_SECRET: requiredString('JWT_SECRET'),
  JWT_EXPIRES_IN: requiredString('JWT_EXPIRES_IN'),
  FRONTEND_URL: requiredString('FRONTEND_URL'),
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: asNumber(process.env.MAIL_PORT, 'MAIL_PORT'),
  MAIL_USER: process.env.MAIL_USER,
  MAIL_PASSWORD: process.env.MAIL_PASSWORD,
  MAIL_FROM: process.env.MAIL_FROM,
  APP_TIMEZONE: requiredString('APP_TIMEZONE'),
  APP_LOCALE: requiredString('APP_LOCALE'),
  CORS_ALLOWED_ORIGINS: requiredString('CORS_ALLOWED_ORIGINS'),
}

module.exports = env
