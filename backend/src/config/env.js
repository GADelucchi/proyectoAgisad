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

function asTrustProxy(value, name, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  const normalized = String(value).trim().toLowerCase()

  if (['true', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['false', 'no', 'n', 'off'].includes(normalized)) return false

  const asNumberValue = Number(normalized)
  if (Number.isInteger(asNumberValue) && asNumberValue >= 0) {
    return asNumberValue
  }

  if (normalized.length > 0) {
    return normalized
  }

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
  // Nombre convencional de Resend; si no está, se cae a MAIL_PASSWORD.
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: asNumber(process.env.MAIL_PORT, 'MAIL_PORT'),
  MAIL_USER: process.env.MAIL_USER,
  MAIL_PASSWORD: process.env.MAIL_PASSWORD,
  MAIL_FROM: process.env.MAIL_FROM,
  MAIL_FROM_RECETAS: process.env.MAIL_FROM_RECETAS || process.env.MAIL_FROM,
  MAIL_FROM_TURNOS: process.env.MAIL_FROM_TURNOS || process.env.MAIL_FROM,
  APP_TIMEZONE: requiredString('APP_TIMEZONE'),
  APP_LOCALE: requiredString('APP_LOCALE'),
  CORS_ALLOWED_ORIGINS: requiredString('CORS_ALLOWED_ORIGINS'),
  // En producción se corre detrás de un proxy (Render), sin esto todas las IPs se ven iguales.
  TRUST_PROXY: asTrustProxy(
    process.env.TRUST_PROXY,
    'TRUST_PROXY',
    process.env.NODE_ENV === 'production' ? 1 : false
  ),
  RATE_LIMIT_WINDOW_MS:
    asNumber(process.env.RATE_LIMIT_WINDOW_MS, 'RATE_LIMIT_WINDOW_MS') ?? 15 * 60 * 1000,
  RATE_LIMIT_MAX: asNumber(process.env.RATE_LIMIT_MAX, 'RATE_LIMIT_MAX') ?? 600,
  LOGIN_RATE_LIMIT_WINDOW_MS:
    asNumber(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 'LOGIN_RATE_LIMIT_WINDOW_MS') ??
    10 * 60 * 1000,
  LOGIN_RATE_LIMIT_MAX: asNumber(process.env.LOGIN_RATE_LIMIT_MAX, 'LOGIN_RATE_LIMIT_MAX') ?? 10,
}

module.exports = env
