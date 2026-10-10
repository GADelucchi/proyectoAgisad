jest.mock('../../../src/db/query', () => ({ query: jest.fn() }))
jest.mock('../../../src/modules/auth/auth.repository')
jest.mock('../../../src/modules/auth/session')
jest.mock('../../../src/modules/email-verification/email-verification.repository')
jest.mock('../../../src/utils/mailer', () => require('../../mocks/mailer'))

const crypto = require('crypto')
const { query } = require('../../../src/db/query')
const authRepo = require('../../../src/modules/auth/auth.repository')
const session = require('../../../src/modules/auth/session')
const repo = require('../../../src/modules/email-verification/email-verification.repository')
const mailer = require('../../../src/utils/mailer')
const service = require('../../../src/modules/email-verification/email-verification.service')

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')
const user = { id_usuario: 5, email: 'ana@x.com', activo: 1, email_verificado: 0 }

beforeEach(() => {
  authRepo.findUserByEmail.mockResolvedValue(user)
  authRepo.findUserById.mockResolvedValue({ ...user, email_verificado: 1 })
  session.issueSession.mockResolvedValue({ token: 't' })
  mailer.sendVerificacionEmailCodigo.mockResolvedValue()
})

describe('emitirCodigo', () => {
  it('invalida los pendientes, guarda el hash y manda un código de 6 dígitos', async () => {
    await service.emitirCodigo(5, 'ana@x.com')

    expect(repo.invalidarPendientes).toHaveBeenCalledWith(5)
    const { codigo } = mailer.sendVerificacionEmailCodigo.mock.calls[0][0]
    expect(codigo).toMatch(/^\d{6}$/)
    expect(repo.createCodigo).toHaveBeenCalledWith({ idUsuario: 5, codigoHash: sha256(codigo), vigenciaMinutos: 15 })
  })
})

describe('solicitarReenvio', () => {
  it('exige email', async () => {
    await expect(service.solicitarReenvio('')).rejects.toMatchObject({ status: 400 })
  })

  it.each([
    ['inexistente', null],
    ['inactivo', { ...user, activo: 0 }],
    ['ya verificado', { ...user, email_verificado: 1 }],
  ])('es silencioso con un usuario %s', async (_caso, found) => {
    authRepo.findUserByEmail.mockResolvedValue(found)
    await expect(service.solicitarReenvio('ana@x.com')).resolves.toBeUndefined()
    expect(mailer.sendVerificacionEmailCodigo).not.toHaveBeenCalled()
  })

  it('respeta el cooldown entre reenvíos', async () => {
    repo.findVigente.mockResolvedValue({ antiguedad_seg: 10 })
    await expect(service.solicitarReenvio('ana@x.com')).rejects.toMatchObject({
      status: 429,
      message: 'Esperá 35 segundos antes de pedir otro código.',
    })
  })

  it('reenvía pasado el cooldown o sin código vigente', async () => {
    repo.findVigente.mockResolvedValueOnce({ antiguedad_seg: 60 })
    await service.solicitarReenvio('ana@x.com')
    repo.findVigente.mockResolvedValueOnce(null)
    await service.solicitarReenvio('ana@x.com')
    expect(mailer.sendVerificacionEmailCodigo).toHaveBeenCalledTimes(2)
  })
})

describe('verificarCodigo', () => {
  const vigente = { id_verificacion: 3, intentos: 0, codigo_hash: sha256('123456') }

  it('exige email y código', async () => {
    await expect(service.verificarCodigo({ email: 'ana@x.com' })).rejects.toMatchObject({ status: 400 })
  })

  it('no revela si el email existe', async () => {
    authRepo.findUserByEmail.mockResolvedValue(null)
    await expect(service.verificarCodigo({ email: 'x@x.com', codigo: '1' })).rejects.toMatchObject({
      status: 400,
      message: 'El código es inválido o expiró',
    })
  })

  it('si ya estaba verificado inicia sesión directamente', async () => {
    authRepo.findUserByEmail.mockResolvedValue({ ...user, email_verificado: 1 })
    await expect(service.verificarCodigo({ email: 'ana@x.com', codigo: 'x' })).resolves.toEqual({ token: 't' })
    expect(repo.findVigente).not.toHaveBeenCalled()
  })

  it('responde 400 sin código vigente', async () => {
    repo.findVigente.mockResolvedValue(null)
    await expect(service.verificarCodigo({ email: 'ana@x.com', codigo: '123456' })).rejects.toMatchObject({ status: 400 })
  })

  it('bloquea después de 5 intentos', async () => {
    repo.findVigente.mockResolvedValue({ ...vigente, intentos: 5 })
    await expect(service.verificarCodigo({ email: 'ana@x.com', codigo: '123456' })).rejects.toMatchObject({ status: 429 })
  })

  it('un código incorrecto suma un intento', async () => {
    repo.findVigente.mockResolvedValue(vigente)
    await expect(service.verificarCodigo({ email: 'ana@x.com', codigo: '000000' })).rejects.toMatchObject({
      status: 400,
      message: 'El código ingresado es incorrecto',
    })
    expect(repo.incrementarIntentos).toHaveBeenCalledWith(3)
  })

  it('un código correcto verifica el email e inicia sesión', async () => {
    repo.findVigente.mockResolvedValue(vigente)

    await expect(service.verificarCodigo({ email: 'ana@x.com', codigo: ' 123456 ' })).resolves.toEqual({ token: 't' })
    expect(repo.marcarUsado).toHaveBeenCalledWith(3)
    expect(query).toHaveBeenCalledWith(expect.stringContaining('email_verificado = 1'), { idUsuario: 5 })
    expect(repo.invalidarPendientes).toHaveBeenCalledWith(5)
    expect(session.issueSession).toHaveBeenCalledWith(expect.objectContaining({ email_verificado: 1 }))
  })
})
