const { query, pool } = require('../../db/query')

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

async function findExtraDisponibilidadByMedicoClinicaFecha({ idMedico, idClinica, fecha }) {
  return query(
    `SELECT
       id_excepcion,
       DATE_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
       DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin
     FROM medico_disponibilidad_excepciones
     WHERE id_medico = :idMedico
       AND id_clinica = :idClinica
       AND fecha = :fecha
       AND tipo = 'extra'
     ORDER BY hora_inicio`,
    { idMedico, idClinica, fecha }
  )
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
       c.link,
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

  const disponibilidadUnica = await query(
    `SELECT
       id_clinica,
       DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
       DATE_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
       DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin
     FROM medico_disponibilidad_excepciones
     WHERE id_medico = :idMedico
       AND tipo = 'extra'
     ORDER BY id_clinica, fecha, hora_inicio`,
    { idMedico }
  )

  return { clinics, disponibilidad, disponibilidadUnica }
}

async function findMedicoByUserId(idUsuario) {
  const rows = await query(
    `SELECT id_medico, id_ciudad
     FROM medicos
     WHERE id_usuario = :idUsuario
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0] || null
}

async function findAnyCityId() {
  const rows = await query(
    `SELECT id_ciudad
     FROM ciudades
     ORDER BY id_ciudad
     LIMIT 1`
  )
  return rows[0]?.id_ciudad || null
}

async function ensureMedicoHasClinica({ idMedico, idClinica }) {
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

async function createClinicaWithDisponibilidad({ idMedico, idCiudad, nombre, direccion, link, tipo, rangosSemanales, rangosUnicos }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const isVirtual = String(tipo || '').toLowerCase() === 'virtual'
    const direccionClinica = isVirtual ? null : (direccion || null)
    const linkClinica = isVirtual ? (link || direccion || null) : (link || null)

    const [insertClinica] = await conn.execute(
      `INSERT INTO clinicas (nombre, id_ciudad, direccion, link)
       VALUES (?, ?, ?, ?)`,
      [nombre, idCiudad, direccionClinica, linkClinica]
    )

    const idClinica = insertClinica.insertId

    await conn.execute(
      `INSERT INTO medico_clinicas (id_medico, id_clinica, activo)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE activo = 1`,
      [idMedico, idClinica]
    )

    for (const r of rangosSemanales) {
      await conn.execute(
        `INSERT INTO medico_disponibilidad
           (id_medico, id_clinica, dia_semana, hora_inicio, hora_fin, duracion_turno, activo)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [idMedico, idClinica, r.diaSemana, r.inicio, r.fin, r.duracion]
      )
    }

    for (const r of rangosUnicos) {
      await conn.execute(
        `INSERT INTO medico_disponibilidad_excepciones
           (id_medico, id_clinica, fecha, hora_inicio, hora_fin, tipo, motivo)
         VALUES (?, ?, ?, ?, ?, 'extra', ?)`,
        [idMedico, idClinica, r.fecha, r.inicio, r.fin, 'Agenda unica']
      )
    }

    await conn.commit()
    return { id_clinica: idClinica, tipo }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function updateClinicaWithDisponibilidad({ idMedico, idClinica, nombre, direccion, link, tipo, rangosSemanales, rangosUnicos }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const isVirtual = String(tipo || '').toLowerCase() === 'virtual'
    const direccionClinica = isVirtual ? null : (direccion || null)
    const linkClinica = isVirtual ? (link || direccion || null) : (link || null)

    await conn.execute(
      `UPDATE clinicas
       SET nombre = ?, direccion = ?, link = ?
       WHERE id_clinica = ?`,
      [nombre, direccionClinica, linkClinica, idClinica]
    )

    await conn.execute(
      `UPDATE medico_disponibilidad
       SET activo = 0
       WHERE id_medico = ? AND id_clinica = ?`,
      [idMedico, idClinica]
    )

    for (const r of rangosSemanales) {
      await conn.execute(
        `INSERT INTO medico_disponibilidad
           (id_medico, id_clinica, dia_semana, hora_inicio, hora_fin, duracion_turno, activo)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [idMedico, idClinica, r.diaSemana, r.inicio, r.fin, r.duracion]
      )
    }

    await conn.execute(
      `DELETE FROM medico_disponibilidad_excepciones
       WHERE id_medico = ?
         AND id_clinica = ?
         AND tipo = 'extra'`,
      [idMedico, idClinica]
    )

    for (const r of rangosUnicos) {
      await conn.execute(
        `INSERT INTO medico_disponibilidad_excepciones
           (id_medico, id_clinica, fecha, hora_inicio, hora_fin, tipo, motivo)
         VALUES (?, ?, ?, ?, ?, 'extra', ?)`,
        [idMedico, idClinica, r.fecha, r.inicio, r.fin, 'Agenda unica']
      )
    }

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function deleteClinicaByMedico({ idMedico, idClinica }) {
  await query(
    `UPDATE medico_clinicas
     SET activo = 0
     WHERE id_medico = :idMedico
       AND id_clinica = :idClinica`,
    { idMedico, idClinica }
  )

  await query(
    `UPDATE medico_disponibilidad
     SET activo = 0
     WHERE id_medico = :idMedico
       AND id_clinica = :idClinica`,
    { idMedico, idClinica }
  )
}

async function listBloqueosByMedico({ idMedico, idClinica = null }) {
  return query(
    `SELECT
       e.id_excepcion,
       e.id_clinica,
       c.nombre AS clinica_nombre,
       DATE_FORMAT(e.fecha, '%Y-%m-%d') AS fecha,
       DATE_FORMAT(e.hora_inicio, '%H:%i') AS hora_inicio,
       DATE_FORMAT(e.hora_fin, '%H:%i') AS hora_fin,
       e.tipo,
       e.motivo
     FROM medico_disponibilidad_excepciones e
     INNER JOIN clinicas c ON c.id_clinica = e.id_clinica
     WHERE e.id_medico = :idMedico
       AND e.tipo = 'bloqueo'
       AND (:idClinica IS NULL OR e.id_clinica = :idClinica)
     ORDER BY e.fecha DESC, e.hora_inicio`,
    { idMedico, idClinica }
  )
}

async function createBloqueo({ idMedico, idClinica, fecha, horaInicio = null, horaFin = null, motivo = null }) {
  const result = await query(
    `INSERT INTO medico_disponibilidad_excepciones
       (id_medico, id_clinica, fecha, hora_inicio, hora_fin, tipo, motivo)
     VALUES (:idMedico, :idClinica, :fecha, :horaInicio, :horaFin, 'bloqueo', :motivo)`,
    { idMedico, idClinica, fecha, horaInicio, horaFin, motivo }
  )

  const rows = await query(
    `SELECT id_excepcion
     FROM medico_disponibilidad_excepciones
     WHERE id_excepcion = :idExcepcion
     LIMIT 1`,
    { idExcepcion: result.insertId }
  )

  return rows[0] || null
}

async function findBloqueoById(idExcepcion) {
  const rows = await query(
    `SELECT id_excepcion, id_medico, id_clinica
     FROM medico_disponibilidad_excepciones
     WHERE id_excepcion = :idExcepcion
       AND tipo = 'bloqueo'
     LIMIT 1`,
    { idExcepcion }
  )
  return rows[0] || null
}

async function updateBloqueo({ idExcepcion, idClinica, fecha, horaInicio = null, horaFin = null, motivo = null }) {
  await query(
    `UPDATE medico_disponibilidad_excepciones
     SET id_clinica = :idClinica,
         fecha = :fecha,
         hora_inicio = :horaInicio,
         hora_fin = :horaFin,
         motivo = :motivo
     WHERE id_excepcion = :idExcepcion
       AND tipo = 'bloqueo'`,
    { idExcepcion, idClinica, fecha, horaInicio, horaFin, motivo }
  )
}

async function deleteBloqueo(idExcepcion) {
  await query(
    `DELETE FROM medico_disponibilidad_excepciones
     WHERE id_excepcion = :idExcepcion
       AND tipo = 'bloqueo'`,
    { idExcepcion }
  )
}

module.exports = {
  listMedicos,
  findDisponibilidadByMedicoClinicaDia,
  findExtraDisponibilidadByMedicoClinicaFecha,
  findTurnosTomados,
  findMedicoIdByUserId,
  findActiveTycByMedico,
  deactivateTycByMedico,
  insertMedicoTyc,
  listClinicasByMedico,
  findMedicoByUserId,
  findAnyCityId,
  ensureMedicoHasClinica,
  createClinicaWithDisponibilidad,
  updateClinicaWithDisponibilidad,
  deleteClinicaByMedico,
  listBloqueosByMedico,
  createBloqueo,
  findBloqueoById,
  updateBloqueo,
  deleteBloqueo,
}
