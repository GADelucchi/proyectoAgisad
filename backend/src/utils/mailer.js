const { Resend } = require('resend')
const env = require('../config/env')

// La API key puede venir con el nombre convencional de Resend o reusando el que
// ya se usaba para SMTP. Se aceptan los dos para no depender de cómo quedó
// nombrada la variable en cada entorno.
const API_KEY = env.RESEND_API_KEY || null

function apiKeyValida(value) {
  return typeof value === 'string' && value.startsWith('re_')
}

/**
 * Pista de la key para los logs: nunca la key completa, solo lo justo para
 * saber cuál está cargada si hay más de un entorno.
 */
function pistaKey(value) {
  if (!value) return '(ausente)'
  if (typeof value !== 'string') return '(tipo inválido)'
  return `${value.slice(0, 6)}…${value.slice(-4)} (${value.length} chars)`
}

/**
 * Decide cómo se mandan los mails y deja constancia en el log del arranque.
 *
 * Importante: NO se simula fuera de development. Antes, si faltaba una variable
 * en producción el sistema simulaba en silencio y los mails desaparecían sin
 * ningún error visible. Ahora eso falla ruidosamente.
 */
function resolverModo() {
  const esDesarrollo = env.NODE_ENV === 'development'

  if (esDesarrollo) {
    return { modo: 'simulado', motivo: 'NODE_ENV=development' }
  }

  if (!API_KEY) {
    return {
      modo: 'roto',
      motivo: 'No hay API key: falta RESEND_API_KEY (o MAIL_PASSWORD) en el entorno',
    }
  }

  if (!apiKeyValida(API_KEY)) {
    return {
      modo: 'roto',
      motivo: `La API key no parece de Resend (debería empezar con "re_"): ${pistaKey(API_KEY)}`,
    }
  }

  if (!env.MAIL_FROM) {
    return { modo: 'roto', motivo: 'Falta MAIL_FROM en el entorno' }
  }

  return { modo: 'resend', motivo: 'API HTTP de Resend' }
}

const { modo, motivo } = resolverModo()

console.log('[mailer] ── configuración de envío ──')
console.log(`[mailer] NODE_ENV        : ${env.NODE_ENV || '(sin definir)'}`)
console.log(`[mailer] modo            : ${modo} (${motivo})`)
console.log(`[mailer] API key         : ${pistaKey(API_KEY)}`)
console.log(`[mailer] MAIL_FROM       : ${env.MAIL_FROM || '(ausente)'}`)
console.log(`[mailer] MAIL_FROM_RECETAS: ${env.MAIL_FROM_RECETAS || '(ausente)'}`)
console.log(`[mailer] MAIL_FROM_TURNOS : ${env.MAIL_FROM_TURNOS || '(ausente)'}`)
if (modo === 'roto') {
  console.error(`[mailer] ⚠️  LOS MAILS NO SE VAN A ENVIAR: ${motivo}`)
}
console.log('[mailer] ───────────────────────────')

const resend = modo === 'resend' ? new Resend(API_KEY) : null

/**
 * Punto único de envío. Todas las funciones de abajo pasan por acá, así que
 * cualquier mail queda registrado en el log con su resultado.
 */
async function enviar({ from, to, subject, text }) {
  const destino = Array.isArray(to) ? to.join(', ') : to

  if (modo === 'simulado') {
    console.log('\n📧  EMAIL SIMULADO (NODE_ENV=development)')
    console.log(`   De:      ${from}`)
    console.log(`   Para:    ${destino}`)
    console.log(`   Asunto:  ${subject}`)
    console.log('   ---')
    console.log(text || '')
    console.log('---\n')
    return { id: 'dev-simulated' }
  }

  if (modo === 'roto') {
    console.error(`[mailer] ✖ No se envía "${subject}" a ${destino}: ${motivo}`)
    throw new Error(`Envío de mail no configurado: ${motivo}`)
  }

  console.log(`[mailer] → enviando "${subject}" de ${from} a ${destino}`)

  let data
  let error
  try {
    ({ data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
    }))
  } catch (err) {
    // Error de red/DNS/timeout: nunca llegó a la API.
    console.error(`[mailer] ✖ fallo de red al contactar Resend: ${err.message}`)
    throw err
  }

  // El SDK devuelve el error en el payload en vez de tirar excepción.
  if (error) {
    const detalle = error.message || error.name || JSON.stringify(error)
    console.error(`[mailer] ✖ Resend rechazó "${subject}" para ${destino}: ${detalle}`)
    throw new Error(`Resend rechazó el envío: ${detalle}`)
  }

  console.log(`[mailer] ✔ enviado "${subject}" a ${destino} (id: ${data?.id || 's/id'})`)
  return data
}

// Mantiene la interfaz que ya usaban todas las funciones de este archivo.
const transporter = { sendMail: enviar }

/**
 * Envía el correo de recuperación de contraseña.
 * @param {{ to: string, token: string }} params
 */
async function sendPasswordResetEmail({ to, token }) {
  const link = `${env.FRONTEND_URL}/nueva-password/${token}`

  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: 'Recuperación de contraseña — Agisad',
    text: [
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta en Agisad.',
      '',
      'Hacé clic en el siguiente enlace para crear una nueva contraseña:',
      link,
      '',
      'El enlace expira en 1 hora.',
      '',
      'Si no solicitaste este cambio, podés ignorar este mensaje.',
      '',
      '— Agisad',
    ].join('\n'),
  })
}

async function sendRecetaSolicitudEmail({ to, medico, paciente, tipo, items }) {
  const tipoLabel = tipo === 'urgente' ? 'Urgente (24 h)' : 'Estándar (7 días)'
  const itemsText = items
    .map((item, idx) => `${idx + 1}. ${item.medicamento}${item.dosis ? ` — ${item.dosis}` : ''}`)
    .join('\n')

  await transporter.sendMail({
    from: env.MAIL_FROM_RECETAS,
    to,
    subject: `Solicitud de receta ${tipo === 'urgente' ? 'urgente' : 'estándar'} — Agisad`,
    text: [
      'Nueva solicitud de receta recibida en Agisad.',
      '',
      `Médico: Dr./Dra. ${medico.nombre} ${medico.apellido}`,
      `Paciente: ${paciente.nombre} ${paciente.apellido}`,
      `DNI paciente: ${paciente.dni || 'N/D'}`,
      `Email paciente: ${paciente.email || 'N/D'}`,
      `Obra social: ${paciente.obra_social || 'Particular / Sin cobertura'}`,
      `Nro afiliado: ${paciente.nro_obra_social || 'N/D'}`,
      `Tipo de receta: ${tipoLabel}`,
      '',
      'Detalle solicitado:',
      itemsText,
      '',
      '— Agisad',
    ].join('\n'),
  })
}

async function sendPacienteMensajeEmail({ to, medico, paciente, asunto, mensaje }) {
  await transporter.sendMail({
    from: env.MAIL_FROM_RECETAS,
    to,
    subject: `Nuevo mensaje de paciente — ${asunto}`,
    text: [
      'Nuevo mensaje recibido en Agisad.',
      '',
      `Medico: Dr./Dra. ${medico.nombre} ${medico.apellido}`,
      `Paciente: ${paciente.nombre} ${paciente.apellido}`,
      `DNI paciente: ${paciente.dni || 'N/D'}`,
      `Email paciente: ${paciente.email || 'N/D'}`,
      `Obra social: ${paciente.obra_social || 'Particular / Sin cobertura'}`,
      `Nro afiliado: ${paciente.nro_obra_social || 'N/D'}`,
      '',
      `Asunto: ${asunto}`,
      'Mensaje:',
      mensaje,
      '',
      '— Agisad',
    ].join('\n'),
  })
}

async function sendVerificacionEmailCodigo({ to, codigo }) {
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: 'Verificá tu email — Agisad',
    text: [
      'Bienvenido a Agisad.',
      '',
      'Tu código de verificación es:',
      '',
      `   ${codigo}`,
      '',
      'Ingresalo en la pantalla de verificación para activar tu cuenta.',
      'El código expira en 15 minutos.',
      '',
      'Si no creaste una cuenta en Agisad, podés ignorar este mensaje.',
      '',
      '— Agisad',
    ].join('\n'),
  })
}

async function sendInvitacionMedicoEmail({ to, gerente, clinica, link }) {
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `${gerente.nombre} ${gerente.apellido} te invitó a sumarte en Agisad`,
    text: [
      `${gerente.nombre} ${gerente.apellido} te invitó a atender en "${clinica.nombre}" a través de Agisad.`,
      '',
      'Hacé clic en el siguiente enlace para aceptar la invitación:',
      link,
      '',
      'El enlace es personal, de un solo uso, y expira en 7 días.',
      '',
      '— Agisad',
    ].join('\n'),
  })
}

async function sendTurnoNuevoEmail({ to, medico, paciente, fecha, hora, tipoNombre }) {
  await transporter.sendMail({
    from: env.MAIL_FROM_TURNOS,
    to,
    subject: tipoNombre ? `Nuevo turno (${tipoNombre}) — Agisad` : 'Nuevo turno agendado — Agisad',
    text: [
      `Se agendó un nuevo turno con Dr./Dra. ${medico.nombre} ${medico.apellido}.`,
      '',
      `Paciente: ${paciente?.nombre || ''} ${paciente?.apellido || ''}`.trim(),
      `Fecha: ${fecha}`,
      `Hora: ${hora}`,
      tipoNombre ? `Tipo de turno: ${tipoNombre}` : null,
      '',
      '— Agisad',
    ].filter((line) => line !== null).join('\n'),
  })
}

async function sendTurnoCanceladoEmail({ to, medico, paciente, fecha, hora, canceladoPor }) {
  await transporter.sendMail({
    from: env.MAIL_FROM_TURNOS,
    to,
    subject: 'Turno cancelado — Agisad',
    text: [
      `Se canceló un turno con Dr./Dra. ${medico.nombre} ${medico.apellido}.`,
      '',
      `Paciente: ${paciente?.nombre || ''} ${paciente?.apellido || ''}`.trim(),
      `Fecha: ${fecha}`,
      `Hora: ${hora}`,
      canceladoPor ? `Cancelado por: ${canceladoPor}` : null,
      '',
      '— Agisad',
    ].filter((line) => line !== null).join('\n'),
  })
}

async function sendSolicitudConsultorioEmail({ to, medico, consultorio, mensaje }) {
  await transporter.sendMail({
    from: env.MAIL_FROM_TURNOS,
    to,
    subject: `Solicitud para usar "${consultorio.nombre}" — Agisad`,
    text: [
      `Dr./Dra. ${medico.nombre} ${medico.apellido} solicitó vincularse a tu consultorio "${consultorio.nombre}".`,
      '',
      mensaje ? `Mensaje: ${mensaje}` : null,
      '',
      'Entrá a Agisad para aceptar o rechazar la solicitud.',
      '',
      '— Agisad',
    ].filter((line) => line !== null).join('\n'),
  })
}

async function sendSolicitudResueltaEmail({ to, consultorio, aprobada, motivo }) {
  await transporter.sendMail({
    from: env.MAIL_FROM_TURNOS,
    to,
    subject: aprobada
      ? `Solicitud aprobada — ${consultorio.nombre}`
      : `Solicitud rechazada — ${consultorio.nombre}`,
    text: [
      aprobada
        ? `Tu solicitud para usar el consultorio "${consultorio.nombre}" fue aprobada.`
        : `Tu solicitud para usar el consultorio "${consultorio.nombre}" fue rechazada.`,
      '',
      aprobada
        ? 'Ya podés ver sus horarios disponibles y agendar desde tu panel.'
        : (motivo ? `Motivo: ${motivo}` : null),
      '',
      '— Agisad',
    ].filter((line) => line !== null).join('\n'),
  })
}

module.exports = {
  sendPasswordResetEmail,
  sendSolicitudConsultorioEmail,
  sendSolicitudResueltaEmail,
  sendRecetaSolicitudEmail,
  sendPacienteMensajeEmail,
  sendInvitacionMedicoEmail,
  sendVerificacionEmailCodigo,
  sendTurnoNuevoEmail,
  sendTurnoCanceladoEmail,
}
