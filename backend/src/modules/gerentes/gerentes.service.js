const crypto = require('crypto')
const HttpError = require('../../utils/httpError')
const env = require('../../config/env')
const { query } = require('../../db/query')
const repo = require('./gerentes.repository')
const { sendInvitacionMedicoEmail } = require('../../utils/mailer')
const authService = require('../auth/auth.service')

const INVITACION_VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000 // 7 días

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function resolveGerenteOrThrow({ requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'gerente') {
    throw new HttpError(403, 'Solo gerentes pueden acceder a este módulo')
  }
  const gerente = await repo.findGerenteByUserId(requesterIdUsuario)
  if (!gerente) {
    throw new HttpError(404, 'Gerente no encontrado')
  }
  return gerente
}

async function listMisClinicas({ requesterIdUsuario, requesterRol }) {
  const gerente = await resolveGerenteOrThrow({ requesterIdUsuario, requesterRol })
  return repo.listClinicasByGerente(gerente.id_gerente)
}

async function crearInvitacion({ idClinica, email, requesterIdUsuario, requesterRol }) {
  const gerente = await resolveGerenteOrThrow({ requesterIdUsuario, requesterRol })

  const emailNormalizado = String(email || '').trim().toLowerCase()
  if (!emailNormalizado || !emailNormalizado.includes('@')) {
    throw new HttpError(400, 'Email inválido')
  }

  const clinica = await repo.findClinicaOwnedByGerente({ idGerente: gerente.id_gerente, idClinica })
  if (!clinica) {
    throw new HttpError(404, 'La clínica no existe o no te pertenece')
  }

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = sha256(token)
  const expiraEn = new Date(Date.now() + INVITACION_VIGENCIA_MS)

  await repo.createInvitacion({
    idGerente: gerente.id_gerente,
    idClinica: clinica.id_clinica,
    email: emailNormalizado,
    tokenHash,
    expiraEn,
  })

  const link = `${env.FRONTEND_URL}/invitacion/${token}`

  try {
    await sendInvitacionMedicoEmail({
      to: emailNormalizado,
      gerente,
      clinica,
      link,
    })
  } catch (err) {
    // No hacemos fallar la invitación si el mail no sale: el gerente puede
    // copiar el link manualmente. Se registra igual para diagnóstico.
    console.error('[gerentes] no se pudo enviar el mail de invitación:', err.message)
  }

  return { email: emailNormalizado, clinica: clinica.nombre, link }
}

async function listInvitaciones({ requesterIdUsuario, requesterRol }) {
  const gerente = await resolveGerenteOrThrow({ requesterIdUsuario, requesterRol })
  return repo.listInvitacionesByGerente(gerente.id_gerente)
}

async function revocarInvitacion({ idInvitacion, requesterIdUsuario, requesterRol }) {
  const gerente = await resolveGerenteOrThrow({ requesterIdUsuario, requesterRol })
  const invitacion = await repo.findInvitacionPendienteById({ idInvitacion, idGerente: gerente.id_gerente })
  if (!invitacion) {
    throw new HttpError(404, 'Invitación no encontrada o ya no está pendiente')
  }
  await repo.updateInvitacionEstado({ idInvitacion, estado: 'revocada' })
}

async function listMedicosEquipo({ requesterIdUsuario, requesterRol }) {
  const gerente = await resolveGerenteOrThrow({ requesterIdUsuario, requesterRol })
  return repo.listMedicosByGerente(gerente.id_gerente)
}

async function desvincularMedico({ idMedico, idClinica, requesterIdUsuario, requesterRol }) {
  const gerente = await resolveGerenteOrThrow({ requesterIdUsuario, requesterRol })
  const clinica = await repo.findClinicaOwnedByGerente({ idGerente: gerente.id_gerente, idClinica })
  if (!clinica) {
    throw new HttpError(404, 'La clínica no existe o no te pertenece')
  }
  await repo.unlinkGerenteMedicoBeneficio({ idGerente: gerente.id_gerente, idMedico, idClinica })
  await repo.unlinkMedicoDeClinica({ idMedico, idClinica })
}

async function resolveInvitacionVigente(token) {
  const tokenHash = sha256(String(token || ''))
  const invitacion = await repo.findInvitacionByTokenHash(tokenHash)

  if (!invitacion) {
    throw new HttpError(404, 'La invitación no existe')
  }
  if (invitacion.estado !== 'pendiente') {
    throw new HttpError(410, 'Esta invitación ya fue utilizada o fue revocada')
  }
  if (new Date(invitacion.expira_en) < new Date()) {
    throw new HttpError(410, 'Esta invitación expiró')
  }

  return invitacion
}

async function getInvitacionPublica(token) {
  const invitacion = await resolveInvitacionVigente(token)
  return {
    clinica: { nombre: invitacion.clinica_nombre },
    gerente: { nombre: invitacion.gerente_nombre, apellido: invitacion.gerente_apellido },
    email_invitado: invitacion.email_invitado,
  }
}

async function vincularAceptacion({ invitacion, idMedico }) {
  await repo.linkMedicoAClinica({ idMedico, idClinica: invitacion.id_clinica })
  await repo.linkGerenteMedicoBeneficio({
    idGerente: invitacion.id_gerente,
    idMedico,
    idClinica: invitacion.id_clinica,
  })
  await repo.marcarInvitacionAceptada({ idInvitacion: invitacion.id_invitacion, idMedico })
}

/**
 * Acepta la invitación para un médico que YA tiene cuenta (logueado).
 * Su membresía propia, si tiene, no se toca: solo se agrega el vínculo
 * a la clínica del gerente.
 */
async function aceptarInvitacionAutenticado({ token, requesterIdUsuario, requesterRol, requesterEmail }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo médicos pueden aceptar esta invitación')
  }

  const invitacion = await resolveInvitacionVigente(token)

  if (String(requesterEmail || '').toLowerCase() !== invitacion.email_invitado) {
    throw new HttpError(403, 'Esta invitación es para otro email. Iniciá sesión con la cuenta invitada.')
  }

  const medicoRows = await query(
    `SELECT id_medico FROM medicos WHERE id_usuario = :idUsuario LIMIT 1`,
    { idUsuario: requesterIdUsuario }
  )
  const idMedico = medicoRows[0]?.id_medico
  if (!idMedico) {
    throw new HttpError(404, 'No se encontró el perfil de médico de esta cuenta')
  }

  await vincularAceptacion({ invitacion, idMedico })

  return { id_clinica: invitacion.id_clinica, clinica: invitacion.clinica_nombre }
}

/**
 * Da de alta a un médico nuevo a partir de una invitación: sin plan propio
 * (no se crea fila en membresias), queda cubierto por el gerente que invita.
 */
async function registrarViaInvitacion({ token, datosMedico }) {
  const invitacion = await resolveInvitacionVigente(token)

  const registro = await authService.registerMedico({
    ...datosMedico,
    email: invitacion.email_invitado,
    plan: undefined, // a propósito: sin plan, sin fila en `membresias`
  })

  await vincularAceptacion({ invitacion, idMedico: registro.id_medico })

  return {
    id_usuario: registro.id_usuario,
    id_medico: registro.id_medico,
    username: registro.username,
    email: registro.email,
    rol: 'medico',
    clinica: invitacion.clinica_nombre,
    estado_onboarding: 'cubierto_por_gerente',
  }
}

module.exports = {
  listMisClinicas,
  crearInvitacion,
  listInvitaciones,
  revocarInvitacion,
  listMedicosEquipo,
  desvincularMedico,
  getInvitacionPublica,
  aceptarInvitacionAutenticado,
  registrarViaInvitacion,
}
