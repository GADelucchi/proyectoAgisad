jest.mock('../../../src/db/query', () => ({ query: jest.fn(), pool: { getConnection: jest.fn() } }))
jest.mock('../../../src/modules/auth/auth.repository')
jest.mock('../../../src/modules/asistentes/asistentes.repository')
jest.mock('../../../src/modules/acceso/acceso.repository')
jest.mock('../../../src/modules/membresias/membresias.service')
jest.mock('bcryptjs', () => ({ hash: jest.fn(async (v) => `hash:${v}`) }))

const { query, pool } = require('../../../src/db/query')
const authRepo = require('../../../src/modules/auth/auth.repository')
const repo = require('../../../src/modules/asistentes/asistentes.repository')
const accesoRepo = require('../../../src/modules/acceso/acceso.repository')
const membresias = require('../../../src/modules/membresias/membresias.service')
const HttpError = require('../../../src/utils/httpError')
const { createFakeConnection } = require('../../helpers/fakeConnection')
const service = require('../../../src/modules/asistentes/asistentes.service')

const medico = { requesterIdUsuario: 60, requesterRol: 'medico' }
const admin = { requesterIdUsuario: 1, requesterRol: 'admin' }

let conn
beforeEach(() => {
  let nextId = 200
  conn = createFakeConnection((sql) => (sql.startsWith('INSERT') ? { insertId: nextId++ } : []))
  pool.getConnection.mockResolvedValue(conn)
  authRepo.findRoleIdByName.mockResolvedValue(4)
  authRepo.existsUsername.mockResolvedValue(false)
  accesoRepo.findMedicoIdByUserId.mockResolvedValue(3)
  accesoRepo.gerenteTieneMedico.mockResolvedValue(true)
  repo.findAsistenteById.mockResolvedValue({ id_asistente: 9 })
  repo.asistenteVinculadoAMedico.mockResolvedValue(true)
  repo.findClinicasByMedicoId.mockResolvedValue([{ id_clinica: 8 }, { id_clinica: 9 }])
  repo.findGerenteIdByUserId.mockResolvedValue(2)
  repo.findClinicasByGerenteId.mockResolvedValue([{ id_clinica: 30 }])
  membresias.assertMedicoFeatureByMedicoId.mockResolvedValue({})
  membresias.assertUserFeatureByUserId.mockResolvedValue({})
})

describe('listAsistentes', () => {
  it('el médico ve los suyos aunque no mande id_medico', async () => {
    repo.listAsistentesByMedico.mockResolvedValue(['a'])
    await expect(service.listAsistentes(medico)).resolves.toEqual(['a'])
    expect(repo.listAsistentesByMedico).toHaveBeenCalledWith(3)
    expect(membresias.assertMedicoFeatureByMedicoId).toHaveBeenCalledWith(expect.objectContaining({ idMedico: 3, feature: 'permite_asistentes' }))
  })

  it('el médico no puede listar los de otro (ni siquiera se consulta el plan ajeno)', async () => {
    await expect(service.listAsistentes({ idMedico: 4, ...medico })).rejects.toMatchObject({ status: 403 })
    expect(membresias.assertMedicoFeatureByMedicoId).not.toHaveBeenCalled()
  })

  it('el admin indica el médico', async () => {
    repo.listAsistentesByMedico.mockResolvedValue(['a'])
    await expect(service.listAsistentes(admin)).rejects.toMatchObject({ status: 400 })
    await expect(service.listAsistentes({ idMedico: '4', ...admin })).resolves.toEqual(['a'])
    expect(repo.listAsistentesByMedico).toHaveBeenCalledWith(4)
  })

  it('exige plan con asistentes', async () => {
    membresias.assertMedicoFeatureByMedicoId.mockRejectedValue(new HttpError(403, 'plan'))
    await expect(service.listAsistentes(medico)).rejects.toMatchObject({ status: 403, message: 'plan' })
  })
})

describe('getAsistente', () => {
  it('el asistente solo ve su propio perfil', async () => {
    repo.findAsistenteIdByUserId.mockResolvedValue(9)
    await expect(service.getAsistente({ idAsistente: '9', requesterIdUsuario: 61, requesterRol: 'asistente' })).resolves.toEqual({ id_asistente: 9 })
    await expect(service.getAsistente({ idAsistente: 8, requesterIdUsuario: 61, requesterRol: 'asistente' })).rejects.toMatchObject({ status: 403 })
  })

  it('el médico solo ve asistentes que vinculó', async () => {
    await expect(service.getAsistente({ idAsistente: 9, ...medico })).resolves.toEqual({ id_asistente: 9 })
    expect(repo.asistenteVinculadoAMedico).toHaveBeenCalledWith({ idAsistente: 9, idMedico: 3 })

    repo.asistenteVinculadoAMedico.mockResolvedValue(false)
    await expect(service.getAsistente({ idAsistente: 9, ...medico })).rejects.toMatchObject({ status: 404 })
  })

  it('responde 404 si no existe', async () => {
    repo.findAsistenteById.mockResolvedValue(null)
    await expect(service.getAsistente({ idAsistente: 9, ...admin })).rejects.toMatchObject({ status: 404 })
  })
})

describe('patchPermisos', () => {
  it('el médico cambia permisos de sus asistentes sin mandar id_medico', async () => {
    query.mockResolvedValue([{ agenda: 1 }])
    await expect(service.patchPermisos({ idAsistente: '9', permisos: { agenda: true }, ...medico })).resolves.toEqual({ agenda: 1 })
    expect(repo.upsertPermisos).toHaveBeenCalledWith(9, 3, { agenda: true })
  })

  it('el médico no puede tocar permisos de otro médico', async () => {
    await expect(service.patchPermisos({ idAsistente: 9, idMedico: 4, permisos: {}, ...medico })).rejects.toMatchObject({ status: 403 })
    expect(repo.upsertPermisos).not.toHaveBeenCalled()
  })

  it('el médico no puede adoptar al asistente de otro', async () => {
    repo.asistenteVinculadoAMedico.mockResolvedValue(false)
    await expect(service.patchPermisos({ idAsistente: 9, permisos: {}, ...medico })).rejects.toMatchObject({ status: 404 })
    expect(repo.upsertPermisos).not.toHaveBeenCalled()
  })

  it('el admin puede vincular cualquier asistente', async () => {
    repo.asistenteVinculadoAMedico.mockResolvedValue(false)
    query.mockResolvedValue([])
    await expect(service.patchPermisos({ idAsistente: 9, idMedico: 4, permisos: {}, ...admin })).resolves.toBeNull()
    expect(repo.upsertPermisos).toHaveBeenCalledWith(9, 4, {})
  })

  it('responde 404 si el asistente no existe', async () => {
    repo.findAsistenteById.mockResolvedValue(null)
    await expect(service.patchPermisos({ idAsistente: 9, permisos: {}, ...medico })).rejects.toMatchObject({ status: 404 })
  })
})

describe('createAsistente', () => {
  const input = { email: 'asis@x.com', password: 'clave1234', nombre: 'Lu', apellido: 'Díaz' }
  const requester = { idUsuario: 60, rol: 'medico' }

  it.each(['email', 'password', 'nombre', 'apellido'])('exige %s', async (field) => {
    await expect(service.createAsistente({ ...input, [field]: '' }, requester)).rejects.toMatchObject({ status: 400 })
  })

  it.each([
    ['email inválido', { email: 'sin-arroba' }],
    ['contraseña corta', { password: 'abc12' }],
    ['contraseña sin números', { password: 'soloLetras' }],
    ['nombre con símbolos', { nombre: 'Lu<b>' }],
  ])('valida %s', async (_caso, cambios) => {
    await expect(service.createAsistente({ ...input, ...cambios }, requester)).rejects.toMatchObject({ status: 400 })
    expect(pool.getConnection).not.toHaveBeenCalled()
  })

  it('responde 500 si falta el rol', async () => {
    authRepo.findRoleIdByName.mockResolvedValue(null)
    await expect(service.createAsistente(input, requester)).rejects.toMatchObject({ status: 500 })
  })

  it('exige plan con asistentes para médicos y gerentes', async () => {
    membresias.assertUserFeatureByUserId.mockRejectedValue(new HttpError(403, 'plan'))
    await expect(service.createAsistente(input, requester)).rejects.toMatchObject({ status: 403 })
    expect(pool.getConnection).not.toHaveBeenCalled()
  })

  it('el médico lo vincula a sí mismo, ignorando el id_medico del body', async () => {
    await expect(service.createAsistente({ ...input, id_medico: 999 }, requester)).resolves.toEqual({
      id_usuario: 200,
      id_asistente: 201,
      username: 'asis',
      email: 'asis@x.com',
      rol: 'asistente',
      clinic_ids: [8, 9],
      id_medico: 3,
    })
    expect(repo.upsertPermisos).toHaveBeenCalledWith(201, 3, { agenda: 1, pacientes: 0, mensajes: 0, recetas: 0, configuracion: 0, bloqueado: 0 }, conn)
    expect(conn.commit).toHaveBeenCalled()
  })

  it('graba clínicas y permisos en la misma transacción', async () => {
    await service.createAsistente(input, requester)
    expect(repo.insertAsistenteClinica).toHaveBeenCalledWith(201, 8, conn)
    expect(repo.insertAsistenteClinica).toHaveBeenCalledWith(201, 9, conn)
    expect(repo.upsertPermisos.mock.calls[0][3]).toBe(conn)
  })

  it('el médico solo puede asignar sus propias clínicas', async () => {
    await expect(service.createAsistente({ ...input, clinic_ids: ['8', 55] }, requester)).resolves.toMatchObject({ clinic_ids: [8] })
  })

  it('un gerente asigna sus clínicas y solo médicos de su equipo', async () => {
    const gerente = { idUsuario: 70, rol: 'gerente' }
    await expect(service.createAsistente(input, gerente)).resolves.toMatchObject({ clinic_ids: [30], id_medico: null })

    await expect(service.createAsistente({ ...input, id_medico: 3 }, gerente)).resolves.toMatchObject({ id_medico: 3 })
    expect(accesoRepo.gerenteTieneMedico).toHaveBeenCalledWith({ idUsuario: 70, idMedico: 3 })

    accesoRepo.gerenteTieneMedico.mockResolvedValue(false)
    await expect(service.createAsistente({ ...input, id_medico: 4 }, gerente)).rejects.toMatchObject({ status: 403 })
  })

  it('responde 403 si no se puede resolver el médico o el gerente', async () => {
    accesoRepo.findMedicoIdByUserId.mockResolvedValue(null)
    await expect(service.createAsistente(input, requester)).rejects.toMatchObject({ status: 403 })
    repo.findGerenteIdByUserId.mockResolvedValue(null)
    await expect(service.createAsistente(input, { idUsuario: 70, rol: 'gerente' })).rejects.toMatchObject({ status: 403 })
  })

  it('el admin usa las clínicas y permisos indicados', async () => {
    await service.createAsistente({ ...input, clinic_ids: ['5', 0, 'x'], id_medico: 3, permisos: { pacientes: 1, agenda: false } }, { idUsuario: 1, rol: 'admin' })
    expect(repo.insertAsistenteClinica).toHaveBeenCalledTimes(1)
    expect(repo.insertAsistenteClinica).toHaveBeenCalledWith(201, 5, conn)
    expect(repo.upsertPermisos).toHaveBeenCalledWith(201, 3, expect.objectContaining({ agenda: 0, pacientes: 1 }), conn)
    expect(membresias.assertUserFeatureByUserId).not.toHaveBeenCalled()
  })

  it('desambigua el username', async () => {
    authRepo.existsUsername.mockResolvedValue(true)
    await expect(service.createAsistente(input, requester)).resolves.toMatchObject({ username: expect.stringMatching(/^asis_\d{6}$/) })
  })

  it('traduce duplicados a 409 y hace rollback', async () => {
    conn.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO usuarios')) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })
      return [[]]
    })
    await expect(service.createAsistente(input, requester)).rejects.toMatchObject({ status: 409 })
    expect(conn.rollback).toHaveBeenCalled()
  })
})

describe('getMyAccess', () => {
  it('solo para asistentes con acceso', async () => {
    await expect(service.getMyAccess(medico)).rejects.toMatchObject({ status: 403 })
    repo.findAsistenteAccessByUserId.mockResolvedValue(null)
    await expect(service.getMyAccess({ requesterIdUsuario: 61, requesterRol: 'asistente' })).rejects.toMatchObject({ status: 404 })
  })

  it('traduce el acceso a booleanos', async () => {
    repo.findAsistenteAccessByUserId.mockResolvedValue({ id_medico: 3, id_asistente: 9, bloqueado: 0, agenda: 1, pacientes: 0, mensajes: 1, recetas: 0, configuracion: 0 })
    await expect(service.getMyAccess({ requesterIdUsuario: 61, requesterRol: 'asistente' })).resolves.toEqual({
      doctorId: 3,
      assistantId: 9,
      blocked: false,
      permissions: { agenda: true, pacientes: false, mensajes: true, recetas: false, configuracion: false },
    })
  })
})
