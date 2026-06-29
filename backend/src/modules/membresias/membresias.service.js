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
      COALESCE(mp.id_plan, mp_fallback.id_plan) AS plan_id_resuelto,
      COALESCE(mp.codigo, mp_fallback.codigo, m.plan) AS plan_codigo,
      COALESCE(mp.nombre, mp_fallback.nombre, m.plan) AS plan_nombre,
      COALESCE(mp.vigencia_meses, mp_fallback.vigencia_meses, 1) AS vigencia_meses,
      COALESCE(mp.permite_turnos, mp_fallback.permite_turnos, 1) AS permite_turnos,
      COALESCE(mp.permite_asistentes, mp_fallback.permite_asistentes, 1) AS permite_asistentes,
      COALESCE(mp.limite_asistentes, mp_fallback.limite_asistentes) AS limite_asistentes,
      CASE
        WHEN m.estado = 'activa' AND (m.pagado_hasta IS NULL OR m.pagado_hasta >= CURDATE()) THEN 1
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

async function assertUserFeatureByUserId({ idUsuario, feature, denyMessage }) {
  const membership = await getCurrentMembershipByUserId(idUsuario)

  if (!membership) {
    throw new HttpError(402, 'No tenes una membresia activa para acceder a este modulo')
  }

  if (!Number(membership.activa_vigente)) {
    throw new HttpError(402, 'Tu membresia esta vencida o inactiva')
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

module.exports = {
  normalizePlanCode,
  getCurrentMembershipByUserId,
  findUserIdByMedicoId,
  assertUserFeatureByUserId,
  assertMedicoFeatureByMedicoId,
}
