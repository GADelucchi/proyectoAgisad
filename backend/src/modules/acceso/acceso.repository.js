const { query } = require('../../db/query')

async function findMedicoIdByUserId(idUsuario) {
  const rows = await query(
    `SELECT id_medico
     FROM medicos
     WHERE id_usuario = :idUsuario
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0]?.id_medico || null
}

/** Permisos del asistente sobre ese médico, o null si el médico no lo vinculó. */
async function findPermisosAsistente({ idUsuario, idMedico }) {
  const rows = await query(
    `SELECT ap.agenda, ap.pacientes, ap.mensajes, ap.recetas, ap.configuracion, ap.bloqueado
     FROM asistentes a
     INNER JOIN asistente_permisos ap ON ap.id_asistente = a.id_asistente
     WHERE a.id_usuario = :idUsuario
       AND ap.id_medico = :idMedico
     LIMIT 1`,
    { idUsuario, idMedico }
  )
  return rows[0] || null
}

/** ¿El médico atiende (activo) en alguna clínica del gerente? */
async function gerenteTieneMedico({ idUsuario, idMedico }) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM gerentes g
     INNER JOIN gerente_clinicas gc ON gc.id_gerente = g.id_gerente AND gc.activo = 1
     INNER JOIN medico_clinicas mc ON mc.id_clinica = gc.id_clinica AND mc.activo = 1
     WHERE g.id_usuario = :idUsuario
       AND mc.id_medico = :idMedico
     LIMIT 1`,
    { idUsuario, idMedico }
  )
  return Boolean(rows[0])
}

/** ¿El médico atiende (activo) en ese consultorio, propio o alquilado? */
async function medicoAtiendeEnClinica({ idMedico, idClinica }) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM medico_clinicas
     WHERE id_medico = :idMedico
       AND id_clinica = :idClinica
       AND activo = 1
     LIMIT 1`,
    { idMedico, idClinica }
  )
  return Boolean(rows[0])
}

module.exports = {
  findMedicoIdByUserId,
  findPermisosAsistente,
  gerenteTieneMedico,
  medicoAtiendeEnClinica,
}
