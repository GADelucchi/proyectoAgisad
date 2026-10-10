const HttpError = require('../../utils/httpError')
const turnosRepo = require('./turnos.repository')
const medicosRepo = require('../medicos/medicos.repository')
const { assertMembershipNotExpiredByMedicoId } = require('../membresias/membresias.service')
const acceso = require('../acceso/acceso.service')
const medicosService = require('../medicos/medicos.service')
const { validateTextField, validateDate } = require('../../utils/validators')
const { sendTurnoNuevoEmail, sendTurnoCanceladoEmail } = require('../../utils/mailer')

const ESTADOS_VALIDOS = new Set([
  'pendiente',
  'confirmado',
  'en_curso',
  'completado',
  'cancelado_paciente',
  'cancelado_clinica',
  'ausente',
])

const ESTADOS_CANCELADOS = new Set(['cancelado_paciente', 'cancelado_clinica'])

async function notificarCancelacion(idTurno, canceladoPor) {
  try {
    const resumen = await turnosRepo.findTurnoResumenById(idTurno)
    if (!resumen) return

    const medicoInfo = await turnosRepo.findMedicoNotifInfoById(Number(resumen.id_medico))
    if (!medicoInfo?.email || !medicoInfo.notif_cancelacion) return

    await sendTurnoCanceladoEmail({
      to: medicoInfo.email,
      medico: medicoInfo,
      paciente: { nombre: resumen.paciente_nombre, apellido: resumen.paciente_apellido },
      fecha: resumen.fecha,
      hora: resumen.hora,
      canceladoPor,
    })
  } catch (err) {
    console.error('[turnos] no se pudo enviar el mail de cancelacion:', err.message)
  }
}

async function crearTurno(input, authUser) {
  const required = ['id_clinica', 'fecha', 'hora']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }
  validateDate(input.fecha, 'La fecha')

  // El paciente puede pedir turno con cualquier médico. El resto agenda en
  // nombre de un médico y tiene que tener acceso a su agenda: el médico solo
  // en la propia (sin importar lo que mande el body), el asistente en la de
  // un médico que lo vinculó y sin estar bloqueado.
  let idMedico = input.id_medico ? Number(input.id_medico) : null
  if (authUser?.rol !== 'paciente') {
    idMedico = await acceso.resolverMedicoAccesible({
      idMedico: authUser?.rol === 'medico' ? null : idMedico,
      requesterIdUsuario: authUser?.idUsuario,
      requesterRol: authUser?.rol,
      permiso: 'agenda',
    })
  }

  if (!idMedico) {
    throw new HttpError(400, 'Falta el campo obligatorio: id_medico')
  }

  let idPaciente = input.id_paciente ? Number(input.id_paciente) : null
  if (authUser?.rol === 'paciente') {
    idPaciente = await turnosRepo.findPacienteIdByUserId(authUser.idUsuario)
  }

  if (!idPaciente) {
    throw new HttpError(400, 'id_paciente invalido')
  }

  const puedeTomarTurnos = await turnosRepo.medicoPermiteTurnos(idMedico)
  if (puedeTomarTurnos === null) {
    throw new HttpError(404, 'Medico no encontrado')
  }
  if (!puedeTomarTurnos) {
    throw new HttpError(403, 'El medico seleccionado no tiene habilitado el modulo de turnos')
  }

  // Validar que el médico tenga membresía activa
  await assertMembershipNotExpiredByMedicoId(idMedico, 'No es posible agendar turnos')

  if (!(await acceso.medicoAtiendeEnClinica({ idMedico, idClinica: Number(input.id_clinica) }))) {
    throw new HttpError(400, 'El consultorio indicado no corresponde al médico')
  }

  // En un consultorio alquilado, además del médico tiene que estar al día el
  // dueño del espacio: si se le venció la membresía o dio de baja el adicional,
  // no se toman reservas nuevas (las ya agendadas no se tocan).
  const clinicaCompartida = await medicosRepo.findClinicaCompartida(Number(input.id_clinica))
  if (clinicaCompartida?.compartido) {
    const { isConsultorioOperativo } = require('../consultorios/consultorios.repository')
    const operativo = await isConsultorioOperativo(Number(input.id_clinica))
    if (!operativo) {
      throw new HttpError(
        403,
        'El consultorio no está disponible en este momento. Consultá con quien lo administra.',
        { code: 'CONSULTORIO_NO_OPERATIVO' }
      )
    }
  }

  // Validar motivo_consulta si se proporciona
  const validatedMotivo = validateTextField(input.motivo_consulta, 500, 'El motivo de consulta', false)

  let tipoTurnoInfo = null
  if (input.id_tipo_turno) {
    tipoTurnoInfo = await turnosRepo.findTipoTurnoById(Number(input.id_tipo_turno), idMedico)
    if (!tipoTurnoInfo) {
      throw new HttpError(400, 'Tipo de turno invalido')
    }
  }

  // El turno tiene que entrar en la agenda: horario de la grilla, libre y
  // terminando dentro del horario de atención. Si no viene la duración, manda
  // la del tipo de turno y, si tampoco hay tipo, la estándar del médico.
  const { duracionMinutos } = await medicosService.verificarHorarioDisponible({
    idMedico,
    idClinica: Number(input.id_clinica),
    fecha: input.fecha,
    hora: input.hora,
    duracionMinutos: Number(input.duracion_minutos) || Number(tipoTurnoInfo?.duracion_minutos) || null,
  })

  try {
    const idTurno = await turnosRepo.insertTurno({
      idPaciente,
      idMedico,
      idClinica: Number(input.id_clinica),
      idTipoTurno: tipoTurnoInfo?.id_tipo_turno || null,
      idDisponibilidad: input.id_disponibilidad ? Number(input.id_disponibilidad) : null,
      fecha: input.fecha,
      hora: input.hora,
      motivoConsulta: validatedMotivo,
      duracionMinutos,
      modificadoPor: authUser?.idUsuario || null,
    })

    try {
      const medicoInfo = await turnosRepo.findMedicoNotifInfoById(idMedico)
      const debeNotificar = tipoTurnoInfo
        ? Boolean(tipoTurnoInfo.notificar_nuevo)
        : Boolean(medicoInfo?.notif_turno_nuevo)

      if (medicoInfo?.email && debeNotificar) {
        const resumen = await turnosRepo.findTurnoResumenById(idTurno)
        await sendTurnoNuevoEmail({
          to: medicoInfo.email,
          medico: medicoInfo,
          paciente: { nombre: resumen?.paciente_nombre, apellido: resumen?.paciente_apellido },
          fecha: resumen?.fecha,
          hora: resumen?.hora,
          tipoNombre: tipoTurnoInfo?.nombre || null,
        })
      }
    } catch (err) {
      console.error('[turnos] no se pudo enviar el mail de turno nuevo:', err.message)
    }

    return {
      id_turno: idTurno,
      estado: 'pendiente',
    }
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Ese horario ya fue tomado por otro turno')
    }
    if (err && err.code === 'TURNO_OVERLAP') {
      throw new HttpError(409, 'Ese horario se superpone con otro turno existente')
    }
    throw err
  }
}

async function cambiarEstado(idTurno, estadoNuevo, authUser, motivo) {
  if (!ESTADOS_VALIDOS.has(estadoNuevo)) {
    throw new HttpError(400, 'Estado de turno invalido')
  }

  const turno = await turnosRepo.findTurnoById(Number(idTurno))
  if (!turno) {
    throw new HttpError(404, 'Turno no encontrado')
  }

  await acceso.resolverMedicoAccesible({
    idMedico: turno.id_medico,
    requesterIdUsuario: authUser?.idUsuario,
    requesterRol: authUser?.rol,
    permiso: 'agenda',
  })

  const updated = await turnosRepo.updateTurnoEstado({
    idTurno: Number(idTurno),
    estadoNuevo,
    modificadoPor: authUser?.idUsuario || null,
    motivo: motivo || null,
  })

  if (!updated) {
    throw new HttpError(404, 'Turno no encontrado')
  }

  if (ESTADOS_CANCELADOS.has(estadoNuevo)) {
    await notificarCancelacion(Number(idTurno), 'la clínica')
  }

  return {
    id_turno: updated.id_turno,
    estado: updated.estado,
  }
}

async function listarPorMedico({ idMedico, desde, hasta, requesterIdUsuario, requesterRol }) {
  if (!desde || !hasta) {
    throw new HttpError(400, 'desde y hasta son obligatorios')
  }

  // Leer la agenda: un asistente bloqueado la puede ver; un gerente, la de sus médicos.
  const resolvedIdMedico = await acceso.resolverMedicoAccesible({
    idMedico,
    requesterIdUsuario,
    requesterRol,
    permiso: 'agenda',
    permitirBloqueado: true,
  })

  // Si quien solicita es el médico, validar que tenga membresía activa
  if (requesterRol === 'medico') {
    await assertMembershipNotExpiredByMedicoId(resolvedIdMedico, 'No es posible ver los turnos')
  }

  return turnosRepo.listTurnosByMedicoRange({ idMedico: resolvedIdMedico, desde, hasta })
}

async function listarHistorialPorMedico({ idMedico, desde, hasta, requesterIdUsuario, requesterRol }) {
  if (!desde || !hasta) {
    throw new HttpError(400, 'desde y hasta son obligatorios')
  }

  // Leer la agenda: un asistente bloqueado la puede ver; un gerente, la de sus médicos.
  const resolvedIdMedico = await acceso.resolverMedicoAccesible({
    idMedico,
    requesterIdUsuario,
    requesterRol,
    permiso: 'agenda',
    permitirBloqueado: true,
  })

  // Si quien solicita es el médico, validar que tenga membresía activa
  if (requesterRol === 'medico') {
    await assertMembershipNotExpiredByMedicoId(resolvedIdMedico, 'No es posible ver el historial de turnos')
  }

  return turnosRepo.listHistorialByMedicoRange({ idMedico: resolvedIdMedico, desde, hasta })
}

async function listarPorPaciente({ idMedico, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'paciente') {
    throw new HttpError(403, 'Solo pacientes pueden listar sus turnos')
  }

  const idPaciente = await turnosRepo.findPacienteIdByUserId(requesterIdUsuario)
  if (!idPaciente) {
    throw new HttpError(404, 'Paciente no encontrado')
  }

  return turnosRepo.listTurnosByPaciente({
    idPaciente,
    idMedico: idMedico ? Number(idMedico) : null,
  })
}

async function cancelarPorPaciente({ idTurno, motivo, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'paciente') {
    throw new HttpError(403, 'Solo pacientes pueden cancelar turnos propios')
  }

  const idPaciente = await turnosRepo.findPacienteIdByUserId(requesterIdUsuario)
  if (!idPaciente) {
    throw new HttpError(404, 'Paciente no encontrado')
  }

  const turno = await turnosRepo.findTurnoById(Number(idTurno))
  if (!turno) {
    throw new HttpError(404, 'Turno no encontrado')
  }

  if (Number(turno.id_paciente) !== Number(idPaciente)) {
    throw new HttpError(403, 'Solo podés cancelar turnos propios')
  }

  const puedeTomarTurnos = await turnosRepo.medicoPermiteTurnos(Number(turno.id_medico))
  if (puedeTomarTurnos === false) {
    throw new HttpError(403, 'El medico seleccionado no tiene habilitado el modulo de turnos')
  }

  const updated = await turnosRepo.updateTurnoEstado({
    idTurno: Number(idTurno),
    estadoNuevo: 'cancelado_paciente',
    modificadoPor: requesterIdUsuario,
    motivo: motivo || 'Cancelado por paciente',
  })

  if (!updated) {
    throw new HttpError(404, 'Turno no encontrado')
  }

  await notificarCancelacion(Number(idTurno), 'el paciente')

  return {
    id_turno: updated.id_turno,
    estado: updated.estado,
  }
}

module.exports = {
  crearTurno,
  cambiarEstado,
  listarPorMedico,
  listarHistorialPorMedico,
  listarPorPaciente,
  cancelarPorPaciente,
}
