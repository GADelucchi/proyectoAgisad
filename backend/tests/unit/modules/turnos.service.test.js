jest.mock('../../../src/modules/turnos/turnos.repository')
jest.mock('../../../src/modules/medicos/medicos.repository')
jest.mock('../../../src/modules/consultorios/consultorios.repository')
jest.mock('../../../src/modules/membresias/membresias.service')
jest.mock('../../../src/modules/acceso/acceso.repository')
jest.mock('../../../src/modules/medicos/medicos.service')
jest.mock('../../../src/utils/mailer', () => require('../../mocks/mailer'))

const turnosRepo = require('../../../src/modules/turnos/turnos.repository')
const medicosRepo = require('../../../src/modules/medicos/medicos.repository')
const consultoriosRepo = require('../../../src/modules/consultorios/consultorios.repository')
const membresias = require('../../../src/modules/membresias/membresias.service')
const accesoRepo = require('../../../src/modules/acceso/acceso.repository')
const medicosService = require('../../../src/modules/medicos/medicos.service')
const mailer = require('../../../src/utils/mailer')
const HttpError = require('../../../src/utils/httpError')
const service = require('../../../src/modules/turnos/turnos.service')

const paciente = { idUsuario: 50, rol: 'paciente' }
const medico = { idUsuario: 60, rol: 'medico' }
const asistente = { idUsuario: 61, rol: 'asistente' }
const admin = { idUsuario: 1, rol: 'admin' }

const baseInput = { id_medico: 3, id_clinica: 8, fecha: '2026-10-20', hora: '10:00' }

beforeEach(() => {
  turnosRepo.findPacienteIdByUserId.mockResolvedValue(77)
  accesoRepo.findMedicoIdByUserId.mockResolvedValue(3)
  medicosService.verificarHorarioDisponible.mockResolvedValue({ duracionMinutos: 30 })
  accesoRepo.findPermisosAsistente.mockResolvedValue({ agenda: 1, bloqueado: 0 })
  accesoRepo.medicoAtiendeEnClinica.mockResolvedValue(true)
  accesoRepo.gerenteTieneMedico.mockResolvedValue(true)
  turnosRepo.findTurnoById.mockResolvedValue({ id_turno: 900, id_paciente: 77, id_medico: 3, estado: 'pendiente' })
  turnosRepo.medicoPermiteTurnos.mockResolvedValue(true)
  turnosRepo.insertTurno.mockResolvedValue(900)
  turnosRepo.findMedicoNotifInfoById.mockResolvedValue({ email: 'doc@x.com', notif_turno_nuevo: 1, notif_cancelacion: 1 })
  turnosRepo.findTurnoResumenById.mockResolvedValue({
    id_medico: 3,
    paciente_nombre: 'Ana',
    paciente_apellido: 'Paz',
    fecha: '20/10/2026',
    hora: '10:00',
  })
  medicosRepo.findClinicaCompartida.mockResolvedValue({ compartido: 0 })
  membresias.assertMembershipNotExpiredByMedicoId.mockResolvedValue({})
  mailer.sendTurnoNuevoEmail.mockResolvedValue()
  mailer.sendTurnoCanceladoEmail.mockResolvedValue()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('crearTurno', () => {
  it.each(['id_clinica', 'fecha', 'hora'])('exige %s', async (field) => {
    const input = { ...baseInput, [field]: undefined }
    await expect(service.crearTurno(input, paciente)).rejects.toMatchObject({
      status: 400,
      message: `Falta el campo obligatorio: ${field}`,
    })
  })

  it('el paciente agenda para sí mismo, sin importar el id_paciente del body', async () => {
    await service.crearTurno({ ...baseInput, id_paciente: 999 }, paciente)

    expect(turnosRepo.findPacienteIdByUserId).toHaveBeenCalledWith(50)
    expect(turnosRepo.insertTurno).toHaveBeenCalledWith(
      expect.objectContaining({ idPaciente: 77, idMedico: 3, idClinica: 8, modificadoPor: 50 })
    )
  })

  it('el médico solo puede agendar en su propia agenda', async () => {
    accesoRepo.findMedicoIdByUserId.mockResolvedValue(4)

    await service.crearTurno({ ...baseInput, id_medico: 3, id_paciente: 12 }, medico)

    expect(turnosRepo.insertTurno).toHaveBeenCalledWith(expect.objectContaining({ idMedico: 4, idPaciente: 12 }))
  })

  it('falla si no se puede resolver el médico', async () => {
    await expect(service.crearTurno({ ...baseInput, id_medico: undefined }, paciente)).rejects.toMatchObject({
      status: 400,
      message: 'Falta el campo obligatorio: id_medico',
    })
  })

  it('falla si no se puede resolver el paciente', async () => {
    await expect(service.crearTurno(baseInput, asistente)).rejects.toMatchObject({
      status: 400,
      message: 'id_paciente invalido',
    })
  })

  it('responde 404 si el médico no existe y 403 si no tiene turnos habilitados', async () => {
    turnosRepo.medicoPermiteTurnos.mockResolvedValueOnce(null)
    await expect(service.crearTurno(baseInput, paciente)).rejects.toMatchObject({ status: 404 })

    turnosRepo.medicoPermiteTurnos.mockResolvedValueOnce(false)
    await expect(service.crearTurno(baseInput, paciente)).rejects.toMatchObject({ status: 403 })
  })

  it('propaga el error de membresía vencida', async () => {
    membresias.assertMembershipNotExpiredByMedicoId.mockRejectedValue(new HttpError(402, 'vencida'))
    await expect(service.crearTurno(baseInput, paciente)).rejects.toMatchObject({ status: 402 })
    expect(membresias.assertMembershipNotExpiredByMedicoId).toHaveBeenCalledWith(3, 'No es posible agendar turnos')
  })

  it('en un consultorio compartido no operativo rechaza la reserva', async () => {
    medicosRepo.findClinicaCompartida.mockResolvedValue({ compartido: 1 })
    consultoriosRepo.isConsultorioOperativo.mockResolvedValue(false)

    await expect(service.crearTurno(baseInput, paciente)).rejects.toMatchObject({
      status: 403,
      details: { code: 'CONSULTORIO_NO_OPERATIVO' },
    })
    expect(turnosRepo.insertTurno).not.toHaveBeenCalled()
  })

  it('en un consultorio compartido operativo agenda normalmente', async () => {
    medicosRepo.findClinicaCompartida.mockResolvedValue({ compartido: 1 })
    consultoriosRepo.isConsultorioOperativo.mockResolvedValue(true)

    await expect(service.crearTurno(baseInput, paciente)).resolves.toEqual({ id_turno: 900, estado: 'pendiente' })
  })

  it('valida el largo del motivo de consulta', async () => {
    await expect(service.crearTurno({ ...baseInput, motivo_consulta: 'x'.repeat(501) }, paciente)).rejects.toMatchObject({
      status: 400,
    })
  })

  it('rechaza un tipo de turno que no es del médico', async () => {
    turnosRepo.findTipoTurnoById.mockResolvedValue(null)
    await expect(service.crearTurno({ ...baseInput, id_tipo_turno: 5 }, paciente)).rejects.toMatchObject({
      status: 400,
      message: 'Tipo de turno invalido',
    })
    expect(turnosRepo.findTipoTurnoById).toHaveBeenCalledWith(5, 3)
  })

  it('pasa duración, disponibilidad y tipo al repositorio', async () => {
    turnosRepo.findTipoTurnoById.mockResolvedValue({ id_tipo_turno: 5, nombre: 'Control', notificar_nuevo: 0 })
    medicosService.verificarHorarioDisponible.mockResolvedValue({ duracionMinutos: 45 })

    await service.crearTurno(
      { ...baseInput, id_tipo_turno: 5, id_disponibilidad: '11', duracion_minutos: '45', motivo_consulta: ' Dolor ' },
      paciente
    )

    expect(turnosRepo.insertTurno).toHaveBeenCalledWith({
      idPaciente: 77,
      idMedico: 3,
      idClinica: 8,
      idTipoTurno: 5,
      idDisponibilidad: 11,
      fecha: '2026-10-20',
      hora: '10:00',
      motivoConsulta: 'Dolor',
      duracionMinutos: 45,
      modificadoPor: 50,
    })
  })

  describe('notificación de turno nuevo', () => {
    it('sin tipo de turno usa la preferencia general del médico', async () => {
      await service.crearTurno(baseInput, paciente)
      expect(mailer.sendTurnoNuevoEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'doc@x.com', paciente: { nombre: 'Ana', apellido: 'Paz' }, tipoNombre: null })
      )
    })

    it('no avisa si el médico lo desactivó', async () => {
      turnosRepo.findMedicoNotifInfoById.mockResolvedValue({ email: 'doc@x.com', notif_turno_nuevo: 0 })
      await service.crearTurno(baseInput, paciente)
      expect(mailer.sendTurnoNuevoEmail).not.toHaveBeenCalled()
    })

    it('con tipo de turno manda la preferencia del tipo', async () => {
      turnosRepo.findMedicoNotifInfoById.mockResolvedValue({ email: 'doc@x.com', notif_turno_nuevo: 0 })
      turnosRepo.findTipoTurnoById.mockResolvedValue({ id_tipo_turno: 5, nombre: 'Primera vez', notificar_nuevo: 1 })

      await service.crearTurno({ ...baseInput, id_tipo_turno: 5 }, paciente)

      expect(mailer.sendTurnoNuevoEmail).toHaveBeenCalledWith(expect.objectContaining({ tipoNombre: 'Primera vez' }))
    })

    it('un fallo del mail no rompe la reserva', async () => {
      mailer.sendTurnoNuevoEmail.mockRejectedValue(new Error('Resend caído'))
      await expect(service.crearTurno(baseInput, paciente)).resolves.toEqual({ id_turno: 900, estado: 'pendiente' })
      expect(console.error).toHaveBeenCalled()
    })
  })

  it('rechaza fechas inexistentes', async () => {
    await expect(service.crearTurno({ ...baseInput, fecha: '2026-02-30' }, paciente)).rejects.toMatchObject({ status: 400 })
    expect(turnosRepo.insertTurno).not.toHaveBeenCalled()
  })

  describe('el turno tiene que entrar en la agenda', () => {
    it('verifica el horario con la duración pedida', async () => {
      await service.crearTurno({ ...baseInput, duracion_minutos: '120' }, paciente)
      expect(medicosService.verificarHorarioDisponible).toHaveBeenCalledWith({
        idMedico: 3, idClinica: 8, fecha: '2026-10-20', hora: '10:00', duracionMinutos: 120,
      })
    })

    it('sin duración usa la del tipo de turno', async () => {
      turnosRepo.findTipoTurnoById.mockResolvedValue({ id_tipo_turno: 5, nombre: 'Primera vez', duracion_minutos: 60 })
      medicosService.verificarHorarioDisponible.mockResolvedValue({ duracionMinutos: 60 })

      await service.crearTurno({ ...baseInput, id_tipo_turno: 5 }, paciente)

      expect(medicosService.verificarHorarioDisponible).toHaveBeenCalledWith(expect.objectContaining({ duracionMinutos: 60 }))
      expect(turnosRepo.insertTurno).toHaveBeenCalledWith(expect.objectContaining({ duracionMinutos: 60 }))
    })

    it('sin duración ni tipo deja que se use la estándar del médico', async () => {
      medicosService.verificarHorarioDisponible.mockResolvedValue({ duracionMinutos: 20 })
      await service.crearTurno(baseInput, paciente)
      expect(medicosService.verificarHorarioDisponible).toHaveBeenCalledWith(expect.objectContaining({ duracionMinutos: null }))
      expect(turnosRepo.insertTurno).toHaveBeenCalledWith(expect.objectContaining({ duracionMinutos: 20 }))
    })

    it.each(['EXCEDE_HORARIO', 'FUERA_DE_AGENDA', 'HORARIO_BLOQUEADO'])('si el horario no sirve (%s) no se guarda', async (code) => {
      medicosService.verificarHorarioDisponible.mockRejectedValue(new HttpError(409, 'no', { code }))
      await expect(service.crearTurno(baseInput, paciente)).rejects.toMatchObject({ status: 409, details: { code } })
      expect(turnosRepo.insertTurno).not.toHaveBeenCalled()
    })
  })

  it('rechaza un consultorio que no es del médico', async () => {
    accesoRepo.medicoAtiendeEnClinica.mockResolvedValue(false)
    await expect(service.crearTurno(baseInput, paciente)).rejects.toMatchObject({
      status: 400,
      message: 'El consultorio indicado no corresponde al médico',
    })
    expect(accesoRepo.medicoAtiendeEnClinica).toHaveBeenCalledWith({ idMedico: 3, idClinica: 8 })
    expect(turnosRepo.insertTurno).not.toHaveBeenCalled()
  })

  describe('agendar en nombre de un médico', () => {
    const input = { ...baseInput, id_paciente: 12 }

    it('un asistente vinculado con permiso de agenda puede', async () => {
      await service.crearTurno(input, asistente)
      expect(accesoRepo.findPermisosAsistente).toHaveBeenCalledWith({ idUsuario: 61, idMedico: 3 })
      expect(turnosRepo.insertTurno).toHaveBeenCalledWith(expect.objectContaining({ idMedico: 3, idPaciente: 12 }))
    })

    it.each([
      ['no está vinculado', null],
      ['está bloqueado', { agenda: 1, bloqueado: 1 }],
      ['no tiene permiso de agenda', { agenda: 0, bloqueado: 0 }],
    ])('un asistente que %s no puede (403)', async (_caso, permisos) => {
      accesoRepo.findPermisosAsistente.mockResolvedValue(permisos)
      await expect(service.crearTurno(input, asistente)).rejects.toMatchObject({ status: 403 })
      expect(turnosRepo.insertTurno).not.toHaveBeenCalled()
    })

    it('un asistente tiene que indicar el médico', async () => {
      await expect(service.crearTurno({ ...input, id_medico: undefined }, asistente)).rejects.toMatchObject({ status: 400 })
    })

    it('el admin puede agendar para cualquier médico', async () => {
      await service.crearTurno({ ...input, id_medico: 9 }, admin)
      expect(turnosRepo.insertTurno).toHaveBeenCalledWith(expect.objectContaining({ idMedico: 9 }))
    })
  })

  it.each([
    ['ER_DUP_ENTRY', 'Ese horario ya fue tomado por otro turno'],
    ['TURNO_OVERLAP', 'Ese horario se superpone con otro turno existente'],
  ])('traduce %s a 409', async (code, message) => {
    turnosRepo.insertTurno.mockRejectedValue(Object.assign(new Error('db'), { code }))
    await expect(service.crearTurno(baseInput, paciente)).rejects.toMatchObject({ status: 409, message })
  })

  it('propaga otros errores de base', async () => {
    const dbError = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    turnosRepo.insertTurno.mockRejectedValue(dbError)
    await expect(service.crearTurno(baseInput, paciente)).rejects.toBe(dbError)
  })
})

describe('cambiarEstado', () => {
  beforeEach(() => {
    turnosRepo.updateTurnoEstado.mockResolvedValue({ id_turno: 900, estado: 'confirmado' })
  })

  it('rechaza estados desconocidos', async () => {
    await expect(service.cambiarEstado(900, 'cancelado', medico)).rejects.toMatchObject({ status: 400 })
    expect(turnosRepo.updateTurnoEstado).not.toHaveBeenCalled()
  })

  it.each(['pendiente', 'confirmado', 'en_curso', 'completado', 'ausente'])('acepta %s sin avisar cancelación', async (estado) => {
    await service.cambiarEstado('900', estado, medico, 'ok')
    expect(turnosRepo.updateTurnoEstado).toHaveBeenCalledWith({
      idTurno: 900,
      estadoNuevo: estado,
      modificadoPor: 60,
      motivo: 'ok',
    })
    expect(mailer.sendTurnoCanceladoEmail).not.toHaveBeenCalled()
  })

  it('responde 404 si el turno no existe', async () => {
    turnosRepo.findTurnoById.mockResolvedValueOnce(null)
    await expect(service.cambiarEstado(900, 'confirmado', medico)).rejects.toMatchObject({ status: 404 })
    expect(turnosRepo.updateTurnoEstado).not.toHaveBeenCalled()

    turnosRepo.updateTurnoEstado.mockResolvedValue(null)
    await expect(service.cambiarEstado(900, 'confirmado', medico)).rejects.toMatchObject({ status: 404 })
  })

  it('un médico no puede cambiar turnos de otro médico', async () => {
    accesoRepo.findMedicoIdByUserId.mockResolvedValue(4)
    await expect(service.cambiarEstado(900, 'cancelado_clinica', medico)).rejects.toMatchObject({ status: 403 })
    expect(turnosRepo.updateTurnoEstado).not.toHaveBeenCalled()
    expect(mailer.sendTurnoCanceladoEmail).not.toHaveBeenCalled()
  })

  it.each([
    ['sin vínculo con el médico del turno', null],
    ['bloqueado', { agenda: 1, bloqueado: 1 }],
  ])('un asistente %s no puede cambiar el estado', async (_caso, permisos) => {
    accesoRepo.findPermisosAsistente.mockResolvedValue(permisos)
    await expect(service.cambiarEstado(900, 'confirmado', asistente)).rejects.toMatchObject({ status: 403 })
    expect(accesoRepo.findPermisosAsistente).toHaveBeenCalledWith({ idUsuario: 61, idMedico: 3 })
  })

  it('un asistente vinculado y el admin sí pueden', async () => {
    await service.cambiarEstado(900, 'confirmado', asistente)
    await service.cambiarEstado(900, 'confirmado', admin)
    expect(turnosRepo.updateTurnoEstado).toHaveBeenCalledTimes(2)
  })

  it('al cancelar desde la clínica avisa al médico', async () => {
    turnosRepo.updateTurnoEstado.mockResolvedValue({ id_turno: 900, estado: 'cancelado_clinica' })

    await expect(service.cambiarEstado(900, 'cancelado_clinica', medico)).resolves.toEqual({
      id_turno: 900,
      estado: 'cancelado_clinica',
    })
    expect(mailer.sendTurnoCanceladoEmail).toHaveBeenCalledWith(expect.objectContaining({ canceladoPor: 'la clínica' }))
  })

  it('no avisa la cancelación si el médico lo desactivó', async () => {
    turnosRepo.findMedicoNotifInfoById.mockResolvedValue({ email: 'doc@x.com', notif_cancelacion: 0 })
    await service.cambiarEstado(900, 'cancelado_paciente', medico)
    expect(mailer.sendTurnoCanceladoEmail).not.toHaveBeenCalled()
  })

  it('un fallo del mail de cancelación no rompe el cambio de estado', async () => {
    mailer.sendTurnoCanceladoEmail.mockRejectedValue(new Error('caído'))
    await expect(service.cambiarEstado(900, 'cancelado_clinica', medico)).resolves.toBeDefined()
  })
})

describe.each([
  ['listarPorMedico', 'listTurnosByMedicoRange', 'No es posible ver los turnos'],
  ['listarHistorialPorMedico', 'listHistorialByMedicoRange', 'No es posible ver el historial de turnos'],
])('%s', (fnName, repoFn, membershipMessage) => {
  const rango = { desde: '2026-10-01', hasta: '2026-10-31' }

  beforeEach(() => {
    turnosRepo[repoFn].mockResolvedValue([{ id_turno: 1 }])
  })

  it('exige desde y hasta', async () => {
    await expect(service[fnName]({ desde: '2026-10-01' })).rejects.toMatchObject({ status: 400 })
  })

  it('el médico sin id_medico ve su propia agenda y se le valida la membresía', async () => {
    const rows = await service[fnName]({ ...rango, requesterIdUsuario: 60, requesterRol: 'medico' })

    expect(rows).toEqual([{ id_turno: 1 }])
    expect(turnosRepo[repoFn]).toHaveBeenCalledWith({ idMedico: 3, ...rango })
    expect(membresias.assertMembershipNotExpiredByMedicoId).toHaveBeenCalledWith(3, membershipMessage)
  })

  it('responde 404 si el usuario médico no tiene perfil', async () => {
    accesoRepo.findMedicoIdByUserId.mockResolvedValue(null)
    await expect(service[fnName]({ ...rango, requesterIdUsuario: 60, requesterRol: 'medico' })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('otros roles deben indicar id_medico', async () => {
    await expect(service[fnName]({ ...rango, requesterRol: 'asistente' })).rejects.toMatchObject({ status: 400 })
  })

  it('un médico no puede ver la agenda de otro', async () => {
    await expect(service[fnName]({ ...rango, idMedico: 9, requesterIdUsuario: 60, requesterRol: 'medico' })).rejects.toMatchObject({ status: 403 })
    expect(turnosRepo[repoFn]).not.toHaveBeenCalled()
  })

  it('un asistente sin vínculo no puede; uno bloqueado sí puede leer', async () => {
    accesoRepo.findPermisosAsistente.mockResolvedValueOnce(null)
    await expect(service[fnName]({ ...rango, idMedico: 3, requesterIdUsuario: 61, requesterRol: 'asistente' })).rejects.toMatchObject({ status: 403 })

    accesoRepo.findPermisosAsistente.mockResolvedValueOnce({ agenda: 1, bloqueado: 1 })
    await expect(service[fnName]({ ...rango, idMedico: 3, requesterIdUsuario: 61, requesterRol: 'asistente' })).resolves.toBeDefined()
  })

  it('un gerente solo ve médicos que atienden en sus clínicas', async () => {
    await service[fnName]({ ...rango, idMedico: 3, requesterIdUsuario: 70, requesterRol: 'gerente' })
    expect(accesoRepo.gerenteTieneMedico).toHaveBeenCalledWith({ idUsuario: 70, idMedico: 3 })

    accesoRepo.gerenteTieneMedico.mockResolvedValue(false)
    await expect(service[fnName]({ ...rango, idMedico: 3, requesterIdUsuario: 70, requesterRol: 'gerente' })).rejects.toMatchObject({ status: 403 })
  })

  it('un asistente con id_medico no pasa por la validación de membresía', async () => {
    await service[fnName]({ ...rango, idMedico: '9', requesterIdUsuario: 61, requesterRol: 'asistente' })
    expect(turnosRepo[repoFn]).toHaveBeenCalledWith({ idMedico: 9, ...rango })
    expect(membresias.assertMembershipNotExpiredByMedicoId).not.toHaveBeenCalled()
  })
})

describe('listarPorPaciente', () => {
  it('solo lo usan pacientes', async () => {
    await expect(service.listarPorPaciente({ requesterRol: 'medico' })).rejects.toMatchObject({ status: 403 })
  })

  it('responde 404 si no hay perfil de paciente', async () => {
    turnosRepo.findPacienteIdByUserId.mockResolvedValue(null)
    await expect(service.listarPorPaciente({ requesterIdUsuario: 50, requesterRol: 'paciente' })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('filtra opcionalmente por médico', async () => {
    turnosRepo.listTurnosByPaciente.mockResolvedValue([])
    await service.listarPorPaciente({ idMedico: '3', requesterIdUsuario: 50, requesterRol: 'paciente' })
    expect(turnosRepo.listTurnosByPaciente).toHaveBeenCalledWith({ idPaciente: 77, idMedico: 3 })

    await service.listarPorPaciente({ requesterIdUsuario: 50, requesterRol: 'paciente' })
    expect(turnosRepo.listTurnosByPaciente).toHaveBeenLastCalledWith({ idPaciente: 77, idMedico: null })
  })
})

describe('cancelarPorPaciente', () => {
  const args = { idTurno: '900', requesterIdUsuario: 50, requesterRol: 'paciente' }

  beforeEach(() => {
    turnosRepo.findTurnoById.mockResolvedValue({ id_turno: 900, id_paciente: 77, id_medico: 3 })
    turnosRepo.updateTurnoEstado.mockResolvedValue({ id_turno: 900, estado: 'cancelado_paciente' })
  })

  it('solo lo usan pacientes', async () => {
    await expect(service.cancelarPorPaciente({ ...args, requesterRol: 'medico' })).rejects.toMatchObject({ status: 403 })
  })

  it('responde 404 sin perfil de paciente o sin turno', async () => {
    turnosRepo.findPacienteIdByUserId.mockResolvedValueOnce(null)
    await expect(service.cancelarPorPaciente(args)).rejects.toMatchObject({ status: 404 })

    turnosRepo.findTurnoById.mockResolvedValueOnce(null)
    await expect(service.cancelarPorPaciente(args)).rejects.toMatchObject({ status: 404, message: 'Turno no encontrado' })
  })

  it('no deja cancelar turnos de otro paciente', async () => {
    turnosRepo.findTurnoById.mockResolvedValue({ id_turno: 900, id_paciente: 1, id_medico: 3 })
    await expect(service.cancelarPorPaciente(args)).rejects.toMatchObject({ status: 403 })
    expect(turnosRepo.updateTurnoEstado).not.toHaveBeenCalled()
  })

  it('no deja cancelar si el médico deshabilitó turnos', async () => {
    turnosRepo.medicoPermiteTurnos.mockResolvedValue(false)
    await expect(service.cancelarPorPaciente(args)).rejects.toMatchObject({ status: 403 })
  })

  it('cancela con motivo por defecto y avisa al médico', async () => {
    await expect(service.cancelarPorPaciente(args)).resolves.toEqual({ id_turno: 900, estado: 'cancelado_paciente' })

    expect(turnosRepo.updateTurnoEstado).toHaveBeenCalledWith({
      idTurno: 900,
      estadoNuevo: 'cancelado_paciente',
      modificadoPor: 50,
      motivo: 'Cancelado por paciente',
    })
    expect(mailer.sendTurnoCanceladoEmail).toHaveBeenCalledWith(expect.objectContaining({ canceladoPor: 'el paciente' }))
  })

  it('usa el motivo del paciente si lo manda', async () => {
    await service.cancelarPorPaciente({ ...args, motivo: 'Viaje' })
    expect(turnosRepo.updateTurnoEstado).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'Viaje' }))
  })

  it('responde 404 si el turno desaparece al actualizar', async () => {
    turnosRepo.updateTurnoEstado.mockResolvedValue(null)
    await expect(service.cancelarPorPaciente(args)).rejects.toMatchObject({ status: 404 })
  })
})
