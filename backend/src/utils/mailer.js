const nodemailer = require('nodemailer')
const env = require('../config/env')

const RESEND_API_URL = 'https://api.resend.com/emails'
const ENVIO_TIMEOUT_MS = 15000

function esApiKeyResend(value) {
  return typeof value === 'string' && value.startsWith('re_')
}

/**
 * Envía por la API HTTP de Resend en vez de SMTP.
 *
 * Render (y varios PaaS) bloquean los puertos SMTP salientes (465/587), así que
 * conectarse a smtp.resend.com desde ahí termina siempre en ETIMEDOUT. La API va
 * por HTTPS, que nunca está bloqueado. Se usa la misma API key que el SMTP.
 */
function createResendHttpTransporter() {
  return {
    sendMail: async ({ from, to, subject, text, html }) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), ENVIO_TIMEOUT_MS)

      try {
        const res = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.MAIL_PASSWORD}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: Array.isArray(to) ? to : [to],
            subject,
            ...(text ? { text } : {}),
            ...(html ? { html } : {}),
          }),
          signal: controller.signal,
        })

        const payload = await res.json().catch(() => ({}))

        if (!res.ok) {
          const detalle = payload?.message || payload?.name || `HTTP ${res.status}`
          throw new Error(`Resend rechazó el envío: ${detalle}`)
        }

        return { messageId: payload?.id || 'resend-api' }
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new Error(`Timeout al contactar la API de Resend (${ENVIO_TIMEOUT_MS}ms)`)
        }
        throw err
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

/**
 * Crea el transporter según el entorno.
 * En desarrollo (o sin MAIL_HOST) simula el envío por consola.
 */
function createTransporter() {
  if (env.NODE_ENV === 'development' || !env.MAIL_HOST) {
    return {
      sendMail: async (opts) => {
        console.log('\n📧  EMAIL SIMULADO (NODE_ENV=development)')
        console.log(`   Para:    ${opts.to}`)
        console.log(`   Asunto:  ${opts.subject}`)
        console.log('   ---')
        console.log(opts.text || opts.html || '')
        console.log('---\n')
        return { messageId: 'dev-simulated' }
      },
    }
  }

  if (esApiKeyResend(env.MAIL_PASSWORD)) {
    return createResendHttpTransporter()
  }

  return nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_PORT === 465,
    auth: {
      user: env.MAIL_USER,
      pass: env.MAIL_PASSWORD,
    },
  })
}

const transporter = createTransporter()

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
