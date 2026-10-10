jest.mock('../../../src/db/query', () => ({ query: jest.fn() }))
jest.mock('../../../src/modules/password-reset/password-reset.repository')
jest.mock('../../../src/utils/mailer', () => require('../../mocks/mailer'))
jest.mock('bcryptjs', () => ({ hash: jest.fn(async (v) => `hash:${v}`) }))

const crypto = require('crypto')
const { query } = require('../../../src/db/query')
const repo = require('../../../src/modules/password-reset/password-reset.repository')
const mailer = require('../../../src/utils/mailer')
const service = require('../../../src/modules/password-reset/password-reset.service')

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')

describe('requestPasswordReset', () => {
  it('exige email', async () => {
    await expect(service.requestPasswordReset('')).rejects.toMatchObject({ status: 400 })
  })

  it.each([
    ['inexistente', []],
    ['inactivo', [{ id_usuario: 1, activo: 0 }]],
  ])('es silencioso con un usuario %s', async (_caso, rows) => {
    query.mockResolvedValue(rows)
    await expect(service.requestPasswordReset('a@x.com')).resolves.toBeUndefined()
    expect(repo.createToken).not.toHaveBeenCalled()
    expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('guarda el hash del token por 60 minutos y manda el token en claro', async () => {
    query.mockResolvedValue([{ id_usuario: 1, activo: 1 }])

    await service.requestPasswordReset('a@x.com')

    const { token } = mailer.sendPasswordResetEmail.mock.calls[0][0]
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(repo.createToken).toHaveBeenCalledWith(1, sha256(token), 60)
  })
})

describe('resetPassword', () => {
  it('exige token y una contraseña fuerte', async () => {
    await expect(service.resetPassword('', 'clave1234')).rejects.toMatchObject({ status: 400, message: 'Token requerido' })
    await expect(service.resetPassword('tok', 'corta')).rejects.toMatchObject({ status: 400 })
    await expect(service.resetPassword('tok', 'sinnumeros')).rejects.toMatchObject({ status: 400 })
    await expect(service.resetPassword('tok', 12345678)).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza tokens inválidos o vencidos', async () => {
    repo.findValidToken.mockResolvedValue(null)
    await expect(service.resetPassword('tok', 'clave1234')).rejects.toMatchObject({ status: 400, message: 'El enlace es inválido o ya expiró' })
    expect(repo.findValidToken).toHaveBeenCalledWith(sha256('tok'))
  })

  it('actualiza la contraseña e invalida todos los tokens del usuario', async () => {
    repo.findValidToken.mockResolvedValue({ id_token: 3, id_usuario: 8 })

    await service.resetPassword('tok', 'clave1234')

    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE usuarios SET password_hash'), {
      passwordHash: 'hash:clave1234',
      idUsuario: 8,
    })
    expect(repo.invalidateUserTokens).toHaveBeenCalledWith(8)
  })
})
