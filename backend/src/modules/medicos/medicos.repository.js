const { query } = require('../../db/query')

async function listMedicos({ q, idEspecialidad, idCiudad }) {
  const params = {
    q: q || null,
    idEspecialidad: idEspecialidad || null,
    idCiudad: idCiudad || null,
  }

  const sqlNewSchema = `
    SELECT
      m.id_medico,
      m.nombre,
      m.apellido,
      m.matricula,
      m.telefono,
      m.id_ciudad,
      c.nombre AS ciudad,
      e.nombre AS especialidad,
      u.email
    FROM medicos m
    INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
    LEFT JOIN ciudades c ON c.id_ciudad = m.id_ciudad
    LEFT JOIN especialidades e ON e.id_especialidad = m.id_especialidad
    WHERE 1=1
      AND (:idEspecialidad IS NULL OR m.id_especialidad = :idEspecialidad)
      AND (:idCiudad IS NULL OR m.id_ciudad = :idCiudad)
      AND (
        :q IS NULL
        OR m.nombre LIKE CONCAT('%', :q, '%')
        OR m.apellido LIKE CONCAT('%', :q, '%')
      )
    ORDER BY m.apellido, m.nombre
  `

  try {
    return await query(sqlNewSchema, params)
  } catch (err) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err

    const sqlOldSchema = `
      SELECT
        m.id_medico,
        m.nombre,
        m.apellido,
        m.matricula_prov AS matricula,
        m.telefono,
        m.id_ciudad,
        c.nombre AS ciudad,
        NULL AS especialidad,
        u.email
      FROM medicos m
      INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
      LEFT JOIN ciudades c ON c.id_ciudad = m.id_ciudad
      WHERE 1=1
        AND (:idCiudad IS NULL OR m.id_ciudad = :idCiudad)
        AND (
          :q IS NULL
          OR m.nombre LIKE CONCAT('%', :q, '%')
          OR m.apellido LIKE CONCAT('%', :q, '%')
        )
      ORDER BY m.apellido, m.nombre
    `

    return query(sqlOldSchema, params)
  }
}

async function findDisponibilidadByMedicoClinicaDia({ idMedico, idClinica, diaSemana }) {
  const sql = `
    SELECT id_disponibilidad,
           DATE_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
           DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin,
           duracion_turno
    FROM medico_disponibilidad
    WHERE id_medico = :idMedico
      AND id_clinica = :idClinica
      AND dia_semana = :diaSemana
      AND activo = 1
    ORDER BY hora_inicio
  `

  return query(sql, {
    idMedico,
    idClinica,
    diaSemana,
  })
}

async function findTurnosTomados({ idMedico, fecha }) {
  return query(
    `SELECT DATE_FORMAT(hora, '%H:%i') AS hora
     FROM turnos
     WHERE id_medico = :idMedico
       AND fecha = :fecha
       AND estado NOT IN ('cancelado_paciente', 'cancelado_clinica')`,
    { idMedico, fecha }
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

async function deactivateTycByMedico(idMedico) {
  await query(
    `UPDATE medico_tyc
     SET activo = 0
     WHERE id_medico = :idMedico
       AND activo = 1`,
    { idMedico }
  )
}

async function insertMedicoTyc({ idMedico, version, texto }) {
  const result = await query(
    `INSERT INTO medico_tyc (id_medico, version, texto, activo)
     VALUES (:idMedico, :version, :texto, 1)`,
    { idMedico, version, texto }
  )

  const rows = await query(
    `SELECT id_tyc, id_medico, version, texto, activo, creado_en
     FROM medico_tyc
     WHERE id_tyc = :idTyc
     LIMIT 1`,
    { idTyc: result.insertId }
  )
  return rows[0] || null
}

async function listClinicasByMedico(idMedico) {
  const clinics = await query(
    `SELECT
       c.id_clinica,
       c.nombre,
       c.direccion,
       ci.nombre AS ciudad
     FROM medico_clinicas mc
     INNER JOIN clinicas c ON c.id_clinica = mc.id_clinica
     LEFT JOIN ciudades ci ON ci.id_ciudad = c.id_ciudad
     WHERE mc.id_medico = :idMedico
       AND mc.activo = 1
     ORDER BY c.nombre`,
    { idMedico }
  )

  const disponibilidad = await query(
    `SELECT
       id_clinica,
       dia_semana,
       DATE_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
       DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin
     FROM medico_disponibilidad
     WHERE id_medico = :idMedico
       AND activo = 1
     ORDER BY id_clinica, dia_semana, hora_inicio`,
    { idMedico }
  )

  return { clinics, disponibilidad }
}

module.exports = {
  listMedicos,
  findDisponibilidadByMedicoClinicaDia,
  findTurnosTomados,
  findMedicoIdByUserId,
  findActiveTycByMedico,
  deactivateTycByMedico,
  insertMedicoTyc,
  listClinicasByMedico,
}
