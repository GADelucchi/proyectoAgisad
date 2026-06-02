const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const HttpError = require('../../utils/httpError')
const { query } = require('../../db/query')
const { sendPasswordResetEmail } = require('../../utils/mailer')
const {
  createToken,
  findValidToken,
  invalidateUserTokens,
} = require('./password-reset.repository')

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function isStrongPassword(value) {
  if (typeof value !== 'string') return false
  if (value.length < 8) return false

  const hasLetter = /[A-Za-z]/.test(value)
  const hasNumber = /\d/.test(value)

  return hasLetter && hasNumber
}

/**
 * Solicita la recuperación de contraseña.
 * Siempre responde con éxito aunque el email no exista (no revelar existencia).
 */
async function requestPasswordReset(email) {
  if (!email) throw new HttpError(400, 'El email es obligatorio')

  // Busca el usuario sin revelar si existe o no
  const rows = await query(
    `SELECT id_usuario, activo FROM usuarios WHERE email = :email LIMIT 1`,
    { email }
  )
  const user = rows[0]

  // Si no existe o está inactivo, salimos silenciosamente
  if (!user || !user.activo) return

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // +1 hora

  await createToken(user.id_usuario, tokenHash, expiresAt)
  await sendPasswordResetEmail({ to: email, token })
}

/**
 * Valida el token y aplica la nueva contraseña.
 */
async function resetPassword(rawToken, newPassword) {
  if (!rawToken) throw new HttpError(400, 'Token requerido')
  if (!isStrongPassword(newPassword)) {
    throw new HttpError(
      400,
      'La contraseña debe tener al menos 8 caracteres e incluir letras y números'
    )
  }

  const tokenHash = sha256(rawToken)
  const record = await findValidToken(tokenHash)

  if (!record) {
    throw new HttpError(400, 'El enlace es inválido o ya expiró')
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)

  await query(
    `UPDATE usuarios SET password_hash = :passwordHash WHERE id_usuario = :idUsuario`,
    { passwordHash, idUsuario: record.id_usuario }
  )

  // Invalida todos los tokens pendientes del usuario
  await invalidateUserTokens(record.id_usuario)
}

module.exports = {
  requestPasswordReset,
  resetPassword,
}
