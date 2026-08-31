const HttpError = require('../../utils/httpError')
const { query } = require('../../db/query')

const PLAN_ALIASES = {
  starter: 'inicial',
  inicial: 'inicial',
  medium: 'medio',
  medio: 'medio',
  professional: 'profesional',
  profesional: 'profesional',
  gestion: 'empresarial',
  empresarial: 'empresarial',
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePlanCode(value) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '')

  return PLAN_ALIASES[normalized] || normalized
}

async function getCurrentMembershipByUserId(idUsuario) {
  const rows = await query(
    `SELECT
      m.id_membresia,
      m.id_usuario,
      m.id_plan,
      m.plan,
      m.estado,
      m.fecha_inicio,
      m.fecha_fin,
      m.pagado_hasta,
      m.monto_mensual,
      m.auto_renueva,
      m.es_trial,
      m.fecha_inicio_trial,
      m.fecha_fin_trial,
      COALESCE(mp_fallback.id_plan, mp.id_plan) AS plan_id_resuelto,
      COALESCE(mp_fallback.codigo, mp.codigo, m.plan) AS plan_codigo,
      COALESCE(mp_fallback.nombre, mp.nombre, m.plan) AS plan_nombre,
      COALESCE(mp_fallback.vigencia_meses, mp.vigencia_meses, 1) AS vigencia_meses,
      COALESCE(mp_fallback.permite_turnos, mp.permite_turnos, 1) AS permite_turnos,
      COALESCE(mp_fallback.permite_asistentes, mp.permite_asistentes, 1) AS permite_asistentes,
      COALESCE(mp_fallback.limite_asistentes, mp.limite_asistentes) AS limite_asistentes,
      CASE
        WHEN m.estado = 'activa' AND m.es_trial = 1 AND (m.fecha_fin_trial IS NULL OR m.fecha_fin_trial >= CURDATE()) THEN 1
        WHEN m.estado = 'activa' AND m.es_trial = 0 AND (m.pagado_hasta IS NULL OR m.pagado_hasta >= CURDATE()) THEN 1
        ELSE 0
      END AS activa_vigente
    FROM membresias m
    LEFT JOIN membresia_planes mp ON mp.id_plan = m.id_plan
    LEFT JOIN membresia_planes mp_fallback ON LOWER(mp_fallback.codigo) = LOWER(m.plan)
    WHERE m.id_usuario = :idUsuario
    ORDER BY m.id_membresia DESC
    LIMIT 1`,
    { idUsuario }
  )

  return rows[0] || null
}

async function findUserIdByMedicoId(idMedico) {
  const rows = await query(
    `SELECT id_usuario
     FROM medicos
     WHERE id_medico = :idMedico
     LIMIT 1`,
    { idMedico }
  )

  return rows[0]?.id_usuario || null
}

/**
 * Si el usuario es un médico sin membresía propia vigente, busca si algún
 * gerente lo cubre (gerente_medico_beneficios) y devuelve el plan del
 * gerente en su lugar. No aplica a gerentes/asistentes/pacientes.
 */
async function getGerenteCoveredMembershipByUserId(idUsuario) {
  const medicoRows = await query(
    `SELECT id_medico FROM medicos WHERE id_usuario = :idUsuario LIMIT 1`,
    { idUsuario }
  )
  const idMedico = medicoRows[0]?.id_medico
  if (!idMedico) return null

  const beneficioRows = await query(
    `SELECT g.id_usuario AS id_usuario_gerente
     FROM gerente_medico_beneficios gmb
     INNER JOIN gerentes g ON g.id_gerente = gmb.id_gerente
     WHERE gmb.id_medico = :idMedico
       AND gmb.activo = 1
       AND gmb.cubre_membresia = 1
     ORDER BY gmb.creado_en DESC
     LIMIT 1`,
    { idMedico }
  )
  const idUsuarioGerente = beneficioRows[0]?.id_usuario_gerente
  if (!idUsuarioGerente) return null

  const gerenteMembership = await getCurrentMembershipByUserId(idUsuarioGerente)
  if (!gerenteMembership || !Number(gerenteMembership.activa_vigente)) return null

  return { ...gerenteMembership, origen: 'gerente' }
}

async function assertUserFeatureByUserId({ idUsuario, feature, denyMessage }) {
  let membership = await getCurrentMembershipByUserId(idUsuario)

  if (!membership || !Number(membership.activa_vigente)) {
    const cubierta = await getGerenteCoveredMembershipByUserId(idUsuario)
    if (cubierta) {
      membership = cubierta
    } else if (!membership) {
      throw new HttpError(402, 'No tenes una membresia activa para acceder a este modulo')
    } else {
      throw new HttpError(402, 'Tu membresia esta vencida o inactiva')
    }
  }

  if (!Number(membership[feature])) {
    throw new HttpError(403, denyMessage || 'Tu plan actual no incluye este modulo')
  }

  return membership
}

async function assertMedicoFeatureByMedicoId({ idMedico, feature, denyMessage }) {
  const idUsuario = await findUserIdByMedicoId(idMedico)
  if (!idUsuario) {
    throw new HttpError(404, 'Medico no encontrado')
  }

  return assertUserFeatureByUserId({ idUsuario, feature, denyMessage })
}

/**
 * Vigencia "efectiva": propia, o prestada por un gerente que cubra a este
 * médico. Usar para cualquier acción que un médico cubierto por un gerente
 * debe poder seguir haciendo (recibir solicitudes de recetas/mensajes, etc.).
 */
async function assertMembershipNotExpired(idUsuario, actionMessage = 'Esta acción') {
  const membership = await getCurrentMembershipByUserId(idUsuario)

  if (membership && Number(membership.activa_vigente)) {
    return membership
  }

  const cubierta = await getGerenteCoveredMembershipByUserId(idUsuario)
  if (cubierta) {
    return cubierta
  }

  throw new HttpError(402, `${actionMessage} no está disponible porque tu membresía está vencida. Renová tu suscripción para continuar.`)
}

async function assertMembershipNotExpiredByMedicoId(idMedico, actionMessage = 'Esta acción') {
  const idUsuario = await findUserIdByMedicoId(idMedico)
  if (!idUsuario) {
    throw new HttpError(404, 'Medico no encontrado')
  }

  return assertMembershipNotExpired(idUsuario, actionMessage)
}

/**
 * Vigencia estricta, SIN el préstamo de un gerente: para acciones que un
 * médico cubierto por un gerente no debe poder hacer (ej. crear una
 * clínica propia independiente de la que lo invitó).
 */
async function assertOwnMembershipActive(idUsuario, actionMessage = 'Esta acción') {
  const membership = await getCurrentMembershipByUserId(idUsuario)

  if (!membership || !Number(membership.activa_vigente)) {
    throw new HttpError(
      402,
      `${actionMessage} no está disponible porque tu membresía está vencida. Renová tu suscripción para continuar.`
    )
  }

  return membership
}

async function assertOwnMembershipActiveByMedicoId(idMedico, actionMessage = 'Esta acción') {
  const idUsuario = await findUserIdByMedicoId(idMedico)
  if (!idUsuario) {
    throw new HttpError(404, 'Medico no encontrado')
  }

  return assertOwnMembershipActive(idUsuario, actionMessage)
}

module.exports = {
  normalizePlanCode,
  getCurrentMembershipByUserId,
  findUserIdByMedicoId,
  assertUserFeatureByUserId,
  assertMedicoFeatureByMedicoId,
  assertMembershipNotExpired,
  assertMembershipNotExpiredByMedicoId,
  assertOwnMembershipActive,
  assertOwnMembershipActiveByMedicoId,
}
