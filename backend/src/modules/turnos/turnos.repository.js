const { query, pool } = require('../../db/query')

function normalizeLabel(value) {
  return String(value || '').trim().toLowerCase()
}

function toMinutes(value) {
  const [h, m] = String(value || '').slice(0, 5).split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function resolveDuration({ requested, motivo, defaultDuration, byTypeName }) {
  const requestedNum = Number(requested)
  if (Number.isInteger(requestedNum) && requestedNum > 0) return requestedNum

  const byMotivo = byTypeName.get(normalizeLabel(motivo))
  if (Number.isInteger(byMotivo) && byMotivo > 0) return byMotivo

  return defaultDuration
}

async function insertTurno(data) {
  const sql = `
    INSERT INTO turnos (
      id_paciente, id_medico, id_clinica, id_disponibilidad, fecha, hora, estado, motivo_consulta
    ) VALUES (
      :idPaciente, :idMedico, :idClinica, :idDisponibilidad, :fecha, :hora, 'pendiente', :motivoConsulta
    )
  `

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [configRows] = await conn.execute(
      `SELECT duracion_turno_estandar
       FROM medico_turnos_config
       WHERE id_medico = ?
       LIMIT 1`,
      [data.idMedico]
    )
    const defaultDuration = Number(configRows[0]?.duracion_turno_estandar || 30) || 30

    const [tiposRows] = await conn.execute(
      `SELECT nombre, duracion_minutos
       FROM medico_tipos_turno
       WHERE id_medico = ?
         AND activo = 1`,
      [data.idMedico]
    )
    const byTypeName = new Map(
      (Array.isArray(tiposRows) ? tiposRows : []).map((row) => [normalizeLabel(row.nombre), Number(row.duracion_minutos || 0)])
    )

    const requestedDuration = resolveDuration({
      requested: data.duracionMinutos,
      motivo: data.motivoConsulta,
      defaultDuration,
      byTypeName,
    })

    const [existingRows] = await conn.execute(
      `SELECT DATE_FORMAT(hora, '%H:%i') AS hora, motivo_consulta
       FROM turnos
       WHERE id_medico = ?
         AND fecha = ?
         AND estado NOT IN ('cancelado_paciente', 'cancelado_clinica')
       FOR UPDATE`,
      [data.idMedico, data.fecha]
    )

    const start = toMinutes(data.hora)
    const end = start + requestedDuration

    for (const existing of existingRows) {
      const existingDuration = resolveDuration({
        requested: null,
        motivo: existing.motivo_consulta,
        defaultDuration,
        byTypeName,
      })
      const existingStart = toMinutes(existing.hora)
      const existingEnd = existingStart + existingDuration
      const overlaps = start < existingEnd && existingStart < end
      if (overlaps) {
        const err = new Error('El horario seleccionado se superpone con otro turno')
        err.code = 'TURNO_OVERLAP'
        throw err
      }
    }

    const [result] = await conn.execute(sql, data)
    const idTurno = result.insertId

    await conn.execute(
      `INSERT INTO turnos_historial (
        id_turno, id_clinica, id_medico, estado_anterior, estado_nuevo, modificado_por, motivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idTurno, data.idClinica, data.idMedico, null, 'pendiente', data.modificadoPor || null, 'Alta de turno']
    )

    await conn.commit()
    return idTurno
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function findTurnoById(idTurno) {
  const rows = await query('SELECT * FROM turnos WHERE id_turno = :idTurno LIMIT 1', { idTurno })
  return rows[0] || null
}

async function updateTurnoEstado({ idTurno, estadoNuevo, modificadoPor, motivo }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [rows] = await conn.execute('SELECT * FROM turnos WHERE id_turno = ? LIMIT 1 FOR UPDATE', [idTurno])
    const turno = rows[0]
    if (!turno) {
      await conn.rollback()
      return null
    }

    await conn.execute('UPDATE turnos SET estado = ? WHERE id_turno = ?', [estadoNuevo, idTurno])

    await conn.execute(
      `INSERT INTO turnos_historial (
        id_turno, id_clinica, id_medico, estado_anterior, estado_nuevo, modificado_por, motivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idTurno, turno.id_clinica, turno.id_medico, turno.estado, estadoNuevo, modificadoPor || null, motivo || null]
    )

    await conn.commit()
    return { ...turno, estado: estadoNuevo }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function listTurnosByMedicoRange({ idMedico, desde, hasta }) {
  return query(
    `SELECT t.id_turno,
            DATE_FORMAT(t.fecha, '%d/%m/%Y') AS fecha,
            DATE_FORMAT(t.fecha, '%Y-%m-%d') AS fecha_iso,
            DATE_FORMAT(t.hora, '%H:%i') AS hora,
            t.estado,
            t.id_clinica,
            p.nombre AS paciente_nombre,
            p.apellido AS paciente_apellido
     FROM turnos t
     INNER JOIN pacientes p ON p.id_paciente = t.id_paciente
     WHERE t.id_medico = :idMedico
       AND t.fecha BETWEEN :desde AND :hasta
     ORDER BY t.fecha, t.hora`,
    { idMedico, desde, hasta }
  )
}

async function listHistorialByMedicoRange({ idMedico, desde, hasta }) {
  return query(
    `SELECT h.id_historial,
            h.id_turno,
            DATE_FORMAT(t.fecha, '%d/%m/%Y') AS fecha,
            DATE_FORMAT(t.fecha, '%Y-%m-%d') AS fecha_iso,
            DATE_FORMAT(t.hora, '%H:%i') AS hora,
            h.estado_anterior,
            h.estado_nuevo AS estado,
            t.id_clinica,
            c.nombre AS clinica_nombre,
            p.nombre AS paciente_nombre,
            p.apellido AS paciente_apellido,
            h.modificado_por,
            r.nombre AS actor_rol,
            u.username AS actor_username,
            u.email AS actor_email,
            h.motivo,
            DATE_FORMAT(h.creado_en, '%d/%m/%Y %H:%i') AS creado_en,
            DATE_FORMAT(h.creado_en, '%Y-%m-%d %H:%i:%s') AS creado_en_iso
     FROM turnos_historial h
     INNER JOIN turnos t ON t.id_turno = h.id_turno
     INNER JOIN pacientes p ON p.id_paciente = t.id_paciente
     LEFT JOIN clinicas c ON c.id_clinica = t.id_clinica
     LEFT JOIN usuarios u ON u.id_usuario = h.modificado_por
     LEFT JOIN roles r ON r.id_rol = u.id_rol
     WHERE t.id_medico = :idMedico
       AND t.fecha BETWEEN :desde AND :hasta
     ORDER BY h.creado_en DESC, h.id_historial DESC`,
    { idMedico, desde, hasta }
  )
}

async function findPacienteIdByUserId(idUsuario) {
  const rows = await query(
    `SELECT id_paciente
     FROM pacientes
     WHERE id_usuario = :idUsuario
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0]?.id_paciente || null
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

async function listTurnosByPaciente({ idPaciente, idMedico = null }) {
  return query(
    `SELECT
       t.id_turno,
       t.id_medico,
       t.id_clinica,
       DATE_FORMAT(t.fecha, '%Y-%m-%d') AS fecha_iso,
       DATE_FORMAT(t.hora, '%H:%i') AS hora,
       t.estado,
       c.nombre AS clinica_nombre,
       m.nombre AS medico_nombre,
       m.apellido AS medico_apellido
     FROM turnos t
     INNER JOIN clinicas c ON c.id_clinica = t.id_clinica
     INNER JOIN medicos m ON m.id_medico = t.id_medico
     WHERE t.id_paciente = :idPaciente
       AND (:idMedico IS NULL OR t.id_medico = :idMedico)
     ORDER BY t.fecha, t.hora`,
    { idPaciente, idMedico }
  )
}

async function medicoPermiteTurnos(idMedico) {
  const rows = await query(
    `SELECT COALESCE(mp.permite_turnos, 1) AS permite_turnos
     FROM medicos m
     LEFT JOIN (
       SELECT m1.*
       FROM membresias m1
       INNER JOIN (
         SELECT id_usuario, MAX(id_membresia) AS id_membresia
         FROM membresias
         GROUP BY id_usuario
       ) latest ON latest.id_membresia = m1.id_membresia
     ) ms ON ms.id_usuario = m.id_usuario
     LEFT JOIN membresia_planes mp ON mp.id_plan = ms.id_plan OR LOWER(mp.codigo) = LOWER(ms.plan)
     WHERE m.id_medico = :idMedico
     LIMIT 1`,
    { idMedico }
  )

  if (!rows[0]) return null
  return Boolean(rows[0].permite_turnos)
}

module.exports = {
  insertTurno,
  findTurnoById,
  updateTurnoEstado,
  listTurnosByMedicoRange,
  listHistorialByMedicoRange,
  findPacienteIdByUserId,
  findMedicoIdByUserId,
  listTurnosByPaciente,
  medicoPermiteTurnos,
}
