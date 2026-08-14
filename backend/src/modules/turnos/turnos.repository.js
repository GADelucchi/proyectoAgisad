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
  // Calcular hora_fin basado en hora_inicio + duracionMinutos
  const [horaInicio] = data.hora.split(':')
  const [minutosInicio] = data.hora.split(':')[1]
  
  // Sumar duración a la hora de inicio
  let totalMinutos = parseInt(horaInicio) * 60 + parseInt(minutosInicio) + (data.duracionMinutos || 30)
  const horaFinNum = Math.floor(totalMinutos / 60)
  const minutosFinNum = totalMinutos % 60
  const horaFin = `${String(horaFinNum).padStart(2, '0')}:${String(minutosFinNum).padStart(2, '0')}`

  const sql = `
    INSERT INTO turnos (
      id_paciente, id_medico, id_clinica, fecha, hora_inicio, hora_fin, estado, motivo
    ) VALUES (
      :idPaciente, :idMedico, :idClinica, :fecha, :horaInicio, :horaFin, 'pendiente', :motivo
    )
  `

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [existingRows] = await conn.execute(
      `SELECT DATE_FORMAT(hora_inicio, '%H:%i') AS hora, motivo
       FROM turnos
       WHERE id_medico = ?
         AND fecha = ?
         AND estado NOT IN ('cancelado_paciente', 'cancelado_clinica')
       FOR UPDATE`,
      [data.idMedico, data.fecha]
    )

    const start = parseInt(data.hora.split(':')[0]) * 60 + parseInt(data.hora.split(':')[1])
    const end = start + (data.duracionMinutos || 30)

    for (const existing of existingRows) {
      const existingStart = parseInt(existing.hora.split(':')[0]) * 60 + parseInt(existing.hora.split(':')[1])
      const existingEnd = existingStart + 30 // duracion por defecto
      const overlaps = start < existingEnd && existingStart < end
      if (overlaps) {
        const err = new Error('El horario seleccionado se superpone con otro turno')
        err.code = 'TURNO_OVERLAP'
        throw err
      }
    }

    const [result] = await conn.execute(sql, {
      idPaciente: data.idPaciente,
      idMedico: data.idMedico,
      idClinica: data.idClinica,
      fecha: data.fecha,
      horaInicio: data.hora,
      horaFin: horaFin,
      motivo: data.motivoConsulta || null,
    })
    const idTurno = result.insertId

    await conn.execute(
      `INSERT INTO turnos_historial (
        id_turno, estado_previo, estado_nuevo, id_usuario, motivo
      ) VALUES (?, ?, ?, ?, ?)`,
      [idTurno, null, 'pendiente', data.modificadoPor || null, 'Alta de turno']
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
        id_turno, estado_previo, estado_nuevo, id_usuario, motivo
      ) VALUES (?, ?, ?, ?, ?)`,
      [idTurno, turno.estado, estadoNuevo, modificadoPor || null, motivo || null]
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
            DATE_FORMAT(t.hora_inicio, '%H:%i') AS hora,
            t.estado,
            t.id_clinica,
            p.nombre AS paciente_nombre,
            p.apellido AS paciente_apellido
     FROM turnos t
     INNER JOIN pacientes p ON p.id_paciente = t.id_paciente
     WHERE t.id_medico = :idMedico
       AND t.fecha BETWEEN :desde AND :hasta
     ORDER BY t.fecha, t.hora_inicio`,
    { idMedico, desde, hasta }
  )
}

async function listHistorialByMedicoRange({ idMedico, desde, hasta }) {
  return query(
    `SELECT h.id_historial,
            h.id_turno,
            DATE_FORMAT(t.fecha, '%d/%m/%Y') AS fecha,
            DATE_FORMAT(t.fecha, '%Y-%m-%d') AS fecha_iso,
            DATE_FORMAT(t.hora_inicio, '%H:%i') AS hora,
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
       DATE_FORMAT(t.hora_inicio, '%H:%i') AS hora,
       t.estado,
       c.nombre AS clinica_nombre,
       m.nombre AS medico_nombre,
       m.apellido AS medico_apellido
     FROM turnos t
     INNER JOIN clinicas c ON c.id_clinica = t.id_clinica
     INNER JOIN medicos m ON m.id_medico = t.id_medico
     WHERE t.id_paciente = :idPaciente
       AND (:idMedico IS NULL OR t.id_medico = :idMedico)
     ORDER BY t.fecha, t.hora_inicio`,
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
