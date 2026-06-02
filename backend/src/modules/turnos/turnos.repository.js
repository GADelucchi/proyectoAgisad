const { query, pool } = require('../../db/query')

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

module.exports = {
  insertTurno,
  findTurnoById,
  updateTurnoEstado,
  listTurnosByMedicoRange,
}
