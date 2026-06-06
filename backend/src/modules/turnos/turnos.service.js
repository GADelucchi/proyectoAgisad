const HttpError = require('../../utils/httpError')
const turnosRepo = require('./turnos.repository')

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
  const required = ['id_medico', 'id_clinica', 'fecha', 'hora']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }

  let idPaciente = input.id_paciente ? Number(input.id_paciente) : null
  if (authUser?.rol === 'paciente') {
    idPaciente = await turnosRepo.findPacienteIdByUserId(authUser.idUsuario)
  }

  if (!idPaciente) {
    throw new HttpError(400, 'id_paciente invalido')
  }

  try {
    const idTurno = await turnosRepo.insertTurno({
      idPaciente,
      idMedico: Number(input.id_medico),
      idClinica: Number(input.id_clinica),
      idDisponibilidad: input.id_disponibilidad ? Number(input.id_disponibilidad) : null,
      fecha: input.fecha,
      hora: input.hora,
      motivoConsulta: input.motivo_consulta || null,
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

async function listarPorMedico({ idMedico, desde, hasta }) {
  if (!idMedico || !desde || !hasta) {
    throw new HttpError(400, 'id_medico, desde y hasta son obligatorios')
  }
  return turnosRepo.listTurnosByMedicoRange({ idMedico: Number(idMedico), desde, hasta })
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
  listarPorPaciente,
  cancelarPorPaciente,
}
