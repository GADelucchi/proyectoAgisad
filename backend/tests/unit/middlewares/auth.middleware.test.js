const jwt = require('jsonwebtoken')
const HttpError = require('../../../src/utils/httpError')
const { requireAuth, requireRoles } = require('../../../src/middlewares/auth.middleware')

function run(middleware, req) {
  const next = jest.fn()
  middleware(req, {}, next)
  return next
}

describe('requireAuth', () => {
  it('rechaza requests sin header Bearer', () => {
    const next = run(requireAuth, { headers: {} })
    const [err] = next.mock.calls[0]
    expect(err).toBeInstanceOf(HttpError)
    expect(err.status).toBe(401)
    expect(err.message).toBe('Token requerido')
  })

  it('rechaza tokens firmados con otro secret', () => {
    const token = jwt.sign({ idUsuario: 1 }, 'otro-secret')
    const next = run(requireAuth, { headers: { authorization: `Bearer ${token}` } })
    expect(next.mock.calls[0][0].status).toBe(401)
  })

  it('rechaza tokens vencidos', () => {
    const token = jwt.sign({ idUsuario: 1 }, process.env.JWT_SECRET, { expiresIn: -10 })
    const next = run(requireAuth, { headers: { authorization: `Bearer ${token}` } })
    expect(next.mock.calls[0][0].message).toBe('Token invalido o expirado')
  })

  it('carga el payload en req.user con un token válido', () => {
    const token = jwt.sign({ idUsuario: 7, rol: 'medico' }, process.env.JWT_SECRET)
    const req = { headers: { authorization: `Bearer ${token}` } }
    const next = run(requireAuth, req)

    expect(next).toHaveBeenCalledWith()
    expect(req.user).toMatchObject({ idUsuario: 7, rol: 'medico' })
  })
})

describe('requireRoles', () => {
  it('responde 401 si no hay usuario', () => {
    const next = run(requireRoles('medico'), {})
    expect(next.mock.calls[0][0].status).toBe(401)
  })

  it('responde 403 si el rol no está permitido', () => {
    const next = run(requireRoles('medico', 'admin'), { user: { rol: 'paciente' } })
    expect(next.mock.calls[0][0].status).toBe(403)
  })

  it('deja pasar a los roles permitidos', () => {
    const next = run(requireRoles('medico', 'admin'), { user: { rol: 'admin' } })
    expect(next).toHaveBeenCalledWith()
  })
})
