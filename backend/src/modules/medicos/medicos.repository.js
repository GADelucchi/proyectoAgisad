const { query } = require('../../db/query')

async function listMedicos({ q, idEspecialidad, idCiudad }) {
  const sql = `
    SELECT
      m.id_medico,
      m.nombre,
      m.apellido,
      m.matricula,
      m.telefono,
      m.id_ciudad,
      c.nombre AS ciudad,
      u.email
    FROM medicos m
    INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
    LEFT JOIN ciudades c ON c.id_ciudad = m.id_ciudad
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

  return query(sql, {
    q: q || null,
    idEspecialidad: idEspecialidad || null,
    idCiudad: idCiudad || null,
  })
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

module.exports = {
  listMedicos,
  findDisponibilidadByMedicoClinicaDia,
  findTurnosTomados,
}
