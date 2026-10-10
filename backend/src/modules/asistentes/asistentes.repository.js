const { query } = require('../../db/query')

/**
 * Lista los asistentes de un médico junto con sus permisos.
 * La relación se establece a través de asistente_permisos.
 */
async function listAsistentesByMedico(idMedico) {
  return query(
    `SELECT
       a.id_asistente,
       a.nombre,
       a.apellido,
       u.email,
       u.username,
       u.activo,
       ap.agenda,
       ap.pacientes,
       ap.mensajes,
       ap.recetas,
       ap.configuracion,
       ap.bloqueado
     FROM asistente_permisos  ap
     JOIN asistentes          a  ON a.id_asistente = ap.id_asistente
     JOIN usuarios            u  ON u.id_usuario   = a.id_usuario
     WHERE ap.id_medico = :idMedico
     ORDER BY a.apellido, a.nombre`,
    { idMedico }
  )
}

/**
 * Detalle de un asistente.
 */
async function findAsistenteById(idAsistente) {
  const rows = await query(
    `SELECT
       a.id_asistente,
       a.nombre,
       a.apellido,
       a.id_usuario,
       u.email,
       u.username,
       u.activo
     FROM asistentes a
     JOIN usuarios   u ON u.id_usuario = a.id_usuario
     WHERE a.id_asistente = :idAsistente
     LIMIT 1`,
    { idAsistente }
  )
  return rows[0] || null
}

/**
 * Inserta o actualiza los permisos de un asistente para un médico.
 */
/** Ejecuta en la conexión de una transacción si se la pasan; si no, en el pool. */
function ejecutar(conn, sql, params) {
  return conn ? conn.execute(sql, params) : query(sql, params)
}

async function upsertPermisos(idAsistente, idMedico, permisos, conn = null) {
  const {
    agenda = 1,
    pacientes = 0,
    mensajes = 0,
    recetas = 0,
    configuracion = 0,
    bloqueado = 0,
  } = permisos

  await ejecutar(
    conn,
    `INSERT INTO asistente_permisos
       (id_asistente, id_medico, agenda, pacientes, mensajes, recetas, configuracion, bloqueado)
     VALUES (:idAsistente, :idMedico, :agenda, :pacientes, :mensajes, :recetas, :configuracion, :bloqueado)
     ON DUPLICATE KEY UPDATE
       agenda        = VALUES(agenda),
       pacientes     = VALUES(pacientes),
       mensajes      = VALUES(mensajes),
       recetas       = VALUES(recetas),
       configuracion = VALUES(configuracion),
       bloqueado     = VALUES(bloqueado)`,
    { idAsistente, idMedico, agenda, pacientes, mensajes, recetas, configuracion, bloqueado }
  )
}

async function findGerenteIdByUserId(idUsuario) {
  const rows = await query(
    `SELECT id_gerente
     FROM gerentes
     WHERE id_usuario = :idUsuario
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0]?.id_gerente || null
}

async function findClinicasByMedicoId(idMedico) {
  return query(
    `SELECT mc.id_clinica
     FROM medico_clinicas mc
     WHERE mc.id_medico = :idMedico
       AND mc.activo = 1`,
    { idMedico }
  )
}

async function findClinicasByGerenteId(idGerente) {
  return query(
    `SELECT gc.id_clinica
     FROM gerente_clinicas gc
     WHERE gc.id_gerente = :idGerente
       AND gc.activo = 1`,
    { idGerente }
  )
}

async function findAsistenteIdByUserId(idUsuario) {
  const rows = await query(
    `SELECT id_asistente
     FROM asistentes
     WHERE id_usuario = :idUsuario
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0]?.id_asistente || null
}

async function insertAsistenteClinica(idAsistente, idClinica, conn = null) {
  await ejecutar(
    conn,
    `INSERT INTO asistente_clinicas (id_asistente, id_clinica)
     VALUES (:idAsistente, :idClinica)
     ON DUPLICATE KEY UPDATE activo = 1`,
    { idAsistente, idClinica }
  )
}

/** ¿El médico tiene vinculado a este asistente? */
async function asistenteVinculadoAMedico({ idAsistente, idMedico }) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM asistente_permisos
     WHERE id_asistente = :idAsistente
       AND id_medico = :idMedico
     LIMIT 1`,
    { idAsistente, idMedico }
  )
  return Boolean(rows[0])
}

async function findAsistenteAccessByUserId(idUsuario) {
  const rows = await query(
    `SELECT
       a.id_asistente,
       ap.id_medico,
       ap.agenda,
       ap.pacientes,
       ap.mensajes,
       ap.recetas,
       ap.configuracion,
       ap.bloqueado
     FROM asistentes a
     INNER JOIN asistente_permisos ap ON ap.id_asistente = a.id_asistente
     WHERE a.id_usuario = :idUsuario
     ORDER BY ap.id_medico
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0] || null
}

module.exports = {
  listAsistentesByMedico,
  findAsistenteById,
  upsertPermisos,
  findGerenteIdByUserId,
  findClinicasByMedicoId,
  findClinicasByGerenteId,
  insertAsistenteClinica,
  asistenteVinculadoAMedico,
  findAsistenteIdByUserId,
  findAsistenteAccessByUserId,
}
