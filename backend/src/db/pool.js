const mysql = require('mysql2/promise')
const env = require('../config/env')

function buildSslConfig() {
  if (!env.DB_SSL) return undefined

  const ssl = {
    rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
  }

  if (env.DB_SSL_CA) {
    ssl.ca = env.DB_SSL_CA.replace(/\\n/g, '\n')
  }

  return ssl
}

const sslConfig = buildSslConfig()

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  namedPlaceholders: true,
  timezone: '-03:00',
  ssl: sslConfig,
})

module.exports = pool
