const { query } = require('../../db/query')

/**
 * Guarda un nuevo token (ya hasheado) para el usuario.
 *
 * El vencimiento lo calcula MySQL, no JS: como `findValidToken` compara contra
 * NOW(), mezclar el reloj de Node con el de la base hacía que el token naciera
 * vencido si ambos no estaban en la misma zona horaria.
 */
async function createToken(idUsuario, tokenHash, vigenciaMinutos) {
  await query(
    `INSERT INTO password_reset_tokens (id_usuario, token_hash, expira_en)
     VALUES (:idUsuario, :tokenHash, DATE_ADD(NOW(), INTERVAL :vigenciaMinutos MINUTE))`,
    { idUsuario, tokenHash, vigenciaMinutos }
  )
}

/**
 * Devuelve el registro del token si aún es válido (no usado y no expirado).
 */
async function findValidToken(tokenHash) {
  const rows = await query(
    `SELECT id_token, id_usuario
     FROM password_reset_tokens
     WHERE token_hash = :tokenHash
       AND usado_en   IS NULL
       AND expira_en  > NOW()
     LIMIT 1`,
    { tokenHash }
  )
  return rows[0] || null
}

/**
 * Invalida todos los tokens pendientes del usuario (ej: al cambiar contraseña con éxito).
 */
async function invalidateUserTokens(idUsuario) {
  await query(
    `UPDATE password_reset_tokens
     SET usado_en = NOW()
     WHERE id_usuario = :idUsuario
       AND usado_en   IS NULL`,
    { idUsuario }
  )
}

module.exports = {
  createToken,
  findValidToken,
  invalidateUserTokens,
}
