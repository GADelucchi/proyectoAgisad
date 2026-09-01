const crypto = require('crypto')
const HttpError = require('../../utils/httpError')
const { query } = require('../../db/query')
const { findUserByEmail, findUserById } = require('../auth/auth.repository')
const { issueSession } = require('../auth/session')
const { sendVerificacionEmailCodigo } = require('../../utils/mailer')
const {
  createCodigo,
  findVigente,
  incrementarIntentos,
  marcarUsado,
  invalidarPendientes,
} = require('./email-verification.repository')

const CODIGO_VIGENCIA_MS = 15 * 60 * 1000 // 15 minutos
const REENVIO_COOLDOWN_MS = 45 * 1000 // 45 segundos
const MAX_INTENTOS = 5

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function generarCodigo() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

async function marcarUsuarioVerificado(idUsuario) {
  await query(`UPDATE usuarios SET email_verificado = 1 WHERE id_usuario = :idUsuario`, { idUsuario })
}

/**
 * Genera y envía un código nuevo, invalidando cualquier otro pendiente.
 * La usan el registro (auth.service.js) y el reenvío.
 */
async function emitirCodigo(idUsuario, email) {
  await invalidarPendientes(idUsuario)

  const codigo = generarCodigo()
  const codigoHash = sha256(codigo)
  const expiraEn = new Date(Date.now() + CODIGO_VIGENCIA_MS)

  await createCodigo({ idUsuario, codigoHash, expiraEn })
  await sendVerificacionEmailCodigo({ to: email, codigo })
}

/**
 * Pide un reenvío por email. Silencioso si el email no existe (no revela
 * qué cuentas están registradas), igual que password-reset.
 */
async function solicitarReenvio(email) {
  if (!email) throw new HttpError(400, 'El email es obligatorio')

  const user = await findUserByEmail(email)
  if (!user || !user.activo) return
  if (user.email_verificado) return

  const vigente = await findVigente(user.id_usuario)
  if (vigente) {
    const antiguedadMs = Date.now() - new Date(vigente.creado_en).getTime()
    if (antiguedadMs < REENVIO_COOLDOWN_MS) {
      const esperaSeg = Math.ceil((REENVIO_COOLDOWN_MS - antiguedadMs) / 1000)
      throw new HttpError(429, `Esperá ${esperaSeg} segundos antes de pedir otro código.`)
    }
  }

  await emitirCodigo(user.id_usuario, user.email)
}

/**
 * Valida el código y, si es correcto, deja al usuario logueado (evita
 * pedirle la contraseña de nuevo justo después de haberla creado).
 */
async function verificarCodigo({ email, codigo }) {
  if (!email || !codigo) {
    throw new HttpError(400, 'Email y código son obligatorios')
  }

  const user = await findUserByEmail(email)
  if (!user) {
    throw new HttpError(400, 'El código es inválido o expiró')
  }

  if (user.email_verificado) {
    const fresh = await findUserById(user.id_usuario)
    return issueSession(fresh)
  }

  const vigente = await findVigente(user.id_usuario)
  if (!vigente) {
    throw new HttpError(400, 'El código es inválido o expiró. Pedí uno nuevo.')
  }

  if (vigente.intentos >= MAX_INTENTOS) {
    throw new HttpError(429, 'Superaste el máximo de intentos. Pedí un código nuevo.')
  }

  if (sha256(String(codigo).trim()) !== vigente.codigo_hash) {
    await incrementarIntentos(vigente.id_verificacion)
    throw new HttpError(400, 'El código ingresado es incorrecto')
  }

  await marcarUsado(vigente.id_verificacion)
  await marcarUsuarioVerificado(user.id_usuario)
  await invalidarPendientes(user.id_usuario)

  const fresh = await findUserById(user.id_usuario)
  return issueSession(fresh)
}

module.exports = {
  emitirCodigo,
  solicitarReenvio,
  verificarCodigo,
}
