/**
 * Comportamiento transversal de la app: health checks, 404, CORS, HTTPS en
 * producción y rate limiting.
 */
jest.mock('../../src/utils/mailer', () => require('../mocks/mailer'))
jest.mock('../../src/db/pool', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }))
jest.mock('../../src/modules/auth/auth.service')

const request = require('supertest')

function loadApp(envOverrides = {}) {
  const previous = {}
  for (const [key, value] of Object.entries(envOverrides)) {
    previous[key] = process.env[key]
    process.env[key] = value
  }

  let app
  let pool
  let authService
  let HttpError
  try {
    jest.isolateModules(() => {
      app = require('../../src/app')
      pool = require('../../src/db/pool')
      authService = require('../../src/modules/auth/auth.service')
      HttpError = require('../../src/utils/httpError')
    })
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  return { app, pool, authService, HttpError }
}

describe('rutas base', () => {
  const { app, pool } = loadApp()

  it('GET / responde el estado de la API', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ name: 'Agisad API', status: 'ok' })
  })

  it('GET /api/ping responde pong', async () => {
    const res = await request(app).get('/api/ping')
    expect(res.body).toEqual({ message: 'pong' })
  })

  it('GET /api/health consulta la base', async () => {
    pool.query.mockResolvedValue([[{ 1: 1 }]])
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' })
  })

  it('GET /api/health responde 500 si la base no responde', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    pool.query.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(500)
  })

  it('una ruta inexistente responde 404 con el path', async () => {
    const res = await request(app).get('/api/no-existe')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ message: 'Ruta no encontrada', path: '/api/no-existe' })
  })

  it('agrega headers de seguridad (helmet)', async () => {
    const res = await request(app).get('/')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })
})

describe('CORS', () => {
  const { app } = loadApp()

  it('permite los orígenes configurados', async () => {
    const res = await request(app).get('/api/ping').set('Origin', 'http://localhost:5173')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('rechaza otros orígenes', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(app).get('/api/ping').set('Origin', 'https://evil.example')
    expect(res.status).toBe(500)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('responde el preflight con 204', async () => {
    const res = await request(app)
      .options('/api/turnos')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
    expect(res.status).toBe(204)
  })
})

describe('HTTPS en producción', () => {
  const { app } = loadApp({ NODE_ENV: 'production' })

  it('redirige HTTP a HTTPS', async () => {
    const res = await request(app).get('/api/ping').set('Host', 'api.agisad.ar').set('X-Forwarded-Proto', 'http')
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://api.agisad.ar/api/ping')
  })

  it('deja pasar requests que ya vienen por HTTPS', async () => {
    const res = await request(app).get('/api/ping').set('X-Forwarded-Proto', 'https')
    expect(res.status).toBe(200)
  })
})

describe('rate limiting', () => {
  it('limita los requests globales por IP', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { app } = loadApp({ RATE_LIMIT_MAX: '2' })

    await request(app).get('/api/ping')
    await request(app).get('/api/ping')
    const res = await request(app).get('/api/ping')

    expect(res.status).toBe(429)
    expect(res.body.message).toMatch(/Demasiadas solicitudes/)
  })

  it('el health check de / no cuenta para el límite', async () => {
    const { app } = loadApp({ RATE_LIMIT_MAX: '1' })
    await request(app).get('/')
    await request(app).get('/')
    const res = await request(app).get('/api/ping')
    expect(res.status).toBe(200)
  })

  it('bloquea el login después de varios intentos fallidos', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { app, authService, HttpError } = loadApp({ LOGIN_RATE_LIMIT_MAX: '2' })
    authService.login.mockRejectedValue(new HttpError(401, 'Credenciales invalidas'))

    const primero = await request(app).post('/api/auth/login').send({ email: 'a@x.com', password: 'x' })
    expect(primero.status).toBe(401)
    await request(app).post('/api/auth/login').send({ email: 'a@x.com', password: 'x' })
    const res = await request(app).post('/api/auth/login').send({ email: 'a@x.com', password: 'x' })

    expect(res.status).toBe(429)
    expect(res.body.message).toMatch(/intentos fallidos/)
  })

  it('los logins exitosos no cuentan para el bloqueo', async () => {
    const { app, authService } = loadApp({ LOGIN_RATE_LIMIT_MAX: '1' })
    authService.login.mockResolvedValue({ token: 't' })

    await request(app).post('/api/auth/login').send({ email: 'a@x.com', password: 'ok' })
    const res = await request(app).post('/api/auth/login').send({ email: 'a@x.com', password: 'ok' })
    expect(res.status).toBe(200)
  })
})
