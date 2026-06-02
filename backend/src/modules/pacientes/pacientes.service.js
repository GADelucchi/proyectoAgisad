const HttpError = require('../../utils/httpError')
const {
  listPacientesByMedico,
  findPacienteById,
  findPacienteByUserId,
  findMedicoRecetaById,
  createRecetaSolicitud,
  updatePaciente,
  findMedicoIdByUserId,
  hasAsistenteAccessToMedico,
} = require('./pacientes.repository')
const { sendRecetaSolicitudEmail } = require('../../utils/mailer')

/**
 * Lista pacientes del médico (o asistente actuando en nombre de un médico).
 * Requiere id_medico en query string.
 */
async function listPacientes({ idMedico, search, requesterIdUsuario, requesterRol }) {
  const target = Number(idMedico)
  if (!target) throw new HttpError(400, 'Se requiere id_medico como parámetro')

  if (requesterRol === 'medico') {
    const medicoPropio = await findMedicoIdByUserId(requesterIdUsuario)
    if (!medicoPropio || Number(medicoPropio) !== target) {
      throw new HttpError(403, 'Solo podés acceder a tus propios pacientes')
    }
  }

  if (requesterRol === 'asistente') {
    const allowed = await hasAsistenteAccessToMedico({
      idUsuario: requesterIdUsuario,
      idMedico: target,
    })
    if (!allowed) {
      throw new HttpError(403, 'Solo podés acceder a pacientes de tu médico asignado')
    }
  }

  return listPacientesByMedico(target, search)
}

/**
 * Detalle de un paciente.
 * El propio paciente puede ver su perfil. Un médico/asistente puede ver cualquiera.
 */
async function getPaciente({ idPaciente, requesterIdUsuario, requesterRol }) {
  const paciente = await findPacienteById(Number(idPaciente))
  if (!paciente) throw new HttpError(404, 'Paciente no encontrado')

  // El paciente solo puede ver su propio perfil
  if (requesterRol === 'paciente' && paciente.id_usuario !== requesterIdUsuario) {
    throw new HttpError(403, 'Sin permisos para ver ese perfil')
  }

  return paciente
}

/**
 * Actualiza datos del paciente.
 * Solo el propio paciente puede modificar su perfil.
 */
async function patchPaciente({ idPaciente, fields, requesterIdUsuario, requesterRol }) {
  const paciente = await findPacienteById(Number(idPaciente))
  if (!paciente) throw new HttpError(404, 'Paciente no encontrado')

  if (requesterRol !== 'admin' && paciente.id_usuario !== requesterIdUsuario) {
    throw new HttpError(403, 'Solo podés editar tu propio perfil')
  }

  await updatePaciente(Number(idPaciente), fields)
  return findPacienteById(Number(idPaciente))
}

async function solicitarReceta({ idMedico, tipo, items, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'paciente') {
    throw new HttpError(403, 'Solo pacientes pueden solicitar recetas')
  }

  const targetMedico = Number(idMedico)
  if (!targetMedico) {
    throw new HttpError(400, 'id_medico invalido')
  }

  const tipoReceta = tipo === 'urgente' ? 'urgente' : 'estandar'
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'Debes agregar al menos un medicamento')
  }
  if (items.length > 5) {
    throw new HttpError(400, 'Máximo 5 medicamentos por solicitud')
  }

  const normalizedItems = items
    .map((item) => ({
      medicamento: String(item?.medicamento || '').trim(),
      dosis: String(item?.dosis || '').trim(),
    }))
    .filter((item) => item.medicamento)

  if (normalizedItems.length === 0) {
    throw new HttpError(400, 'Debes ingresar el nombre del medicamento')
  }

  const paciente = await findPacienteByUserId(requesterIdUsuario)
  if (!paciente) {
    throw new HttpError(404, 'Paciente no encontrado')
  }

  const medico = await findMedicoRecetaById(targetMedico)
  if (!medico) {
    throw new HttpError(404, 'Médico no encontrado')
  }

  const insert = await createRecetaSolicitud({
    idPaciente: paciente.id_paciente,
    idMedico: medico.id_medico,
    tipo: tipoReceta,
    itemsJson: JSON.stringify(normalizedItems),
    enviadoAEmail: medico.email,
  })

  await sendRecetaSolicitudEmail({
    to: medico.email,
    medico,
    paciente,
    tipo: tipoReceta,
    items: normalizedItems,
  })

  return {
    ...insert,
    tipo: tipoReceta,
  }
}

module.exports = {
  listPacientes,
  getPaciente,
  patchPaciente,
  solicitarReceta,
}
