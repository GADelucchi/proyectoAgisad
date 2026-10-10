jest.mock('../../../src/modules/pacientes/pacientes.repository')
jest.mock('../../../src/modules/acceso/acceso.repository')
jest.mock('../../../src/modules/turnos/turnos.repository')
jest.mock('../../../src/modules/membresias/membresias.service')
jest.mock('../../../src/modules/auth/auth.service')
jest.mock('../../../src/utils/mailer', () => require('../../mocks/mailer'))

const repo = require('../../../src/modules/pacientes/pacientes.repository')
const accesoRepo = require('../../../src/modules/acceso/acceso.repository')
const turnosRepo = require('../../../src/modules/turnos/turnos.repository')
const membresias = require('../../../src/modules/membresias/membresias.service')
const authService = require('../../../src/modules/auth/auth.service')
const mailer = require('../../../src/utils/mailer')
const HttpError = require('../../../src/utils/httpError')
const service = require('../../../src/modules/pacientes/pacientes.service')

const medico = { requesterIdUsuario: 60, requesterRol: 'medico' }
const asistente = { requesterIdUsuario: 61, requesterRol: 'asistente' }
const pacienteUser = { requesterIdUsuario: 50, requesterRol: 'paciente' }

const pacienteRow = { id_paciente: 7, id_usuario: 50, nombre: 'Ana' }

beforeEach(() => {
  accesoRepo.findMedicoIdByUserId.mockResolvedValue(3)
  accesoRepo.findPermisosAsistente.mockResolvedValue({ agenda: 1, pacientes: 1, bloqueado: 0 })
  repo.findPacienteById.mockResolvedValue(pacienteRow)
  repo.findPacienteByUserId.mockResolvedValue(pacienteRow)
  repo.pacienteVinculadoAMedico.mockResolvedValue(true)
  repo.existsObraSocial.mockResolvedValue(true)
  repo.findMedicoRecetaById.mockResolvedValue({ id_medico: 3, email: 'doc@x.com', enviar_recetas_mail: 1 })
  membresias.assertMembershipNotExpiredByMedicoId.mockResolvedValue({})
  mailer.sendRecetaSolicitudEmail.mockResolvedValue()
  mailer.sendPacienteMensajeEmail.mockResolvedValue()
})

describe('listPacientes (resolución del médico destino)', () => {
  beforeEach(() => repo.listPacientesByMedico.mockResolvedValue(['p']))

  it('el médico sin id_medico ve sus propios pacientes', async () => {
    await expect(service.listPacientes({ ...medico, search: 'paz' })).resolves.toEqual(['p'])
    expect(repo.listPacientesByMedico).toHaveBeenCalledWith(3, 'paz')
  })

  it('el médico no puede ver pacientes de otro', async () => {
    await expect(service.listPacientes({ ...medico, idMedico: 9 })).rejects.toMatchObject({ status: 403 })
  })

  it('el asistente necesita acceso al médico', async () => {
    await expect(service.listPacientes({ ...asistente, idMedico: '3' })).resolves.toEqual(['p'])
    expect(accesoRepo.findPermisosAsistente).toHaveBeenCalledWith({ idUsuario: 61, idMedico: 3 })

    accesoRepo.findPermisosAsistente.mockResolvedValue(null)
    await expect(service.listPacientes({ ...asistente, idMedico: 3 })).rejects.toMatchObject({ status: 403 })
  })

  it('el asistente bloqueado no accede a los pacientes', async () => {
    accesoRepo.findPermisosAsistente.mockResolvedValue({ agenda: 1, pacientes: 1, bloqueado: 1 })
    await expect(service.listPacientes({ ...asistente, idMedico: 3 })).rejects.toMatchObject({ status: 403 })
  })

  it('el asistente debe indicar el médico; un médico sin perfil responde 404', async () => {
    await expect(service.listPacientes(asistente)).rejects.toMatchObject({ status: 400 })
    accesoRepo.findMedicoIdByUserId.mockResolvedValue(null)
    await expect(service.listPacientes(medico)).rejects.toMatchObject({ status: 404 })
  })
})

describe('createPacienteManual', () => {
  const fields = { dni: '30111222', nombre: 'Ana', apellido: 'Paz' }

  beforeEach(() => {
    repo.findPrimeraClinicaByMedico.mockResolvedValue(8)
    accesoRepo.medicoAtiendeEnClinica.mockResolvedValue(true)
    repo.findPacienteByDni.mockResolvedValue(null)
    repo.ensureObraSocialByNombre.mockResolvedValue(null)
    authService.registerPaciente.mockResolvedValue({ id_usuario: 99 })
    repo.findPacienteByUserId.mockResolvedValue({ id_paciente: 70 })
    repo.findPacienteById.mockResolvedValue({ id_paciente: 70, nombre: 'Ana' })
  })

  it('valida DNI y nombres', async () => {
    await expect(service.createPacienteManual({ ...medico, fields: { ...fields, dni: '12' } })).rejects.toMatchObject({ status: 400 })
    await expect(service.createPacienteManual({ ...medico, fields: { ...fields, nombre: '' } })).rejects.toMatchObject({ status: 400 })
  })

  it('exige un consultorio cargado', async () => {
    repo.findPrimeraClinicaByMedico.mockResolvedValue(null)
    await expect(service.createPacienteManual({ ...medico, fields })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/al menos un consultorio/),
    })
  })

  it('rechaza un consultorio que no es del médico', async () => {
    accesoRepo.medicoAtiendeEnClinica.mockResolvedValue(false)
    await expect(service.createPacienteManual({ ...medico, fields: { ...fields, id_clinica: 9 } })).rejects.toMatchObject({ status: 400 })
  })

  it('si el DNI ya existe solo lo vincula', async () => {
    repo.findPacienteByDni.mockResolvedValue({ id_paciente: 70 })

    await expect(service.createPacienteManual({ ...medico, fields: { ...fields, id_clinica: '8' } })).resolves.toEqual({
      id_paciente: 70,
      nombre: 'Ana',
      ya_existia: true,
    })
    expect(repo.upsertPacienteVinculo).toHaveBeenCalledWith({ idPaciente: 70, idMedico: 3, idClinica: 8 })
    expect(authService.registerPaciente).not.toHaveBeenCalled()
  })

  it('si es nuevo lo registra sin TyC, con email auto-verificado y clave aleatoria', async () => {
    await expect(service.createPacienteManual({ ...medico, fields })).resolves.toMatchObject({ id_paciente: 70, ya_existia: false })

    const [datos, opciones] = authService.registerPaciente.mock.calls[0]
    expect(datos).toMatchObject({ email: 'paciente.30111222@sin-email.local', dni: '30111222', nombre: 'Ana', apellido: 'Paz' })
    expect(datos.password).toMatch(/^[0-9a-f]{32}Aa1$/)
    expect(opciones).toEqual({ requireAceptaTyc: false, autoVerificarEmail: true })
    expect(repo.upsertPacienteVinculo).toHaveBeenCalledWith({ idPaciente: 70, idMedico: 3, idClinica: 8 })
  })

  it('usa el email y la obra social que vienen en el alta', async () => {
    repo.ensureObraSocialByNombre.mockResolvedValue(12)

    await service.createPacienteManual({
      ...medico,
      fields: { ...fields, email: 'ana@x.com', obra_social: 'OSDE', nro_obra_social: '123', fecha_nac: '1990-05-01' },
    })

    expect(repo.ensureObraSocialByNombre).toHaveBeenCalledWith('OSDE')
    expect(authService.registerPaciente.mock.calls[0][0]).toMatchObject({
      email: 'ana@x.com',
      id_obra_social: 12,
      nro_obra_social: '123',
      fecha_nac: '1990-05-01',
    })
  })

  it('rechaza un email inválido', async () => {
    await expect(service.createPacienteManual({ ...medico, fields: { ...fields, email: 'no-es-email' } })).rejects.toMatchObject({ status: 400 })
  })
})

describe('getPaciente', () => {
  it('responde 404 si no existe', async () => {
    repo.findPacienteById.mockResolvedValue(null)
    await expect(service.getPaciente({ idPaciente: 7, ...medico })).rejects.toMatchObject({ status: 404 })
  })

  it('el paciente solo ve su propio perfil', async () => {
    await expect(service.getPaciente({ idPaciente: 7, ...pacienteUser })).resolves.toEqual(pacienteRow)
    await expect(service.getPaciente({ idPaciente: 7, requesterIdUsuario: 51, requesterRol: 'paciente' })).rejects.toMatchObject({ status: 403 })
  })

  it('el médico solo ve pacientes vinculados', async () => {
    await expect(service.getPaciente({ idPaciente: '7', ...medico })).resolves.toEqual(pacienteRow)
    repo.pacienteVinculadoAMedico.mockResolvedValue(false)
    await expect(service.getPaciente({ idPaciente: 7, ...medico })).rejects.toMatchObject({ status: 403 })
  })
})

describe('patchPaciente', () => {
  it('el médico vinculado puede editar', async () => {
    await service.patchPaciente({ idPaciente: '7', fields: { telefono: '2214563895' }, ...medico })
    expect(repo.updatePaciente).toHaveBeenCalledWith(7, { telefono: '+5492214563895' })
  })

  it('el médico no vinculado no puede editar', async () => {
    repo.pacienteVinculadoAMedico.mockResolvedValue(false)
    await expect(service.patchPaciente({ idPaciente: 7, fields: {}, ...medico })).rejects.toMatchObject({ status: 403 })
  })

  it('el paciente solo edita su perfil; el admin edita cualquiera', async () => {
    await expect(service.patchPaciente({ idPaciente: 7, fields: {}, requesterIdUsuario: 51, requesterRol: 'paciente' })).rejects.toMatchObject({ status: 403 })
    await expect(service.patchPaciente({ idPaciente: 7, fields: {}, requesterIdUsuario: 1, requesterRol: 'admin' })).resolves.toEqual(pacienteRow)
  })

  it('responde 404 si no existe', async () => {
    repo.findPacienteById.mockResolvedValue(null)
    await expect(service.patchPaciente({ idPaciente: 7, fields: {}, ...medico })).rejects.toMatchObject({ status: 404 })
  })
})

describe('normalización de campos de perfil (vía patchMiPerfil)', () => {
  async function patch(fields) {
    await service.patchMiPerfil({ fields, requesterIdUsuario: 50 })
    return repo.updatePaciente.mock.calls.at(-1)[1]
  }

  it('solo incluye los campos presentes', async () => {
    await expect(patch({})).resolves.toEqual({})
    await expect(patch({ fecha_nac: '1990-05-01' })).resolves.toEqual({ fecha_nac: '1990-05-01' })
  })

  it('quitar la obra social también limpia el número de afiliado', async () => {
    await expect(patch({ id_obra_social: '', nro_obra_social: '999' })).resolves.toEqual({ id_obra_social: null, nro_obra_social: null })
    await expect(patch({ id_obra_social: null })).resolves.toEqual({ id_obra_social: null, nro_obra_social: null })
  })

  it('valida la obra social elegida', async () => {
    await expect(patch({ id_obra_social: 'abc' })).rejects.toMatchObject({ status: 400 })
    repo.existsObraSocial.mockResolvedValue(false)
    await expect(patch({ id_obra_social: 5 })).rejects.toMatchObject({ status: 400, message: 'La obra social seleccionada no existe' })
  })

  it('guarda obra social y número de afiliado', async () => {
    await expect(patch({ id_obra_social: '5', nro_obra_social: ' 123 ' })).resolves.toEqual({ id_obra_social: 5, nro_obra_social: '123' })
  })

  it('valida el largo del número de afiliado', async () => {
    await expect(patch({ nro_obra_social: 'x'.repeat(31) })).rejects.toMatchObject({ status: 400 })
  })
})

describe('perfil del paciente autenticado', () => {
  it('getMiPerfil responde 404 sin perfil', async () => {
    repo.findPacienteByUserId.mockResolvedValue(null)
    await expect(service.getMiPerfil({ requesterIdUsuario: 50 })).rejects.toMatchObject({ status: 404 })
  })

  it('getMiPerfil devuelve el detalle', async () => {
    await expect(service.getMiPerfil({ requesterIdUsuario: 50 })).resolves.toEqual(pacienteRow)
    expect(repo.findPacienteById).toHaveBeenCalledWith(7)
  })

  it('listMisRecetas parsea los items y oculta items_json', async () => {
    repo.listRecetasByPaciente.mockResolvedValue([
      { id: 1, items_json: '[{"medicamento":"A"}]' },
      { id: 2, items_json: [{ medicamento: 'B' }] },
      { id: 3, items_json: 'roto' },
      { id: 4, items_json: null },
    ])

    const rows = await service.listMisRecetas({ requesterIdUsuario: 50 })
    expect(rows.map((r) => r.items)).toEqual([[{ medicamento: 'A' }], [{ medicamento: 'B' }], [], []])
    expect(rows[0].items_json).toBeUndefined()
  })

  it('listMisMensajes y listCatalogoObrasSociales delegan', async () => {
    repo.listMensajesByPaciente.mockResolvedValue(['m'])
    repo.listObrasSociales.mockResolvedValue(['os'])
    await expect(service.listMisMensajes({ requesterIdUsuario: 50 })).resolves.toEqual(['m'])
    await expect(service.listCatalogoObrasSociales()).resolves.toEqual(['os'])
  })
})

describe('buscarPacientePorDni', () => {
  it('solo para médicos y asistentes', async () => {
    await expect(service.buscarPacientePorDni({ dni: '30111222', requesterRol: 'paciente' })).rejects.toMatchObject({ status: 403 })
  })

  it('valida el DNI', async () => {
    await expect(service.buscarPacientePorDni({ dni: '12', requesterRol: 'medico' })).rejects.toMatchObject({ status: 400 })
  })

  it('devuelve null si no existe y el detalle si existe', async () => {
    repo.findPacienteByDni.mockResolvedValueOnce(null)
    await expect(service.buscarPacientePorDni({ dni: '30111222', requesterRol: 'medico' })).resolves.toBeNull()

    repo.findPacienteByDni.mockResolvedValueOnce({ id_paciente: 7 })
    await expect(service.buscarPacientePorDni({ dni: ' 30111222 ', requesterRol: 'asistente' })).resolves.toEqual(pacienteRow)
  })
})

describe('getHistorialPaciente', () => {
  beforeEach(() => {
    turnosRepo.listTurnosByPaciente.mockResolvedValue(['t'])
    repo.listRecetasByPaciente.mockResolvedValue(['r'])
    repo.listMensajesByPaciente.mockResolvedValue(['m'])
  })

  it('el médico ve solo lo que pasó con él', async () => {
    await expect(service.getHistorialPaciente({ idPaciente: 7, ...medico })).resolves.toEqual({ turnos: ['t'], recetas: ['r'], mensajes: ['m'] })
    expect(turnosRepo.listTurnosByPaciente).toHaveBeenCalledWith({ idPaciente: 7, idMedico: 3 })
    expect(repo.listRecetasByPaciente).toHaveBeenCalledWith(7, 3)
  })

  it('el admin ve todo', async () => {
    await service.getHistorialPaciente({ idPaciente: 7, requesterIdUsuario: 1, requesterRol: 'admin' })
    expect(turnosRepo.listTurnosByPaciente).toHaveBeenCalledWith({ idPaciente: 7, idMedico: null })
  })

  it('rechaza médicos no vinculados y otros roles', async () => {
    repo.pacienteVinculadoAMedico.mockResolvedValueOnce(false)
    await expect(service.getHistorialPaciente({ idPaciente: 7, ...medico })).rejects.toMatchObject({ status: 403 })
    await expect(service.getHistorialPaciente({ idPaciente: 7, ...asistente })).rejects.toMatchObject({ status: 403 })
  })

  it('responde 404 si no existe', async () => {
    repo.findPacienteById.mockResolvedValue(null)
    await expect(service.getHistorialPaciente({ idPaciente: 7, ...medico })).rejects.toMatchObject({ status: 404 })
  })
})

describe('solicitarReceta', () => {
  const args = { idMedico: '3', tipo: 'urgente', items: [{ medicamento: 'Ibuprofeno', dosis: '400mg' }], ...pacienteUser }

  beforeEach(() => repo.createRecetaSolicitud.mockResolvedValue({ id_solicitud: 1, estado: 'enviada' }))

  it('solo la piden pacientes a un médico válido', async () => {
    await expect(service.solicitarReceta({ ...args, ...medico })).rejects.toMatchObject({ status: 403 })
    await expect(service.solicitarReceta({ ...args, idMedico: 'x' })).rejects.toMatchObject({ status: 400 })
  })

  it('valida la cantidad de medicamentos', async () => {
    await expect(service.solicitarReceta({ ...args, items: [] })).rejects.toMatchObject({ status: 400 })
    await expect(service.solicitarReceta({ ...args, items: Array(6).fill({ medicamento: 'A' }) })).rejects.toMatchObject({
      status: 400,
      message: 'Máximo 5 medicamentos por solicitud',
    })
    await expect(service.solicitarReceta({ ...args, items: [{ medicamento: '' }] })).rejects.toMatchObject({ status: 400 })
  })

  it('exige membresía vigente del médico', async () => {
    membresias.assertMembershipNotExpiredByMedicoId.mockRejectedValue(new HttpError(402, 'vencida'))
    await expect(service.solicitarReceta(args)).rejects.toMatchObject({ status: 402 })
  })

  it('responde 404 sin paciente o sin médico', async () => {
    repo.findPacienteByUserId.mockResolvedValueOnce(null)
    await expect(service.solicitarReceta(args)).rejects.toMatchObject({ status: 404, message: 'Paciente no encontrado' })
    repo.findMedicoRecetaById.mockResolvedValueOnce(null)
    await expect(service.solicitarReceta(args)).rejects.toMatchObject({ status: 404, message: 'Médico no encontrado' })
  })

  it('guarda la solicitud y manda el mail', async () => {
    await expect(service.solicitarReceta(args)).resolves.toEqual({ id_solicitud: 1, estado: 'enviada', tipo: 'urgente' })
    expect(repo.createRecetaSolicitud).toHaveBeenCalledWith({
      idPaciente: 7,
      idMedico: 3,
      tipo: 'urgente',
      itemsJson: JSON.stringify([{ medicamento: 'Ibuprofeno', dosis: '400mg' }]),
      enviadoAEmail: 'doc@x.com',
    })
    expect(mailer.sendRecetaSolicitudEmail).toHaveBeenCalled()
  })

  it('cualquier tipo que no sea urgente es estándar', async () => {
    await expect(service.solicitarReceta({ ...args, tipo: 'rara' })).resolves.toMatchObject({ tipo: 'estandar' })
  })

  it('no manda mail si el médico lo desactivó', async () => {
    repo.findMedicoRecetaById.mockResolvedValue({ id_medico: 3, email: 'doc@x.com', enviar_recetas_mail: 0 })
    await service.solicitarReceta(args)
    expect(mailer.sendRecetaSolicitudEmail).not.toHaveBeenCalled()
  })
})

describe('solicitarMensaje', () => {
  const args = { idMedico: 3, asunto: 'Consulta', mensaje: 'Hola doctor', ...pacienteUser }

  beforeEach(() => repo.createMensajeSolicitud.mockResolvedValue({ id_solicitud: 2, estado: 'enviada' }))

  it('valida rol, médico y textos', async () => {
    await expect(service.solicitarMensaje({ ...args, ...medico })).rejects.toMatchObject({ status: 403 })
    await expect(service.solicitarMensaje({ ...args, idMedico: 0 })).rejects.toMatchObject({ status: 400 })
    await expect(service.solicitarMensaje({ ...args, asunto: '' })).rejects.toMatchObject({ status: 400 })
    await expect(service.solicitarMensaje({ ...args, mensaje: 'x'.repeat(2001) })).rejects.toMatchObject({ status: 400 })
  })

  it('responde 404 sin paciente o sin médico', async () => {
    repo.findPacienteByUserId.mockResolvedValueOnce(null)
    await expect(service.solicitarMensaje(args)).rejects.toMatchObject({ status: 404 })
    repo.findMedicoRecetaById.mockResolvedValueOnce(null)
    await expect(service.solicitarMensaje(args)).rejects.toMatchObject({ status: 404 })
  })

  it('guarda el mensaje y lo manda por mail', async () => {
    await expect(service.solicitarMensaje(args)).resolves.toEqual({ id_solicitud: 2, estado: 'enviada' })
    expect(mailer.sendPacienteMensajeEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'doc@x.com', asunto: 'Consulta' }))
    expect(membresias.assertMembershipNotExpiredByMedicoId).toHaveBeenCalledWith(3, 'No es posible enviar mensajes')
  })
})

describe('términos y condiciones del médico', () => {
  it('getTycByMedico valida rol, médico y paciente', async () => {
    await expect(service.getTycByMedico({ idMedico: 3, ...medico })).rejects.toMatchObject({ status: 403 })
    await expect(service.getTycByMedico({ idMedico: 'x', ...pacienteUser })).rejects.toMatchObject({ status: 400 })
    repo.findPacienteByUserId.mockResolvedValueOnce(null)
    await expect(service.getTycByMedico({ idMedico: 3, ...pacienteUser })).rejects.toMatchObject({ status: 404 })
  })

  it('sin TyC activos no requiere aceptación', async () => {
    repo.findActiveTycByMedico.mockResolvedValue(null)
    await expect(service.getTycByMedico({ idMedico: 3, ...pacienteUser })).resolves.toEqual({ requiere_aceptacion: false, tyc: null, aceptado: true })
  })

  it('con TyC informa si ya los aceptó', async () => {
    repo.findActiveTycByMedico.mockResolvedValue({ id_tyc: 4 })
    repo.hasPacienteAcceptedTyc.mockResolvedValue(false)
    await expect(service.getTycByMedico({ idMedico: 3, ...pacienteUser })).resolves.toEqual({
      requiere_aceptacion: true,
      tyc: { id_tyc: 4 },
      aceptado: false,
    })
    expect(repo.hasPacienteAcceptedTyc).toHaveBeenCalledWith({ idPaciente: 7, idTyc: 4 })
  })

  it('aceptarTycByMedico valida rol, médico, paciente y TyC', async () => {
    const args = { idMedico: 3, ...pacienteUser }
    await expect(service.aceptarTycByMedico({ ...args, ...medico })).rejects.toMatchObject({ status: 403 })
    await expect(service.aceptarTycByMedico({ ...args, idMedico: null })).rejects.toMatchObject({ status: 400 })
    repo.findPacienteByUserId.mockResolvedValueOnce(null)
    await expect(service.aceptarTycByMedico(args)).rejects.toMatchObject({ status: 404 })
    repo.findActiveTycByMedico.mockResolvedValueOnce(null)
    await expect(service.aceptarTycByMedico(args)).rejects.toMatchObject({ status: 404 })
  })

  it('rechaza aceptar una versión vieja', async () => {
    repo.findActiveTycByMedico.mockResolvedValue({ id_tyc: 4 })
    await expect(service.aceptarTycByMedico({ idMedico: 3, idTyc: 3, ...pacienteUser })).rejects.toMatchObject({ status: 400 })
  })

  it('registra la aceptación con la IP', async () => {
    repo.findActiveTycByMedico.mockResolvedValue({ id_tyc: 4 })
    await expect(service.aceptarTycByMedico({ idMedico: '3', idTyc: '4', ip: '1.2.3.4', ...pacienteUser })).resolves.toEqual({
      ok: true,
      id_tyc: 4,
      aceptado: true,
    })
    expect(repo.insertPacienteTycAceptacion).toHaveBeenCalledWith({ idPaciente: 7, idMedico: 3, idTyc: 4, ip: '1.2.3.4' })
  })
})
