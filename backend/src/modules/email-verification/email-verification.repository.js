const { query } = require('../../db/query')

async function createCodigo({ idUsuario, codigoHash, expiraEn }) {
  await query(
    `INSERT INTO email_verificaciones (id_usuario, codigo_hash, expira_en)
     VALUES (:idUsuario, :codigoHash, :expiraEn)`,
    { idUsuario, codigoHash, expiraEn }
  )
}

/**
 * Último código no usado y no vencido de un usuario (haya expirado o no
 * el intento de matcheo, esto solo trae el registro más reciente).
 */
async function findVigente(idUsuario) {
  const rows = await query(
    `SELECT id_verificacion, codigo_hash, intentos, expira_en, creado_en
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
