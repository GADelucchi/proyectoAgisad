const { query, pool } = require('../../db/query')

async function findPropietarioByUserId(idUsuario) {
  const rows = await query(
    `SELECT id_propietario, nombre, apellido
     FROM propietarios
     WHERE id_usuario = :idUsuario AND activo = 1
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0] || null
}

async function findMedicoByUserId(idUsuario) {
  const rows = await query(
    `SELECT id_medico, nombre, apellido
     FROM medicos
     WHERE id_usuario = :idUsuario
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0] || null
}

async function findClinicaById(idClinica) {
  const rows = await query(
    `SELECT c.id_clinica, c.nombre, c.direccion, c.telefono, c.link,
            c.compartido, c.activo, ci.nombre AS ciudad
     FROM clinicas c
     LEFT JOIN ciudades ci ON ci.id_ciudad = c.id_ciudad
     WHERE c.id_clinica = :idClinica
     LIMIT 1`,
    { idClinica }
  )
  return rows[0] || null
}

async function isClinicaOwnedByMedico({ idMedico, idClinica }) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM medico_clinicas
     WHERE id_medico = :idMedico
       AND id_clinica = :idClinica
       AND activo = 1
       AND es_propietario = 1
     LIMIT 1`,
    { idMedico, idClinica }
  )
  return Boolean(rows[0])
}

async function isClinicaOwnedByPropietario({ idPropietario, idClinica }) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM propietario_clinicas
     WHERE id_propietario = :idPropietario
       AND id_clinica = :idClinica
       AND activo = 1
     LIMIT 1`,
    { idPropietario, idClinica }
  )
  return Boolean(rows[0])
}

async function listClinicasByPropietario(idPropietario) {
  return query(
    `SELECT c.id_clinica, c.nombre, c.direccion, c.telefono, c.compartido, c.activo,
            ci.nombre AS ciudad
     FROM propietario_clinicas pc
     INNER JOIN clinicas c ON c.id_clinica = pc.id_clinica
     LEFT JOIN ciudades ci ON ci.id_ciudad = c.id_ciudad
     WHERE pc.id_propietario = :idPropietario
       AND pc.activo = 1
     ORDER BY c.nombre`,
    { idPropietario }
  )
}

// Un consultorio deja de ofrecerse si al dueño se le venció la membresía (o,
// si el dueño es un médico, si dio de baja el adicional): sería ofrecer un
// espacio que el sistema ya no puede sostener.
const OWNER_JOIN = `
  LEFT JOIN propietario_clinicas pc ON pc.id_clinica = c.id_clinica AND pc.activo = 1
  LEFT JOIN propietarios pr ON pr.id_propietario = pc.id_propietario
  LEFT JOIN medico_clinicas mc ON mc.id_clinica = c.id_clinica AND mc.activo = 1 AND mc.es_propietario = 1
  LEFT JOIN medicos m ON m.id_medico = mc.id_medico
  LEFT JOIN membresias ms ON ms.id_membresia = (
    SELECT MAX(id_membresia) FROM membresias
    WHERE id_usuario = COALESCE(pr.id_usuario, m.id_usuario)
  )`

const OWNER_OPERATIVO = `
  ms.estado = 'activa'
  AND (
    (ms.es_trial = 1 AND (ms.fecha_fin_trial IS NULL OR ms.fecha_fin_trial >= CURDATE()))
    OR (ms.es_trial = 0 AND (ms.pagado_hasta IS NULL OR ms.pagado_hasta >= CURDATE()))
  )
  AND (
    pr.id_propietario IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM medico_adicional_consultorios ac
      WHERE ac.id_medico = m.id_medico AND ac.estado = 'activo'
    )
  )`

async function listConsultoriosPublicos() {
  return query(
    `SELECT c.id_clinica, c.nombre, c.direccion, c.telefono,
            ci.nombre AS ciudad
     FROM clinicas c
     LEFT JOIN ciudades ci ON ci.id_ciudad = c.id_ciudad
     ${OWNER_JOIN}
     WHERE c.compartido = 1
       AND c.activo = 1
       AND ${OWNER_OPERATIVO}
     ORDER BY c.nombre`
  )
}

/**
 * ¿El consultorio está operativo? (dueño con membresía vigente y, si es
 * médico, con el adicional activo). Se usa para frenar reservas nuevas.
 */
async function isConsultorioOperativo(idClinica) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM clinicas c
     ${OWNER_JOIN}
     WHERE c.id_clinica = :idClinica
       AND c.activo = 1
       AND ${OWNER_OPERATIVO}
     LIMIT 1`,
    { idClinica }
  )
  return Boolean(rows[0])
}

async function createClinicaForPropietario({ idPropietario, nombre, idCiudad, direccion, telefono }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [clinicaResult] = await conn.execute(
      `INSERT INTO clinicas (nombre, id_ciudad, direccion, telefono, compartido)
       VALUES (?, ?, ?, ?, 1)`,
      [nombre, idCiudad, direccion, telefono]
    )

    await conn.execute(
      `INSERT INTO propietario_clinicas (id_propietario, id_clinica)
       VALUES (?, ?)`,
      [idPropietario, clinicaResult.insertId]
    )

    await conn.commit()
    return clinicaResult.insertId
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function marcarClinicaCompartida({ idClinica, compartido }) {
  await query(
    `UPDATE clinicas SET compartido = :compartido WHERE id_clinica = :idClinica`,
    { idClinica, compartido: compartido ? 1 : 0 }
  )
}

async function findDisponibilidadByClinicaDia({ idClinica, diaSemana }) {
  return query(
    `SELECT id_disponibilidad,
            DATE_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
            DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin,
            duracion_turno
     FROM consultorio_disponibilidad
     WHERE id_clinica = :idClinica
       AND dia_semana = :diaSemana
       AND activo = 1
     ORDER BY hora_inicio`,
    { idClinica, diaSemana }
  )
}

async function findExcepcionesByClinicaFecha({ idClinica, fecha, tipo }) {
  return query(
    `SELECT id_excepcion,
            DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
            DATE_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
            DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin,
            tipo, motivo
     FROM consultorio_disponibilidad_excepciones
     WHERE id_clinica = :idClinica
       AND fecha = :fecha
       AND tipo = :tipo`,
    { idClinica, fecha, tipo }
  )
}

async function listDisponibilidadByClinica(idClinica) {
  const rangos = await query(
    `SELECT id_disponibilidad, dia_semana,
            DATE_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
            DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin,
            duracion_turno
     FROM consultorio_disponibilidad
     WHERE id_clinica = :idClinica AND activo = 1
     ORDER BY dia_semana, hora_inicio`,
    { idClinica }
  )

  const excepciones = await query(
    `SELECT id_excepcion,
            DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
            DATE_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
            DATE_FORMAT(hora_fin, '%H:%i') AS hora_fin,
            tipo, motivo
     FROM consultorio_disponibilidad_excepciones
     WHERE id_clinica = :idClinica
     ORDER BY fecha, hora_inicio`,
    { idClinica }
  )

  return { rangos, excepciones }
}

async function replaceDisponibilidadByClinica({ idClinica, rangos, excepciones }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.execute(
      `UPDATE consultorio_disponibilidad SET activo = 0 WHERE id_clinica = ?`,
      [idClinica]
    )

    for (const rango of rangos) {
      await conn.execute(
        `INSERT INTO consultorio_disponibilidad
           (id_clinica, dia_semana, hora_inicio, hora_fin, duracion_turno, activo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [idClinica, rango.diaSemana, rango.horaInicio, rango.horaFin, rango.duracionTurno]
      )
    }

    await conn.execute(
      `DELETE FROM consultorio_disponibilidad_excepciones WHERE id_clinica = ?`,
      [idClinica]
    )

    for (const exc of excepciones) {
      await conn.execute(
        `INSERT INTO consultorio_disponibilidad_excepciones
           (id_clinica, fecha, hora_inicio, hora_fin, tipo, motivo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idClinica, exc.fecha, exc.horaInicio, exc.horaFin, exc.tipo, exc.motivo]
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

async function findSolicitudActiva({ idClinica, idMedico }) {
  const rows = await query(
    `SELECT id_solicitud, estado
     FROM consultorio_solicitudes
     WHERE id_clinica = :idClinica
       AND id_medico = :idMedico
       AND estado = 'pendiente'
     LIMIT 1`,
    { idClinica, idMedico }
  )
  return rows[0] || null
}

async function isMedicoVinculado({ idClinica, idMedico }) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM medico_clinicas
     WHERE id_clinica = :idClinica AND id_medico = :idMedico AND activo = 1
     LIMIT 1`,
    { idClinica, idMedico }
  )
  return Boolean(rows[0])
}

async function createSolicitud({ idClinica, idMedico, mensaje }) {
  const result = await query(
    `INSERT INTO consultorio_solicitudes (id_clinica, id_medico, mensaje)
     VALUES (:idClinica, :idMedico, :mensaje)`,
    { idClinica, idMedico, mensaje }
  )
  return result.insertId
}

async function listSolicitudesByClinicas(idsClinicas) {
  if (idsClinicas.length === 0) return []
  const placeholders = idsClinicas.map((_, i) => `:id${i}`).join(',')
  const params = Object.fromEntries(idsClinicas.map((id, i) => [`id${i}`, id]))

  return query(
    `SELECT cs.id_solicitud, cs.id_clinica, cs.id_medico, cs.estado, cs.mensaje,
            cs.motivo_rechazo,
            DATE_FORMAT(cs.creado_en, '%d/%m/%Y %H:%i') AS creado_en,
            c.nombre AS clinica_nombre,
            m.nombre AS medico_nombre, m.apellido AS medico_apellido,
            m.matricula, u.email AS medico_email,
            e.nombre AS especialidad
     FROM consultorio_solicitudes cs
     INNER JOIN clinicas c ON c.id_clinica = cs.id_clinica
     INNER JOIN medicos m ON m.id_medico = cs.id_medico
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     LEFT JOIN especialidades e ON e.id_especialidad = m.id_especialidad
     WHERE cs.id_clinica IN (${placeholders})
     ORDER BY cs.creado_en DESC`,
    params
  )
}

async function listSolicitudesByMedico(idMedico) {
  return query(
    `SELECT cs.id_solicitud, cs.id_clinica, cs.estado, cs.motivo_rechazo,
            DATE_FORMAT(cs.creado_en, '%d/%m/%Y %H:%i') AS creado_en,
            c.nombre AS clinica_nombre, c.direccion,
            ci.nombre AS ciudad
     FROM consultorio_solicitudes cs
     INNER JOIN clinicas c ON c.id_clinica = cs.id_clinica
     LEFT JOIN ciudades ci ON ci.id_ciudad = c.id_ciudad
     WHERE cs.id_medico = :idMedico
     ORDER BY cs.creado_en DESC`,
    { idMedico }
  )
}

async function findSolicitudById(idSolicitud) {
  const rows = await query(
    `SELECT cs.id_solicitud, cs.id_clinica, cs.id_medico, cs.estado,
            c.nombre AS clinica_nombre,
            m.nombre AS medico_nombre, m.apellido AS medico_apellido,
            u.email AS medico_email
     FROM consultorio_solicitudes cs
     INNER JOIN clinicas c ON c.id_clinica = cs.id_clinica
     INNER JOIN medicos m ON m.id_medico = cs.id_medico
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     WHERE cs.id_solicitud = :idSolicitud
     LIMIT 1`,
    { idSolicitud }
  )
  return rows[0] || null
}

async function aprobarSolicitud({ idSolicitud, idClinica, idMedico }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // es_propietario=0: es inquilino, no dueño del consultorio.
    await conn.execute(
      `INSERT INTO medico_clinicas (id_medico, id_clinica, activo, es_propietario)
       VALUES (?, ?, 1, 0)
       ON DUPLICATE KEY UPDATE activo = 1`,
      [idMedico, idClinica]
    )

    await conn.execute(
      `UPDATE consultorio_solicitudes
       SET estado = 'aprobada', resuelta_en = NOW()
       WHERE id_solicitud = ?`,
      [idSolicitud]
    )

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function rechazarSolicitud({ idSolicitud, motivo }) {
  await query(
    `UPDATE consultorio_solicitudes
     SET estado = 'rechazada', motivo_rechazo = :motivo, resuelta_en = NOW()
     WHERE id_solicitud = :idSolicitud`,
    { idSolicitud, motivo }
  )
}

async function desvincularMedico({ idClinica, idMedico }) {
  await query(
    `UPDATE medico_clinicas
     SET activo = 0
     WHERE id_clinica = :idClinica AND id_medico = :idMedico AND es_propietario = 0`,
    { idClinica, idMedico }
  )
}

async function listMedicosVinculados(idClinica) {
  return query(
    `SELECT m.id_medico, m.nombre, m.apellido, m.matricula, u.email
     FROM medico_clinicas mc
     INNER JOIN medicos m ON m.id_medico = mc.id_medico
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     WHERE mc.id_clinica = :idClinica
       AND mc.activo = 1
       AND mc.es_propietario = 0
     ORDER BY m.apellido, m.nombre`,
    { idClinica }
  )
}

async function findOwnerEmailByClinica(idClinica) {
  const rows = await query(
    `SELECT u.email, p.nombre, p.apellido
     FROM propietario_clinicas pc
     INNER JOIN propietarios p ON p.id_propietario = pc.id_propietario
     INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
     WHERE pc.id_clinica = :idClinica AND pc.activo = 1
     LIMIT 1`,
    { idClinica }
  )
  if (rows[0]) return rows[0]

  const medicoRows = await query(
    `SELECT u.email, m.nombre, m.apellido
     FROM medico_clinicas mc
     INNER JOIN medicos m ON m.id_medico = mc.id_medico
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     WHERE mc.id_clinica = :idClinica
       AND mc.activo = 1
       AND mc.es_propietario = 1
     LIMIT 1`,
    { idClinica }
  )
  return medicoRows[0] || null
}

async function listClinicasCompartidasByMedicoDueno(idMedico) {
  return query(
    `SELECT c.id_clinica, c.nombre, c.direccion, c.compartido,
            ci.nombre AS ciudad
     FROM medico_clinicas mc
     INNER JOIN clinicas c ON c.id_clinica = mc.id_clinica
     LEFT JOIN ciudades ci ON ci.id_ciudad = c.id_ciudad
     WHERE mc.id_medico = :idMedico
       AND mc.activo = 1
       AND mc.es_propietario = 1
       AND c.compartido = 1
     ORDER BY c.nombre`,
    { idMedico }
  )
}

async function findAdicionalByMedico(idMedico) {
  const rows = await query(
    `SELECT id_adicional, id_medico, estado, monto_mensual, max_consultorios,
            DATE_FORMAT(solicitado_en, '%d/%m/%Y') AS solicitado_en,
            DATE_FORMAT(activado_en, '%d/%m/%Y') AS activado_en
     FROM medico_adicional_consultorios
     WHERE id_medico = :idMedico
       AND estado IN ('pendiente', 'activo')
     ORDER BY id_adicional DESC
     LIMIT 1`,
    { idMedico }
  )
  return rows[0] || null
}

async function createAdicionalActivo({ idMedico, montoMensual, maxConsultorios }) {
  const result = await query(
    `INSERT INTO medico_adicional_consultorios
       (id_medico, monto_mensual, max_consultorios, estado, activado_en)
     VALUES (:idMedico, :montoMensual, :maxConsultorios, 'activo', NOW())`,
    { idMedico, montoMensual, maxConsultorios }
  )
  return result.insertId
}

async function cancelarAdicional(idAdicional) {
  await query(
    `UPDATE medico_adicional_consultorios
     SET estado = 'cancelado', cancelado_en = NOW()
     WHERE id_adicional = :idAdicional`,
    { idAdicional }
  )
}

async function contarPublicadosByMedico(idMedico) {
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM medico_clinicas mc
     INNER JOIN clinicas c ON c.id_clinica = mc.id_clinica
     WHERE mc.id_medico = :idMedico
       AND mc.activo = 1
       AND mc.es_propietario = 1
       AND c.compartido = 1`,
    { idMedico }
  )
  return Number(rows[0]?.total || 0)
}

module.exports = {
  findPropietarioByUserId,
  findMedicoByUserId,
  findClinicaById,
  isClinicaOwnedByMedico,
  isClinicaOwnedByPropietario,
  listClinicasByPropietario,
  listConsultoriosPublicos,
  createClinicaForPropietario,
  marcarClinicaCompartida,
  findDisponibilidadByClinicaDia,
  findExcepcionesByClinicaFecha,
  listDisponibilidadByClinica,
  replaceDisponibilidadByClinica,
  findSolicitudActiva,
  isMedicoVinculado,
  createSolicitud,
  listSolicitudesByClinicas,
  listSolicitudesByMedico,
  findSolicitudById,
  aprobarSolicitud,
  rechazarSolicitud,
  desvincularMedico,
  listMedicosVinculados,
  findOwnerEmailByClinica,
  listClinicasCompartidasByMedicoDueno,
  findAdicionalByMedico,
  createAdicionalActivo,
  cancelarAdicional,
  contarPublicadosByMedico,
  isConsultorioOperativo,
}
