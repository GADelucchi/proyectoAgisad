const HttpError = require('../../utils/httpError')
const {
  listAsistentesByMedico,
  findAsistenteById,
  upsertPermisos,
  findMedicoIdByUserId,
  findAsistenteIdByUserId,
} = require('./asistentes.repository')
const { query } = require('../../db/query')

/**
 * Lista los asistentes de un médico.
 */
async function listAsistentes({ idMedico, requesterIdUsuario, requesterRol }) {
  const target = Number(idMedico)
  if (!target) throw new HttpError(400, 'Se requiere id_medico como parámetro')

  if (requesterRol === 'medico') {
    const medicoPropio = await findMedicoIdByUserId(requesterIdUsuario)
    if (!medicoPropio || Number(medicoPropio) !== target) {
      throw new HttpError(403, 'Solo podés listar tus asistentes')
    }
  }

  return listAsistentesByMedico(target)
}

/**
 * Detalle de un asistente.
 */
async function getAsistente({ idAsistente, requesterIdUsuario, requesterRol }) {
  if (requesterRol === 'asistente') {
    const ownAsistenteId = await findAsistenteIdByUserId(requesterIdUsuario)
    if (!ownAsistenteId || Number(ownAsistenteId) !== Number(idAsistente)) {
      throw new HttpError(403, 'Solo podés ver tu propio perfil de asistente')
    }
  }

  const asistente = await findAsistenteById(Number(idAsistente))
  if (!asistente) throw new HttpError(404, 'Asistente no encontrado')
  return asistente
}

/**
 * Actualiza los permisos de un asistente para el médico autenticado.
 */
async function patchPermisos({ idAsistente, idMedico, permisos, requesterIdUsuario, requesterRol }) {
  const target = Number(idMedico)
  if (!target) throw new HttpError(400, 'id_medico es obligatorio')

  if (requesterRol === 'medico') {
    const medicoPropio = await findMedicoIdByUserId(requesterIdUsuario)
    if (!medicoPropio || Number(medicoPropio) !== target) {
      throw new HttpError(403, 'Solo podés modificar permisos de tus asistentes')
    }
  }

  const asistente = await findAsistenteById(Number(idAsistente))
  if (!asistente) throw new HttpError(404, 'Asistente no encontrado')

  await upsertPermisos(Number(idAsistente), target, permisos)

  // Devuelve los permisos actualizados
  const rows = await query(
    `SELECT * FROM asistente_permisos
     WHERE id_asistente = :idAsistente AND id_medico = :idMedico`,
    { idAsistente: Number(idAsistente), idMedico: target }
  )
  return rows[0] || null
}

module.exports = {
  listAsistentes,
  getAsistente,
  patchPermisos,
}
