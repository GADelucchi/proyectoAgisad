// El automock de los services importa el mailer real; se reemplaza para no cargarlo.
jest.mock('../../../src/utils/mailer', () => require('../../mocks/mailer'))
jest.mock('../../../src/db/query', () => ({ query: jest.fn(), pool: { getConnection: jest.fn() } }))
jest.mock('../../../src/modules/auth/auth.repository')
jest.mock('../../../src/modules/auth/session')
jest.mock('../../../src/modules/email-verification/email-verification.service')
jest.mock('bcryptjs', () => ({
  hash: jest.fn(async (value) => `hash:${value}`),
  compare: jest.fn(async (plain, hashed) => hashed === `hash:${plain}`),
}))

const { pool } = require('../../../src/db/query')
const authRepo = require('../../../src/modules/auth/auth.repository')
const session = require('../../../src/modules/auth/session')
const emailVerification = require('../../../src/modules/email-verification/email-verification.service')
const { createFakeConnection, executedSql } = require('../../helpers/fakeConnection')
const service = require('../../../src/modules/auth/auth.service')

/**
 * Responde las consultas que hacen los registros: columnas de `medicos`,
 * existencia de tablas, catálogos e inserts (cada insert devuelve un id nuevo).
 */
function registrationDb({ medicosColumns = ['id_especialidad', 'matricula'], tables = ['membresias', 'membresia_planes'], idPlanColumn = true, existing = {} } = {}) {
  let nextId = 100
  const conn = createFakeConnection((sql, params) => {
    if (sql.startsWith('SHOW COLUMNS FROM medicos')) return medicosColumns.map((Field) => ({ Field }))
    if (sql.includes('information_schema.tables')) return [{ total: tables.includes(params[0]) ? 1 : 0 }]
    if (sql.includes('information_schema.columns')) return [{ total: idPlanColumn ? 1 : 0 }]
    if (sql.includes('FROM provincias')) return existing.provincia ? [{ id_provincia: 1 }] : []
    if (sql.includes('FROM ciudades')) return existing.ciudad ? [{ id_ciudad: 2 }] : []
    if (sql.includes('FROM obras_sociales')) return existing.obraSocial ? [{ id_obra_social: 3 }] : []
    if (sql.includes('FROM especialidades')) return [{ id_especialidad: 4 }]
    if (sql.includes('FROM membresia_planes') && sql.includes('LOWER(nombre)')) {
      return existing.plan === false ? [] : [{ id_plan: 5, codigo: params[0] }]
    }
    if (sql.includes('FROM membresia_planes')) return [{ id_plan: 5, vigencia_meses: 1, precio_mensual: 15000 }]
    if (sql.startsWith('INSERT')) return { insertId: nextId++ }
    return []
  })
  pool.getConnection.mockResolvedValue(conn)
  return conn
}

beforeEach(() => {
  authRepo.findRoleIdByName.mockResolvedValue(2)
  authRepo.existsUsername.mockResolvedValue(false)
  emailVerification.emitirCodigo.mockResolvedValue()
  session.issueSession.mockImplementation(async (user) => ({ token: 't', user: { id: user.id_usuario } }))
  session.buildUserPayload.mockImplementation((user) => ({ id: user.id_usuario }))
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('login', () => {
  const user = { id_usuario: 1, activo: 1, email_verificado: 1, password_hash: 'hash:clave1234' }

  it('exige email y password', async () => {
    await expect(service.login({ email: 'a@x.com' })).rejects.toMatchObject({ status: 400 })
  })

  it.each([
    ['usuario inexistente', null],
    ['usuario inactivo', { ...user, activo: 0 }],
  ])('responde 401 genérico con %s', async (_caso, found) => {
    authRepo.findUserByEmail.mockResolvedValue(found)
    await expect(service.login({ email: 'a@x.com', password: 'clave1234' })).rejects.toMatchObject({
      status: 401,
      message: 'Credenciales invalidas',
    })
  })

  it('responde 401 con contraseña incorrecta', async () => {
    authRepo.findUserByEmail.mockResolvedValue(user)
    await expect(service.login({ email: 'a@x.com', password: 'otra1234' })).rejects.toMatchObject({ status: 401 })
  })

  it('responde 403 si el email no está verificado', async () => {
    authRepo.findUserByEmail.mockResolvedValue({ ...user, email_verificado: 0 })
    await expect(service.login({ email: 'a@x.com', password: 'clave1234' })).rejects.toMatchObject({
      status: 403,
      details: { code: 'EMAIL_NO_VERIFICADO' },
    })
  })

  it('emite la sesión con credenciales válidas', async () => {
    authRepo.findUserByEmail.mockResolvedValue(user)
    await expect(service.login({ email: 'a@x.com', password: 'clave1234' })).resolves.toEqual({ token: 't', user: { id: 1 } })
  })
})

describe('getCurrentUser', () => {
  it('responde 401 si el usuario no existe o está inactivo', async () => {
    authRepo.findUserById.mockResolvedValue(null)
    await expect(service.getCurrentUser('1')).rejects.toMatchObject({ status: 401 })
    authRepo.findUserById.mockResolvedValue({ id_usuario: 1, activo: 0 })
    await expect(service.getCurrentUser(1)).rejects.toMatchObject({ status: 401 })
  })

  it('devuelve el payload del usuario', async () => {
    authRepo.findUserById.mockResolvedValue({ id_usuario: 1, activo: 1 })
    await expect(service.getCurrentUser('1')).resolves.toEqual({ id: 1 })
    expect(authRepo.findUserById).toHaveBeenCalledWith(1)
  })
})

describe('registerPaciente', () => {
  const input = { email: 'ana@x.com', password: 'clave1234', dni: '30111222', nombre: 'Ana', apellido: 'Paz', acepta_tyc: true }

  it.each(['email', 'password', 'dni', 'nombre', 'apellido'])('exige %s', async (field) => {
    await expect(service.registerPaciente({ ...input, [field]: '' })).rejects.toMatchObject({ status: 400 })
  })

  it('exige aceptar TyC salvo en el alta interna', async () => {
    await expect(service.registerPaciente({ ...input, acepta_tyc: false })).rejects.toMatchObject({ status: 400 })

    registrationDb()
    await expect(service.registerPaciente({ ...input, acepta_tyc: false }, { requireAceptaTyc: false })).resolves.toMatchObject({ rol: 'paciente' })
  })

  it('crea usuario y paciente, y manda el código de verificación', async () => {
    const conn = registrationDb()

    await expect(service.registerPaciente({ ...input, username: 'AnaP', telefono: '2214563895' })).resolves.toEqual({
      id_usuario: 100,
      username: 'anap',
      email: 'ana@x.com',
      rol: 'paciente',
    })

    const usuario = conn.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO usuarios'))
    expect(usuario[1]).toEqual([2, 'anap', 'ana@x.com', 'hash:clave1234', 0])
    const paciente = conn.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO pacientes'))
    expect(paciente[1].slice(0, 5)).toEqual([100, '30111222', 'Ana', 'Paz', '+5492214563895'])
    expect(conn.commit).toHaveBeenCalled()
    expect(emailVerification.emitirCodigo).toHaveBeenCalledWith(100, 'ana@x.com')
  })

  it('el alta auto-verificada no manda código', async () => {
    const conn = registrationDb()
    await service.registerPaciente(input, { autoVerificarEmail: true })

    const usuario = conn.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO usuarios'))
    expect(usuario[1][4]).toBe(1)
    expect(emailVerification.emitirCodigo).not.toHaveBeenCalled()
  })

  it('arma el username desde el email y lo desambigua si existe', async () => {
    authRepo.existsUsername.mockResolvedValue(true)
    registrationDb()
    const { username } = await service.registerPaciente(input)
    expect(username).toMatch(/^ana_\d{6}$/)
  })

  it('crea la obra social si viene por nombre', async () => {
    const conn = registrationDb()
    await service.registerPaciente({ ...input, obra_social: 'OSDE' })
    expect(executedSql(conn)).toEqual(expect.arrayContaining([expect.stringContaining('INSERT INTO obras_sociales')]))

    const conn2 = registrationDb({ existing: { obraSocial: true } })
    await service.registerPaciente({ ...input, obra_social: 'OSDE' })
    expect(executedSql(conn2).some((s) => s.includes('INSERT INTO obras_sociales'))).toBe(false)
  })

  it('un fallo del mail de verificación no rompe el registro', async () => {
    registrationDb()
    emailVerification.emitirCodigo.mockRejectedValue(new Error('Resend caído'))
    await expect(service.registerPaciente(input)).resolves.toMatchObject({ rol: 'paciente' })
  })

  it('traduce duplicados a 409 y hace rollback', async () => {
    const conn = createFakeConnection((sql) => {
      if (sql.includes('INSERT INTO usuarios')) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })
      return []
    })
    pool.getConnection.mockResolvedValue(conn)

    await expect(service.registerPaciente(input)).rejects.toMatchObject({ status: 409 })
    expect(conn.rollback).toHaveBeenCalled()
    expect(conn.release).toHaveBeenCalled()
  })

  it('responde 500 si falta el rol en la base', async () => {
    registrationDb()
    authRepo.findRoleIdByName.mockResolvedValue(null)
    await expect(service.registerPaciente(input)).rejects.toMatchObject({ status: 500 })
  })

  it('valida la contraseña antes de insertar', async () => {
    const conn = registrationDb()
    await expect(service.registerPaciente({ ...input, password: 'corta' })).rejects.toMatchObject({ status: 400 })
    expect(conn.rollback).toHaveBeenCalled()
  })
})

describe('registerMedico', () => {
  const input = {
    email: 'doc@x.com', password: 'clave1234', nombre: 'Juan', apellido: 'Gómez', dni: '20111222',
    matricula: 'MP-123', especialidad: 'Clínica', provincia: 'Buenos Aires', ciudad: 'La Plata', acepta_tyc: true, plan: 'Medio',
  }

  it.each(['email', 'password', 'nombre', 'apellido', 'dni', 'matricula', 'especialidad', 'provincia', 'ciudad'])('exige %s', async (field) => {
    await expect(service.registerMedico({ ...input, [field]: '' })).rejects.toMatchObject({ status: 400 })
  })

  it('exige aceptar TyC', async () => {
    await expect(service.registerMedico({ ...input, acepta_tyc: false })).rejects.toMatchObject({ status: 400 })
  })

  it('crea médico, ciudad, membresía de prueba y tipos de turno por defecto', async () => {
    const conn = registrationDb()

    await expect(service.registerMedico(input)).resolves.toMatchObject({
      id_usuario: 100,
      rol: 'medico',
      plan_solicitado: 'Medio',
      estado_onboarding: 'pendiente_membresia',
    })

    const sqls = executedSql(conn)
    expect(sqls).toEqual(expect.arrayContaining([
      expect.stringContaining('INSERT INTO provincias'),
      expect.stringContaining('INSERT INTO ciudades'),
      expect.stringContaining('INSERT INTO medicos ( id_usuario, id_especialidad'),
      expect.stringContaining('INSERT INTO membresias ( id_usuario, id_plan'),
    ]))
    const tipos = conn.execute.mock.calls.filter(([sql]) => sql.includes('INSERT INTO medico_tipos_turno'))
    expect(tipos.map(([, p]) => p.slice(1))).toEqual([['Seguimiento', 30], ['Primera vez', 60]])
    expect(emailVerification.emitirCodigo).toHaveBeenCalledWith(100, 'doc@x.com')
  })

  it('reutiliza provincia, ciudad y plan existentes', async () => {
    const conn = registrationDb({ existing: { provincia: true, ciudad: true, plan: true } })
    await service.registerMedico(input)
    const sqls = executedSql(conn)
    expect(sqls.some((s) => s.includes('INSERT INTO provincias'))).toBe(false)
    expect(sqls.some((s) => s.includes('INSERT INTO ciudades'))).toBe(false)
    expect(sqls.some((s) => s.includes('INSERT INTO membresia_planes'))).toBe(false)
  })

  it.each(['legacy', 'pro', 'espacios', 'Plan Inventado'])('rechaza el plan %p sin abrir la transacción', async (plan) => {
    await expect(service.registerMedico({ ...input, plan })).rejects.toMatchObject({ status: 400, message: 'El plan elegido no está disponible' })
    expect(pool.getConnection).not.toHaveBeenCalled()
  })

  it('acepta los alias de planes públicos', async () => {
    const conn = registrationDb()
    await service.registerMedico({ ...input, plan: 'Medium' })
    const membresia = conn.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO membresias'))
    expect(membresia[1][2]).toBe('medio')
  })

  it('ya no crea planes: si no está en el catálogo responde 400 y hace rollback', async () => {
    const conn = registrationDb({ existing: { plan: false } })
    await expect(service.registerMedico(input)).rejects.toMatchObject({ status: 400 })
    expect(executedSql(conn).some((s) => s.includes('INSERT INTO membresia_planes'))).toBe(false)
    expect(conn.rollback).toHaveBeenCalled()
  })

  it('sin plan no crea membresía (alta por invitación de gerente)', async () => {
    const conn = registrationDb()
    await service.registerMedico({ ...input, plan: undefined })
    expect(executedSql(conn).some((s) => s.includes('INSERT INTO membresias'))).toBe(false)
  })

  it('soporta el esquema viejo con matricula_prov', async () => {
    const conn = registrationDb({ medicosColumns: ['matricula_prov'] })
    await service.registerMedico({ ...input, direccion: 'Calle 1' })
    expect(executedSql(conn)).toEqual(expect.arrayContaining([expect.stringContaining('matricula_prov')]))
  })

  it('responde 500 con un esquema desconocido', async () => {
    registrationDb({ medicosColumns: ['otra'] })
    await expect(service.registerMedico(input)).rejects.toMatchObject({ status: 500 })
  })

  it('sin catálogo de planes guarda solo el código del plan', async () => {
    const conn = registrationDb({ tables: ['membresias'] })
    await service.registerMedico(input)
    const membresia = conn.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO membresias'))
    expect(membresia[0]).not.toContain('id_plan')
    expect(membresia[1][1]).toBe('medio')
  })

  it('traduce duplicados a 409', async () => {
    const conn = registrationDb()
    conn.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO usuarios')) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })
      return [[]]
    })
    await expect(service.registerMedico(input)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/matrícula/) })
  })
})

describe('registerGerente', () => {
  const input = {
    email: 'ger@x.com', password: 'clave1234', nombre: 'Laura', apellido: 'Ríos', clinica_nombre: 'Clínica Sur',
    provincia: 'Buenos Aires', ciudad: 'La Plata', direccion: 'Calle 1', acepta_tyc: true, plan: 'Empresarial',
  }

  it.each(['email', 'password', 'nombre', 'apellido', 'clinica_nombre', 'provincia', 'ciudad', 'direccion'])('exige %s', async (field) => {
    await expect(service.registerGerente({ ...input, [field]: '' })).rejects.toMatchObject({ status: 400 })
  })

  it('exige aceptar TyC', async () => {
    await expect(service.registerGerente({ ...input, acepta_tyc: false })).rejects.toMatchObject({ status: 400 })
  })

  it('solo acepta el plan empresarial (y su alias gestion)', async () => {
    await expect(service.registerGerente({ ...input, plan: 'medio' })).rejects.toMatchObject({ status: 400 })
    registrationDb()
    await expect(service.registerGerente({ ...input, plan: 'gestion' })).resolves.toMatchObject({ rol: 'gerente' })
  })

  it('crea gerente, clínica y vínculo', async () => {
    const conn = registrationDb()
    await expect(service.registerGerente(input)).resolves.toMatchObject({ rol: 'gerente', estado_onboarding: 'pendiente_membresia' })

    const sqls = executedSql(conn)
    expect(sqls).toEqual(expect.arrayContaining([
      expect.stringContaining('INSERT INTO gerentes'),
      expect.stringContaining('INSERT INTO clinicas'),
      expect.stringContaining('INSERT INTO gerente_clinicas'),
    ]))
  })

  it('traduce duplicados a 409', async () => {
    const conn = registrationDb()
    conn.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO usuarios')) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })
      return [[]]
    })
    await expect(service.registerGerente(input)).rejects.toMatchObject({ status: 409 })
  })
})

describe('registerPropietario', () => {
  const input = { email: 'prop@x.com', password: 'clave1234', nombre: 'Marta', apellido: 'Sosa', acepta_tyc: true }

  it.each(['email', 'password', 'nombre', 'apellido'])('exige %s', async (field) => {
    await expect(service.registerPropietario({ ...input, [field]: '' })).rejects.toMatchObject({ status: 400 })
  })

  it('exige aceptar TyC', async () => {
    await expect(service.registerPropietario({ ...input, acepta_tyc: false })).rejects.toMatchObject({ status: 400 })
  })

  it('no acepta planes de médicos', async () => {
    await expect(service.registerPropietario({ ...input, plan: 'empresarial' })).rejects.toMatchObject({ status: 400 })
  })

  it('crea el propietario con el plan "espacios" por defecto', async () => {
    const conn = registrationDb()
    await expect(service.registerPropietario(input)).resolves.toMatchObject({ rol: 'propietario', plan_solicitado: 'espacios' })
    expect(executedSql(conn)).toEqual(expect.arrayContaining([expect.stringContaining('INSERT INTO propietarios')]))
  })

  it('traduce duplicados a 409', async () => {
    const conn = registrationDb()
    conn.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO usuarios')) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })
      return [[]]
    })
    await expect(service.registerPropietario(input)).rejects.toMatchObject({ status: 409 })
  })
})
