const nodemailer = require('nodemailer')
const env = require('../config/env')

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

module.exports = {
  sendPasswordResetEmail,
  sendRecetaSolicitudEmail,
  sendPacienteMensajeEmail,
  sendInvitacionMedicoEmail,
  sendVerificacionEmailCodigo,
  sendTurnoNuevoEmail,
  sendTurnoCanceladoEmail,
}
