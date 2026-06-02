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
    from: env.MAIL_FROM,
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

module.exports = { sendPasswordResetEmail, sendRecetaSolicitudEmail }
