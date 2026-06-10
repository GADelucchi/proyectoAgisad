const { query } = require('../../db/query')

/**
 * Lista los pacientes que tuvieron al menos un turno con el médico dado.
 */
async function listPacientesByMedico(idMedico, search) {
  const like = search ? `%${search}%` : null

  let sql = `
    SELECT DISTINCT
      p.id_paciente,
      p.dni,
      p.nombre,
      p.apellido,
      p.telefono,
      DATE_FORMAT(p.fecha_nac, '%d/%m/%Y') AS fecha_nac,
      u.email
    FROM pacientes p
    JOIN usuarios   u ON u.id_usuario = p.id_usuario
    JOIN turnos     t ON t.id_paciente = p.id_paciente
    WHERE t.id_medico = :idMedico
  `
  const params = { idMedico }

  if (like) {
    sql += ` AND (p.nombre LIKE :like OR p.apellido LIKE :like OR p.dni LIKE :like OR u.email LIKE :like)`
    params.like = like
  }

  sql += ` ORDER BY p.apellido, p.nombre`

  return query(sql, params)
}

/**
 * Obtiene el detalle de un paciente por su id.
 */
async function findPacienteById(idPaciente) {
  const rows = await query(
    `SELECT
       p.id_paciente,
       p.id_usuario,
       p.dni,
       p.nombre,
       p.apellido,
       p.telefono,
       DATE_FORMAT(p.fecha_nac, '%d/%m/%Y') AS fecha_nac,
       p.nro_obra_social,
       p.acepta_tyc,
       u.email,
       u.username,
       u.activo,
       os.nombre AS obra_social
     FROM pacientes    p
     JOIN usuarios     u  ON u.id_usuario    = p.id_usuario
     LEFT JOIN obras_sociales os ON os.id_obra_social = p.id_obra_social
     WHERE p.id_paciente = :idPaciente
     LIMIT 1`,
    { idPaciente }
  )
  return rows[0] || null
}

async function findPacienteByUserId(idUsuario) {
  const rows = await query(
    `SELECT
       p.id_paciente,
       p.id_usuario,
       p.nombre,
       p.apellido,
       p.dni,
       p.nro_obra_social,
       os.nombre AS obra_social,
       u.email
     FROM pacientes p
     INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
     LEFT JOIN obras_sociales os ON os.id_obra_social = p.id_obra_social
     WHERE p.id_usuario = :idUsuario
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0] || null
}

async function findMedicoRecetaById(idMedico) {
  const rows = await query(
    `SELECT
       m.id_medico,
       m.nombre,
       m.apellido,
       u.email,
       e.nombre AS especialidad
     FROM medicos m
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     LEFT JOIN especialidades e ON e.id_especialidad = m.id_especialidad
     WHERE m.id_medico = :idMedico
       AND u.activo = 1
     LIMIT 1`,
    { idMedico }
  )
  return rows[0] || null
}

async function createRecetaSolicitud({ idPaciente, idMedico, tipo, itemsJson, enviadoAEmail }) {
  const result = await query(
    `INSERT INTO receta_solicitudes (id_paciente, id_medico, tipo, items_json, enviado_a_email)
     VALUES (:idPaciente, :idMedico, :tipo, CAST(:itemsJson AS JSON), :enviadoAEmail)`,
    { idPaciente, idMedico, tipo, itemsJson, enviadoAEmail }
  )

  return {
    id_solicitud: result.insertId,
    estado: 'enviada',
  }
}

async function createMensajeSolicitud({ idPaciente, idMedico, asunto, mensaje, enviadoAEmail }) {
  const result = await query(
    `INSERT INTO mensaje_solicitudes (id_paciente, id_medico, asunto, mensaje, enviado_a_email)
     VALUES (:idPaciente, :idMedico, :asunto, :mensaje, :enviadoAEmail)`,
    { idPaciente, idMedico, asunto, mensaje, enviadoAEmail }
  )

  return {
    id_solicitud: result.insertId,
    estado: 'enviada',
  }
}

/**
 * Actualiza los campos editables del perfil del paciente.
 */
async function updatePaciente(idPaciente, fields) {
  const { telefono, fecha_nac, nro_obra_social, id_obra_social } = fields
  await query(
    `UPDATE pacientes
     SET telefono        = COALESCE(:telefono, telefono),
         fecha_nac       = COALESCE(:fecha_nac, fecha_nac),
         nro_obra_social = COALESCE(:nro_obra_social, nro_obra_social),
         id_obra_social  = COALESCE(:id_obra_social, id_obra_social)
     WHERE id_paciente = :idPaciente`,
    { idPaciente, telefono, fecha_nac, nro_obra_social, id_obra_social }
  )
}

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

async function hasAsistenteAccessToMedico({ idUsuario, idMedico }) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM asistentes a
     INNER JOIN asistente_permisos ap ON ap.id_asistente = a.id_asistente
     WHERE a.id_usuario = :idUsuario
       AND ap.id_medico = :idMedico
       AND ap.bloqueado = 0
     LIMIT 1`,
    { idUsuario, idMedico }
  )
  return Boolean(rows[0])
}

async function findActiveTycByMedico(idMedico) {
  const rows = await query(
    `SELECT id_tyc, id_medico, version, texto, activo, creado_en
     FROM medico_tyc
     WHERE id_medico = :idMedico
       AND activo = 1
     ORDER BY version DESC
     LIMIT 1`,
    { idMedico }
  )
  return rows[0] || null
}

async function hasPacienteAcceptedTyc({ idPaciente, idTyc }) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM paciente_tyc_aceptaciones
     WHERE id_paciente = :idPaciente
       AND id_tyc = :idTyc
     LIMIT 1`,
    { idPaciente, idTyc }
  )
  return Boolean(rows[0])
}

async function insertPacienteTycAceptacion({ idPaciente, idMedico, idTyc, ip }) {
  await query(
    `INSERT INTO paciente_tyc_aceptaciones (id_paciente, id_medico, id_tyc, ip)
     VALUES (:idPaciente, :idMedico, :idTyc, :ip)
     ON DUPLICATE KEY UPDATE aceptado_en = CURRENT_TIMESTAMP, ip = VALUES(ip)`,
    { idPaciente, idMedico, idTyc, ip: ip || null }
  )
}

module.exports = {
  listPacientesByMedico,
  findPacienteById,
  findPacienteByUserId,
  findMedicoRecetaById,
  createRecetaSolicitud,
  createMensajeSolicitud,
  updatePaciente,
  findMedicoIdByUserId,
  hasAsistenteAccessToMedico,
  findActiveTycByMedico,
  hasPacienteAcceptedTyc,
  insertPacienteTycAceptacion,
}
