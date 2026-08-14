const HttpError = require('../../utils/httpError')
const turnosRepo = require('./turnos.repository')
const { assertMembershipNotExpiredByMedicoId } = require('../membresias/membresias.service')
const { validateTextField } = require('../../utils/validators')

const ESTADOS_VALIDOS = new Set([
  'pendiente',
  'confirmado',
  'en_curso',
  'completado',
  'cancelado_paciente',
  'cancelado_clinica',
  'ausente',
])

async function crearTurno(input, authUser) {
  const required = ['id_clinica', 'fecha', 'hora']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }

  // El médico solo puede agendar en su propia agenda, sin importar lo que mande el body.
  let idMedico = input.id_medico ? Number(input.id_medico) : null
  if (authUser?.rol === 'medico') {
    idMedico = Number(await turnosRepo.findMedicoIdByUserId(authUser.idUsuario)) || null
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

  // Validar motivo_consulta si se proporciona
  const validatedMotivo = validateTextField(input.motivo_consulta, 500, 'El motivo de consulta', false)

  try {
    const idTurno = await turnosRepo.insertTurno({
      idPaciente,
      idMedico,
      idClinica: Number(input.id_clinica),
      idDisponibilidad: input.id_disponibilidad ? Number(input.id_disponibilidad) : null,
      fecha: input.fecha,
      hora: input.hora,
      motivoConsulta: validatedMotivo,
      duracionMinutos: input.duracion_minutos ? Number(input.duracion_minutos) : null,
      modificadoPor: authUser?.idUsuario || null,
    })

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

  const updated = await turnosRepo.updateTurnoEstado({
    idTurno: Number(idTurno),
    estadoNuevo,
    modificadoPor: authUser?.idUsuario || null,
    motivo: motivo || null,
  })

  if (!updated) {
    throw new HttpError(404, 'Turno no encontrado')
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

  let resolvedIdMedico = idMedico ? Number(idMedico) : null

  if (!resolvedIdMedico && requesterRol === 'medico') {
    resolvedIdMedico = await turnosRepo.findMedicoIdByUserId(requesterIdUsuario)
    if (!resolvedIdMedico) {
      throw new HttpError(404, 'Medico no encontrado')
    }
  }

  if (!resolvedIdMedico) {
    throw new HttpError(400, 'id_medico es obligatorio para este rol')
  }

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

  let resolvedIdMedico = idMedico ? Number(idMedico) : null

  if (!resolvedIdMedico && requesterRol === 'medico') {
    resolvedIdMedico = await turnosRepo.findMedicoIdByUserId(requesterIdUsuario)
    if (!resolvedIdMedico) {
      throw new HttpError(404, 'Medico no encontrado')
    }
  }

  if (!resolvedIdMedico) {
    throw new HttpError(400, 'id_medico es obligatorio para este rol')
  }

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
