// Variables mínimas para que src/config/env.js cargue sin un .env.
// Se corre antes de cada archivo de test (jest.setupFiles).
const TEST_ENV = {
  NODE_ENV: 'test',
  TZ: 'America/Argentina/Buenos_Aires',
  DB_HOST: 'localhost',
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'agisad_test',
  JWT_SECRET: 'test-secret',
  JWT_EXPIRES_IN: '1h',
  FRONTEND_URL: 'http://localhost:5173',
  APP_TIMEZONE: 'America/Argentina/Buenos_Aires',
  APP_LOCALE: 'es-AR',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  MAIL_FROM: 'Agisad <no-reply@test.local>',
  // Los tests de rutas hacen cientos de requests desde la misma IP.
  RATE_LIMIT_MAX: '100000',
}

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value
}

// Sin API key: aunque algún test cargue el mailer real, no puede mandar nada.
delete process.env.RESEND_API_KEY
