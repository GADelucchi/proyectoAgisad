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
  const duracion = Number(data.duracionMinutos) > 0 ? Number(data.duracionMinutos) : 30
  const start = toMinutes(data.hora)
  const end = start + duracion
  const horaFin = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`

  const sql = `
    INSERT INTO turnos (
      id_paciente, id_medico, id_clinica, id_tipo_turno, fecha, hora_inicio, hora_fin, estado, motivo
    ) VALUES (
      :idPaciente, :idMedico, :idClinica, :idTipoTurno, :fecha, :horaInicio, :horaFin, 'pendiente', :motivo
    )
  `

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // En un consultorio compartido (alquilado a varios médicos) el conflicto es
    // por sala física: hay que mirar los turnos de todos los médicos ahí, no
    // solo los propios.
    const [clinicaRows] = await conn.execute(
      'SELECT compartido FROM clinicas WHERE id_clinica = ? LIMIT 1',
      [data.idClinica]
    )
    const esCompartido = Boolean(clinicaRows[0]?.compartido)

    const [existingRows] = esCompartido
      ? await conn.execute(
        `SELECT DATE_FORMAT(hora_inicio, '%H:%i') AS hora,
                DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin,
                motivo
         FROM turnos
         WHERE (id_clinica = ? OR id_medico = ?)
           AND fecha = ?
           AND estado NOT IN ('cancelado', 'cancelado_paciente', 'cancelado_clinica')
         FOR UPDATE`,
        [data.idClinica, data.idMedico, data.fecha]
      )
      : await conn.execute(
        `SELECT DATE_FORMAT(hora_inicio, '%H:%i') AS hora,
                DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin,
                motivo
         FROM turnos
         WHERE id_medico = ?
           AND fecha = ?
           AND estado NOT IN ('cancelado', 'cancelado_paciente', 'cancelado_clinica')
         FOR UPDATE`,
        [data.idMedico, data.fecha]
      )

    for (const existing of existingRows) {
      const existingStart = toMinutes(existing.hora)
      const existingEnd = existing.hora_fin ? toMinutes(existing.hora_fin) : existingStart + 30
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
      idTipoTurno: data.idTipoTurno || null,
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
            DATE_FORMAT(t.hora_fin, '%H:%i') AS hora_fin,
            t.estado,
            t.id_clinica,
            c.nombre AS clinica_nombre,
            p.nombre AS paciente_nombre,
            p.apellido AS paciente_apellido
     FROM turnos t
     INNER JOIN pacientes p ON p.id_paciente = t.id_paciente
     LEFT JOIN clinicas c ON c.id_clinica = t.id_clinica
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
            h.estado_previo AS estado_anterior,
            h.estado_nuevo AS estado,
            t.id_clinica,
            c.nombre AS clinica_nombre,
            p.nombre AS paciente_nombre,
            p.apellido AS paciente_apellido,
            h.id_usuario AS modificado_por,
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
     LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
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
       t.motivo,
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

async function findTipoTurnoById(idTipoTurno, idMedico) {
  const rows = await query(
    `SELECT id_tipo_turno, nombre, duracion_minutos, notificar_nuevo
     FROM medico_tipos_turno
     WHERE id_tipo_turno = :idTipoTurno
       AND id_medico = :idMedico
       AND activo = 1
     LIMIT 1`,
    { idTipoTurno, idMedico }
  )
  return rows[0] || null
}

async function findMedicoNotifInfoById(idMedico) {
  const rows = await query(
    `SELECT m.id_medico, m.nombre, m.apellido, u.email,
            COALESCE(m.notif_turno_nuevo, 1) AS notif_turno_nuevo,
            COALESCE(m.notif_cancelacion, 1) AS notif_cancelacion
     FROM medicos m
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     WHERE m.id_medico = :idMedico
     LIMIT 1`,
    { idMedico }
  )
  return rows[0] || null
}

async function findTurnoResumenById(idTurno) {
  const rows = await query(
    `SELECT t.id_turno, t.id_medico, t.id_paciente,
            DATE_FORMAT(t.fecha, '%d/%m/%Y') AS fecha,
            DATE_FORMAT(t.hora_inicio, '%H:%i') AS hora,
            t.estado,
            p.nombre AS paciente_nombre,
            p.apellido AS paciente_apellido,
            tt.nombre AS tipo_turno_nombre,
            tt.notificar_nuevo AS tipo_notificar_nuevo
     FROM turnos t
     INNER JOIN pacientes p ON p.id_paciente = t.id_paciente
     LEFT JOIN medico_tipos_turno tt ON tt.id_tipo_turno = t.id_tipo_turno
     WHERE t.id_turno = :idTurno
     LIMIT 1`,
    { idTurno }
  )
  return rows[0] || null
}

async function findTurnosTomadosPorClinica({ idClinica, fecha }) {
  return query(
    `SELECT DATE_FORMAT(hora_inicio, '%H:%i') AS hora,
            DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin
     FROM turnos
     WHERE id_clinica = :idClinica
       AND fecha = :fecha
       AND estado NOT IN ('cancelado', 'cancelado_paciente', 'cancelado_clinica')`,
    { idClinica, fecha }
  )
}

// Horas reservadas (no canceladas) por médico en un consultorio, para que el
// dueño cobre el alquiler por fuera del sistema.
async function reporteUsoPorClinica({ idClinica, desde, hasta }) {
  return query(
    `SELECT t.id_medico,
            m.nombre AS medico_nombre,
            m.apellido AS medico_apellido,
            COUNT(*) AS turnos,
            ROUND(SUM(TIMESTAMPDIFF(MINUTE, t.hora_inicio, t.hora_fin)) / 60, 2) AS horas
     FROM turnos t
     INNER JOIN medicos m ON m.id_medico = t.id_medico
     WHERE t.id_clinica = :idClinica
       AND t.fecha BETWEEN :desde AND :hasta
       AND t.estado NOT IN ('cancelado', 'cancelado_paciente', 'cancelado_clinica')
     GROUP BY t.id_medico, m.nombre, m.apellido
     ORDER BY horas DESC`,
    { idClinica, desde, hasta }
  )
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
  findTipoTurnoById,
  findMedicoNotifInfoById,
  findTurnoResumenById,
  findTurnosTomadosPorClinica,
  reporteUsoPorClinica,
}
