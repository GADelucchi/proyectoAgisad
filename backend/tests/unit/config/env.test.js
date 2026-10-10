// env.js se evalúa al importarse: cada caso arma su process.env y carga el
// módulo en un registro aislado.
function loadEnv(overrides = {}) {
  const original = {}
  for (const [key, value] of Object.entries(overrides)) {
    original[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  try {
    let env
    jest.isolateModules(() => {
      env = require('../../../src/config/env')
    })
    return env
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe('config/env', () => {
  it('carga las variables requeridas', () => {
    const env = loadEnv()
    expect(env.DB_HOST).toBe('localhost')
    expect(env.JWT_SECRET).toBe('test-secret')
  })

  it.each(['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'FRONTEND_URL', 'APP_TIMEZONE', 'APP_LOCALE', 'CORS_ALLOWED_ORIGINS'])(
    'falla si falta %s',
    (name) => {
      expect(() => loadEnv({ [name]: undefined })).toThrow(`Falta la variable de entorno requerida: ${name}`)
    }
  )

  it('convierte números y rechaza valores inválidos', () => {
    expect(loadEnv({ PORT: '3000' }).PORT).toBe(3000)
    expect(loadEnv({ PORT: '' }).PORT).toBeUndefined()
    expect(() => loadEnv({ PORT: 'tres mil' })).toThrow('Variable de entorno inválida: PORT')
  })

  it.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['on', true],
    ['false', false],
    ['0', false],
    ['off', false],
  ])('DB_SSL=%p se interpreta como %p', (raw, expected) => {
    expect(loadEnv({ DB_SSL: raw }).DB_SSL).toBe(expected)
  })

  it('rechaza booleanos ambiguos', () => {
    expect(() => loadEnv({ DB_SSL: 'quizas' })).toThrow('Variable de entorno inválida: DB_SSL')
  })

  it('usa defaults de SSL cuando no están definidos', () => {
    const env = loadEnv({ DB_SSL: undefined, DB_SSL_REJECT_UNAUTHORIZED: undefined })
    expect(env.DB_SSL).toBe(false)
    expect(env.DB_SSL_REJECT_UNAUTHORIZED).toBe(true)
  })

  it.each([
    ['true', true],
    ['false', false],
    ['2', 2],
    ['loopback', 'loopback'],
  ])('TRUST_PROXY=%p se interpreta como %p', (raw, expected) => {
    expect(loadEnv({ TRUST_PROXY: raw }).TRUST_PROXY).toBe(expected)
  })

  it('TRUST_PROXY vale 1 por defecto en producción y false en el resto', () => {
    expect(loadEnv({ TRUST_PROXY: undefined, NODE_ENV: 'production' }).TRUST_PROXY).toBe(1)
    expect(loadEnv({ TRUST_PROXY: undefined, NODE_ENV: 'development' }).TRUST_PROXY).toBe(false)
  })

  it('aplica defaults de rate limit', () => {
    const env = loadEnv({
      RATE_LIMIT_WINDOW_MS: undefined,
      RATE_LIMIT_MAX: undefined,
      LOGIN_RATE_LIMIT_WINDOW_MS: undefined,
      LOGIN_RATE_LIMIT_MAX: undefined,
    })
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000)
    expect(env.RATE_LIMIT_MAX).toBe(600)
    expect(env.LOGIN_RATE_LIMIT_WINDOW_MS).toBe(10 * 60 * 1000)
    expect(env.LOGIN_RATE_LIMIT_MAX).toBe(10)
  })

  it('MAIL_FROM_RECETAS y MAIL_FROM_TURNOS caen a MAIL_FROM', () => {
    const env = loadEnv({ MAIL_FROM: 'a@x.com', MAIL_FROM_RECETAS: undefined, MAIL_FROM_TURNOS: 'turnos@x.com' })
    expect(env.MAIL_FROM_RECETAS).toBe('a@x.com')
    expect(env.MAIL_FROM_TURNOS).toBe('turnos@x.com')
  })
})
