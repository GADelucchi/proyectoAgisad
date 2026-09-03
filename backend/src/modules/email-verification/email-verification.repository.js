const { query } = require('../../db/query')

// El vencimiento se calcula y se compara SIEMPRE con el reloj de MySQL.
// Mandar un Date de JS acá rompía en producción: mysql2 lo serializa con la
// zona del pool (-03:00) mientras que NOW() usa la del servidor de la base
// (UTC en la mayoría de las bases administradas), así que el código nacía
// vencido por la diferencia horaria.
async function createCodigo({ idUsuario, codigoHash, vigenciaMinutos }) {
  await query(
    `INSERT INTO email_verificaciones (id_usuario, codigo_hash, expira_en)
     VALUES (:idUsuario, :codigoHash, DATE_ADD(NOW(), INTERVAL :vigenciaMinutos MINUTE))`,
    { idUsuario, codigoHash, vigenciaMinutos }
  )
}

/**
 * Último código no usado y no vencido de un usuario (haya expirado o no
 * el intento de matcheo, esto solo trae el registro más reciente).
 * `antiguedad_seg` viene calculado por la base para el cooldown de reenvío.
 */
async function findVigente(idUsuario) {
  const rows = await query(
    `SELECT id_verificacion, codigo_hash, intentos, expira_en, creado_en,
            TIMESTAMPDIFF(SECOND, creado_en, NOW()) AS antiguedad_seg
     FROM email_verificaciones
     WHERE id_usuario  = :idUsuario
       AND usado_en    IS NULL
       AND expira_en   > NOW()
     ORDER BY id_verificacion DESC
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0] || null
}

async function incrementarIntentos(idVerificacion) {
  await query(
    `UPDATE email_verificaciones SET intentos = intentos + 1 WHERE id_verificacion = :idVerificacion`,
    { idVerificacion }
  )
}

async function marcarUsado(idVerificacion) {
  await query(
    `UPDATE email_verificaciones SET usado_en = NOW() WHERE id_verificacion = :idVerificacion`,
    { idVerificacion }
  )
}

async function invalidarPendientes(idUsuario) {
  await query(
    `UPDATE email_verificaciones
     SET usado_en = NOW()
     WHERE id_usuario = :idUsuario
       AND usado_en   IS NULL`,
    { idUsuario }
  )
}

module.exports = {
  createCodigo,
  findVigente,
  incrementarIntentos,
  marcarUsado,
  invalidarPendientes,
}
