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
  const required = ['id_paciente', 'id_medico', 'id_clinica', 'fecha', 'hora']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }

  try {
    const idTurno = await turnosRepo.insertTurno({
      idPaciente: Number(input.id_paciente),
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

module.exports = {
  crearTurno,
  cambiarEstado,
  listarPorMedico,
}
