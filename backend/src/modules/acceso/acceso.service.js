const HttpError = require('../../utils/httpError')
const repo = require('./acceso.repository')

/**
 * Resuelve sobre qué médico opera quien hace el pedido y verifica que pueda
 * hacerlo. Es el único lugar donde se decide el acceso de un usuario a los
 * datos de un médico (agenda, turnos, pacientes).
 *
 * - medico: solo sobre sí mismo. Sin id_medico se usa el propio.
 * - asistente: sobre los médicos que lo vincularon. `permiso` exige ese
 *   permiso (ej. 'agenda'); un asistente bloqueado solo pasa con
 *   `permitirBloqueado` (el médico lo deja ver la agenda, no operar).
 * - gerente: solo lectura (`permitirBloqueado`), sobre médicos que atienden en sus clínicas.
 * - admin: sobre cualquiera.
 *
 * @returns {Promise<number>} id_medico sobre el que se opera
 */
async function resolverMedicoAccesible({
  idMedico,
  requesterIdUsuario,
  requesterRol,
  permiso = null,
  permitirBloqueado = false,
}) {
  const pedido = Number(idMedico) || null

  if (requesterRol === 'medico') {
    const propio = Number(await repo.findMedicoIdByUserId(requesterIdUsuario)) || null
    if (!propio) throw new HttpError(404, 'Médico no encontrado')
    if (pedido && pedido !== propio) {
      throw new HttpError(403, 'No tenés acceso a los datos de otro médico')
    }
    return propio
  }

  if (!pedido) throw new HttpError(400, 'Se requiere id_medico')

  if (requesterRol === 'admin') return pedido

  if (requesterRol === 'asistente') {
    const permisos = await repo.findPermisosAsistente({ idUsuario: requesterIdUsuario, idMedico: pedido })
    if (!permisos) throw new HttpError(403, 'No tenés acceso a los datos de ese médico')
    if (Number(permisos.bloqueado) && !permitirBloqueado) {
      throw new HttpError(403, 'Tu usuario está bloqueado por el médico')
    }
    if (permiso && !Number(permisos[permiso])) {
      throw new HttpError(403, 'No tenés permiso para esta sección')
    }
    return pedido
  }

  if (requesterRol === 'gerente' && permitirBloqueado) {
    if (!(await repo.gerenteTieneMedico({ idUsuario: requesterIdUsuario, idMedico: pedido }))) {
      throw new HttpError(403, 'Ese médico no atiende en tus clínicas')
    }
    return pedido
  }

  throw new HttpError(403, 'No tenés permisos para esta acción')
}

async function findMedicoIdByUserId(idUsuario) {
  return repo.findMedicoIdByUserId(idUsuario)
}

async function medicoAtiendeEnClinica({ idMedico, idClinica }) {
  return repo.medicoAtiendeEnClinica({ idMedico, idClinica })
}

async function gerenteTieneMedico({ idUsuario, idMedico }) {
  return repo.gerenteTieneMedico({ idUsuario, idMedico })
}

module.exports = {
  resolverMedicoAccesible,
  findMedicoIdByUserId,
  medicoAtiendeEnClinica,
  gerenteTieneMedico,
}
