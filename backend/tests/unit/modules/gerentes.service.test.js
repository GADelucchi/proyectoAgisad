jest.mock('../../../src/db/query', () => ({ query: jest.fn() }))
jest.mock('../../../src/modules/gerentes/gerentes.repository')
jest.mock('../../../src/modules/auth/auth.service')
jest.mock('../../../src/utils/mailer', () => require('../../mocks/mailer'))

const crypto = require('crypto')
const { query } = require('../../../src/db/query')
const repo = require('../../../src/modules/gerentes/gerentes.repository')
const authService = require('../../../src/modules/auth/auth.service')
const mailer = require('../../../src/utils/mailer')
const service = require('../../../src/modules/gerentes/gerentes.service')

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')
const gerente = { requesterIdUsuario: 70, requesterRol: 'gerente' }
const invitacion = {
  id_invitacion: 4, id_gerente: 2, id_clinica: 11, estado: 'pendiente', vigente: 1,
  email_invitado: 'doc@x.com', clinica_nombre: 'Clínica Sur', gerente_nombre: 'Laura', gerente_apellido: 'Ríos',
}

beforeEach(() => {
  repo.findGerenteByUserId.mockResolvedValue({ id_gerente: 2, nombre: 'Laura' })
  repo.findClinicaOwnedByGerente.mockResolvedValue({ id_clinica: 11, nombre: 'Clínica Sur' })
  repo.findInvitacionByTokenHash.mockResolvedValue(invitacion)
  mailer.sendInvitacionMedicoEmail.mockResolvedValue()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('acceso del gerente', () => {
  it.each(['listMisClinicas', 'listInvitaciones', 'listMedicosEquipo'])('%s exige rol y perfil de gerente', async (fn) => {
    await expect(service[fn]({ requesterRol: 'medico' })).rejects.toMatchObject({ status: 403 })
    repo.findGerenteByUserId.mockResolvedValueOnce(null)
    await expect(service[fn](gerente)).rejects.toMatchObject({ status: 404 })
  })

  it('los listados delegan con el id del gerente', async () => {
    repo.listClinicasByGerente.mockResolvedValue(['c'])
    repo.listInvitacionesByGerente.mockResolvedValue(['i'])
    repo.listMedicosByGerente.mockResolvedValue(['m'])
    await expect(service.listMisClinicas(gerente)).resolves.toEqual(['c'])
    await expect(service.listInvitaciones(gerente)).resolves.toEqual(['i'])
    await expect(service.listMedicosEquipo(gerente)).resolves.toEqual(['m'])
    expect(repo.listClinicasByGerente).toHaveBeenCalledWith(2)
  })
})

describe('crearInvitacion', () => {
  it('valida email y clínica propia', async () => {
    await expect(service.crearInvitacion({ idClinica: 11, email: 'sin-arroba', ...gerente })).rejects.toMatchObject({ status: 400 })
    repo.findClinicaOwnedByGerente.mockResolvedValueOnce(null)
    await expect(service.crearInvitacion({ idClinica: 11, email: 'doc@x.com', ...gerente })).rejects.toMatchObject({ status: 404 })
  })

  it('guarda el hash del token y manda el link con el token en claro', async () => {
    const result = await service.crearInvitacion({ idClinica: 11, email: ' DOC@x.com ', ...gerente })

    const token = result.link.split('/invitacion/')[1]
    expect(result).toEqual({ email: 'doc@x.com', clinica: 'Clínica Sur', link: `http://localhost:5173/invitacion/${token}` })
    expect(repo.createInvitacion).toHaveBeenCalledWith({ idGerente: 2, idClinica: 11, email: 'doc@x.com', tokenHash: sha256(token), vigenciaDias: 7 })
    expect(mailer.sendInvitacionMedicoEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'doc@x.com', link: result.link }))
  })

  it('si el mail falla igual devuelve el link para copiarlo', async () => {
    mailer.sendInvitacionMedicoEmail.mockRejectedValue(new Error('caído'))
    await expect(service.crearInvitacion({ idClinica: 11, email: 'doc@x.com', ...gerente })).resolves.toHaveProperty('link')
  })
})

describe('revocarInvitacion y desvincularMedico', () => {
  it('revocar exige una invitación pendiente propia', async () => {
    repo.findInvitacionPendienteById.mockResolvedValueOnce(null)
    await expect(service.revocarInvitacion({ idInvitacion: 4, ...gerente })).rejects.toMatchObject({ status: 404 })

    repo.findInvitacionPendienteById.mockResolvedValueOnce(invitacion)
    await service.revocarInvitacion({ idInvitacion: 4, ...gerente })
    expect(repo.updateInvitacionEstado).toHaveBeenCalledWith({ idInvitacion: 4, estado: 'revocada' })
  })

  it('desvincular exige clínica propia y quita beneficio y vínculo', async () => {
    repo.findClinicaOwnedByGerente.mockResolvedValueOnce(null)
    await expect(service.desvincularMedico({ idMedico: 3, idClinica: 11, ...gerente })).rejects.toMatchObject({ status: 404 })

    await service.desvincularMedico({ idMedico: 3, idClinica: 11, ...gerente })
    expect(repo.unlinkGerenteMedicoBeneficio).toHaveBeenCalledWith({ idGerente: 2, idMedico: 3, idClinica: 11 })
    expect(repo.unlinkMedicoDeClinica).toHaveBeenCalledWith({ idMedico: 3, idClinica: 11 })
  })
})

describe('invitaciones por token', () => {
  it.each([
    ['inexistente', null, 404],
    ['ya usada', { ...invitacion, estado: 'aceptada' }, 410],
    ['vencida', { ...invitacion, vigente: 0 }, 410],
  ])('rechaza una invitación %s', async (_caso, found, status) => {
    repo.findInvitacionByTokenHash.mockResolvedValue(found)
    await expect(service.getInvitacionPublica('tok')).rejects.toMatchObject({ status })
  })

  it('getInvitacionPublica busca por hash y expone solo datos públicos', async () => {
    await expect(service.getInvitacionPublica('tok')).resolves.toEqual({
      clinica: { nombre: 'Clínica Sur' },
      gerente: { nombre: 'Laura', apellido: 'Ríos' },
      email_invitado: 'doc@x.com',
    })
    expect(repo.findInvitacionByTokenHash).toHaveBeenCalledWith(sha256('tok'))
  })

  it('aceptarInvitacionAutenticado exige médico con el email invitado', async () => {
    const args = { token: 'tok', requesterIdUsuario: 60, requesterRol: 'medico', requesterEmail: 'DOC@x.com' }
    await expect(service.aceptarInvitacionAutenticado({ ...args, requesterRol: 'paciente' })).rejects.toMatchObject({ status: 403 })
    await expect(service.aceptarInvitacionAutenticado({ ...args, requesterEmail: 'otro@x.com' })).rejects.toMatchObject({ status: 403 })

    query.mockResolvedValueOnce([])
    await expect(service.aceptarInvitacionAutenticado(args)).rejects.toMatchObject({ status: 404 })

    query.mockResolvedValueOnce([{ id_medico: 3 }])
    await expect(service.aceptarInvitacionAutenticado(args)).resolves.toEqual({ id_clinica: 11, clinica: 'Clínica Sur' })
    expect(repo.linkMedicoAClinica).toHaveBeenCalledWith({ idMedico: 3, idClinica: 11 })
    expect(repo.linkGerenteMedicoBeneficio).toHaveBeenCalledWith({ idGerente: 2, idMedico: 3, idClinica: 11 })
    expect(repo.marcarInvitacionAceptada).toHaveBeenCalledWith({ idInvitacion: 4, idMedico: 3 })
  })

  it('registrarViaInvitacion registra al médico sin plan con el email invitado', async () => {
    authService.registerMedico.mockResolvedValue({ id_usuario: 100, id_medico: 3, username: 'doc', email: 'doc@x.com' })

    await expect(service.registrarViaInvitacion({ token: 'tok', datosMedico: { email: 'otro@x.com', plan: 'Medio', nombre: 'Juan' } })).resolves.toEqual({
      id_usuario: 100,
      id_medico: 3,
      username: 'doc',
      email: 'doc@x.com',
      rol: 'medico',
      clinica: 'Clínica Sur',
      estado_onboarding: 'cubierto_por_gerente',
    })
    expect(authService.registerMedico).toHaveBeenCalledWith({ email: 'doc@x.com', plan: undefined, nombre: 'Juan' })
    expect(repo.marcarInvitacionAceptada).toHaveBeenCalled()
  })
})
