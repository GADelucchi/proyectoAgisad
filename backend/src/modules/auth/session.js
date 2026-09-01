const jwt = require('jsonwebtoken')
const env = require('../../config/env')
const { updateUltimoLogin } = require('./auth.repository')

function buildTokenPayload(user) {
  return {
    idUsuario: user.id_usuario,
    idRol: user.id_rol,
    rol: user.rol,
    username: user.username,
    email: user.email,
    nombre: user.nombre,
  }
}

function buildUserPayload(user) {
  const membresia_vencida = user.rol !== 'paciente' && user.id_membresia && !Number(user.membresia_activa_vigente)

  return {
    ...buildTokenPayload(user),
    membresia: {
      id_membresia: user.id_membresia || null,
      plan_codigo: user.plan_codigo || null,
      plan_nombre: user.plan_nombre || null,
      estado: user.membresia_estado || null,
      pagado_hasta: user.membresia_pagado_hasta || null,
      es_trial: Boolean(user.es_trial),
      fecha_inicio_trial: user.fecha_inicio_trial || null,
      fecha_fin_trial: user.fecha_fin_trial || null,
      activa_vigente: Boolean(user.membresia_activa_vigente),
      membresia_vencida: membresia_vencida,
      permite_turnos: Boolean(user.permite_turnos),
      permite_asistentes: Boolean(user.permite_asistentes),
      limite_asistentes:
        user.limite_asistentes === null || user.limite_asistentes === undefined
          ? null
          : Number(user.limite_asistentes),
      permite_publicar_consultorio: Boolean(user.permite_publicar_consultorio),
    },
  }
}

/**
 * Emite una sesión (JWT + payload de usuario) para un usuario ya validado.
 * La usan tanto login() como la verificación de email (que loguea directo
 * al confirmar el código, sin pedir la contraseña de nuevo).
 */
async function issueSession(user) {
  await updateUltimoLogin(user.id_usuario)

  const token = jwt.sign(buildTokenPayload(user), env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  })

  return {
    token,
    user: buildUserPayload(user),
  }
}

module.exports = {
  buildTokenPayload,
  buildUserPayload,
  issueSession,
}
