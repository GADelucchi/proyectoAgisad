const { query } = require('../../db/query')

/**
 * Lista los pacientes vinculados al médico: los que tuvieron algún turno
 * y los cargados manualmente desde el panel.
 */
async function listPacientesByMedico(idMedico, search) {
  const like = search ? `%${search}%` : null

  let sql = `
    SELECT
      p.id_paciente,
      p.dni,
      p.nombre,
      p.apellido,
      p.telefono,
      DATE_FORMAT(p.fecha_nac, '%d/%m/%Y') AS fecha_nac,
      DATE_FORMAT(p.fecha_nac, '%Y-%m-%d') AS fecha_nac_iso,
      p.id_obra_social,
      p.nro_obra_social,
      os.nombre AS obra_social,
      u.email
    FROM pacientes p
    JOIN usuarios   u ON u.id_usuario = p.id_usuario
    LEFT JOIN obras_sociales os ON os.id_obra_social = p.id_obra_social
    WHERE (
      EXISTS (
        SELECT 1 FROM turnos t
        WHERE t.id_paciente = p.id_paciente AND t.id_medico = :idMedico
      )
      OR EXISTS (
        SELECT 1 FROM paciente_vinculos pv
        WHERE pv.id_paciente = p.id_paciente
          AND pv.id_medico = :idMedico
          AND pv.estado = 'activo'
      )
    )
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
 * Un paciente está "vinculado" a un médico si tuvo algún turno con él o
 * si existe una fila activa en paciente_vinculos (alta manual, etc.).
 */
async function pacienteVinculadoAMedico({ idPaciente, idMedico }) {
  const rows = await query(
    `SELECT 1
     WHERE EXISTS (
       SELECT 1 FROM turnos t
       WHERE t.id_paciente = :idPaciente AND t.id_medico = :idMedico
     )
     OR EXISTS (
       SELECT 1 FROM paciente_vinculos pv
       WHERE pv.id_paciente = :idPaciente
         AND pv.id_medico = :idMedico
         AND pv.estado = 'activo'
     )`,
    { idPaciente, idMedico }
  )
  return rows.length > 0
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
       DATE_FORMAT(p.fecha_nac, '%Y-%m-%d') AS fecha_nac_iso,
       p.id_obra_social,
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
       COALESCE(m.enviar_recetas_mail, 1) AS enviar_recetas_mail,
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
 * Solo se tocan las columnas presentes en `fields` (null borra el valor).
 */
async function updatePaciente(idPaciente, fields) {
  const editables = ['telefono', 'fecha_nac', 'nro_obra_social', 'id_obra_social']
  const params = { idPaciente }
  const asignaciones = []

  for (const columna of editables) {
    if (fields[columna] === undefined) continue
    asignaciones.push(`${columna} = :${columna}`)
    params[columna] = fields[columna]
  }

  if (asignaciones.length === 0) return

  await query(
    `UPDATE pacientes
     SET ${asignaciones.join(', ')}
     WHERE id_paciente = :idPaciente`,
    params
  )
}

async function listObrasSociales() {
  // "Sin cobertura" se representa con id_obra_social NULL, no como una fila del catálogo.
  return query(
    `SELECT id_obra_social, nombre
     FROM obras_sociales
     WHERE nombre <> 'Particular / Sin cobertura'
     ORDER BY nombre`
  )
}

/**
 * Devuelve el id de la obra social, creándola si el nombre no estaba en el catálogo.
 */
async function ensureObraSocialByNombre(nombre) {
  const limpio = String(nombre || '').trim().replace(/\s+/g, ' ')
  if (!limpio) return null

  const result = await query(
    `INSERT INTO obras_sociales (nombre)
     VALUES (:nombre)
     ON DUPLICATE KEY UPDATE id_obra_social = LAST_INSERT_ID(id_obra_social)`,
    { nombre: limpio }
  )
  return result.insertId
}

async function existsObraSocial(idObraSocial) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM obras_sociales
     WHERE id_obra_social = :idObraSocial
     LIMIT 1`,
    { idObraSocial }
  )
  return Boolean(rows[0])
}

async function listRecetasByPaciente(idPaciente, idMedico = null) {
  return query(
    `SELECT
       rs.id_solicitud,
       rs.id_medico,
       rs.tipo,
       rs.items_json,
       rs.estado,
       DATE_FORMAT(rs.creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en,
       m.nombre   AS medico_nombre,
       m.apellido AS medico_apellido
     FROM receta_solicitudes rs
     INNER JOIN medicos m ON m.id_medico = rs.id_medico
     WHERE rs.id_paciente = :idPaciente
       AND (:idMedico IS NULL OR rs.id_medico = :idMedico)
     ORDER BY rs.creado_en DESC`,
    { idPaciente, idMedico }
  )
}

async function listMensajesByPaciente(idPaciente, idMedico = null) {
  return query(
    `SELECT
       ms.id_solicitud,
       ms.id_medico,
       ms.asunto,
       ms.mensaje,
       ms.estado,
       DATE_FORMAT(ms.creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en,
       m.nombre   AS medico_nombre,
       m.apellido AS medico_apellido
     FROM mensaje_solicitudes ms
     INNER JOIN medicos m ON m.id_medico = ms.id_medico
     WHERE ms.id_paciente = :idPaciente
       AND (:idMedico IS NULL OR ms.id_medico = :idMedico)
     ORDER BY ms.creado_en DESC`,
    { idPaciente, idMedico }
  )
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

async function findPacienteByDni(dni) {
  const rows = await query(
    `SELECT id_paciente, id_usuario, dni, nombre, apellido
     FROM pacientes
     WHERE dni = :dni
     LIMIT 1`,
    { dni }
  )
  return rows[0] || null
}

async function findPrimeraClinicaByMedico(idMedico) {
  const rows = await query(
    `SELECT mc.id_clinica
     FROM medico_clinicas mc
     INNER JOIN clinicas c ON c.id_clinica = mc.id_clinica
     WHERE mc.id_medico = :idMedico
       AND mc.activo = 1
     ORDER BY c.nombre
     LIMIT 1`,
    { idMedico }
  )
  return rows[0]?.id_clinica || null
}

/**
 * Crea o reactiva el vínculo paciente ↔ médico para que aparezca en su listado.
 */
async function upsertPacienteVinculo({ idPaciente, idMedico, idClinica, origen = 'manual' }) {
  await query(
    `INSERT INTO paciente_vinculos (id_paciente, id_medico, id_clinica, origen, estado)
     VALUES (:idPaciente, :idMedico, :idClinica, :origen, 'activo')
     ON DUPLICATE KEY UPDATE estado = 'activo'`,
    { idPaciente, idMedico, idClinica, origen }
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
  listObrasSociales,
  existsObraSocial,
  listRecetasByPaciente,
  listMensajesByPaciente,
  findActiveTycByMedico,
  hasPacienteAcceptedTyc,
  insertPacienteTycAceptacion,
  findPacienteByDni,
  findPrimeraClinicaByMedico,
  upsertPacienteVinculo,
  ensureObraSocialByNombre,
  pacienteVinculadoAMedico,
}
