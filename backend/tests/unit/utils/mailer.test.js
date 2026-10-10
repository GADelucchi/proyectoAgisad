/**
 * El mailer decide su modo (simulado / roto / resend) al cargarse, según el
 * entorno. Cada caso lo carga en un registro aislado con el entorno que
 * necesita y un SDK de Resend falso.
 */
const mockSend = jest.fn()

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}))

function loadMailer(envOverrides = {}) {
  const previous = {}
  for (const [key, value] of Object.entries(envOverrides)) {
    previous[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  let mailer
  try {
    jest.isolateModules(() => {
      mailer = require('../../../src/utils/mailer')
    })
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  return mailer
}

const RESEND_OK = { NODE_ENV: 'production', RESEND_API_KEY: 're_test_123456', MAIL_FROM: 'Agisad <no-reply@agisad.test>' }

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockSend.mockReset()
  mockSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
})

describe('modo simulado (development)', () => {
  it('no llama a Resend e imprime el mail', async () => {
    const mailer = loadMailer({ NODE_ENV: 'development' })
    await mailer.sendVerificacionEmailCodigo({ to: 'a@x.com', codigo: '123456' })

    expect(mockSend).not.toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL SIMULADO'))
  })
})

describe('modo roto (falta configuración fuera de development)', () => {
  it.each([
    ['sin API key', { NODE_ENV: 'production', RESEND_API_KEY: undefined }, /falta RESEND_API_KEY/],
    ['API key que no es de Resend', { NODE_ENV: 'production', RESEND_API_KEY: 'SG.abc' }, /no parece de Resend/],
    ['sin MAIL_FROM', { ...RESEND_OK, MAIL_FROM: undefined }, /Falta MAIL_FROM/],
  ])('%s: falla ruidosamente en cada envío', async (_caso, env, motivo) => {
    const mailer = loadMailer(env)

    await expect(mailer.sendVerificacionEmailCodigo({ to: 'a@x.com', codigo: '1' })).rejects.toThrow(motivo)
    expect(mockSend).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('LOS MAILS NO SE VAN A ENVIAR'))
  })
})

describe('modo resend', () => {
  it('envía con el remitente y destinatario correctos', async () => {
    const mailer = loadMailer(RESEND_OK)
    await mailer.sendPasswordResetEmail({ to: 'a@x.com', token: 'abc' })

    expect(mockSend).toHaveBeenCalledWith({
      from: 'Agisad <no-reply@agisad.test>',
      to: ['a@x.com'],
      subject: 'Recuperación de contraseña — Agisad',
      text: expect.stringContaining('http://localhost:5173/nueva-password/abc'),
    })
  })

  it('propaga el error cuando Resend rechaza el envío', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'domain not verified' } })
    const mailer = loadMailer(RESEND_OK)
    await expect(mailer.sendVerificacionEmailCodigo({ to: 'a@x.com', codigo: '1' })).rejects.toThrow('Resend rechazó el envío: domain not verified')
  })

  it('propaga errores de red', async () => {
    mockSend.mockRejectedValue(new Error('ETIMEDOUT'))
    const mailer = loadMailer(RESEND_OK)
    await expect(mailer.sendVerificacionEmailCodigo({ to: 'a@x.com', codigo: '1' })).rejects.toThrow('ETIMEDOUT')
  })

  it('usa los remitentes específicos de recetas y turnos', async () => {
    const mailer = loadMailer({ ...RESEND_OK, MAIL_FROM_RECETAS: 'recetas@agisad.test', MAIL_FROM_TURNOS: 'turnos@agisad.test' })
    const medico = { nombre: 'Juan', apellido: 'Gómez' }
    const paciente = { nombre: 'Ana', apellido: 'Paz' }

    await mailer.sendRecetaSolicitudEmail({ to: 'd@x.com', medico, paciente, tipo: 'urgente', items: [{ medicamento: 'Ibuprofeno', dosis: '400mg' }] })
    await mailer.sendTurnoNuevoEmail({ to: 'd@x.com', medico, paciente, fecha: '20/10/2026', hora: '10:00' })

    expect(mockSend.mock.calls[0][0].from).toBe('recetas@agisad.test')
    expect(mockSend.mock.calls[1][0].from).toBe('turnos@agisad.test')
  })
})

describe('contenido de cada mail', () => {
  let mailer
  const medico = { nombre: 'Juan', apellido: 'Gómez' }
  const paciente = { nombre: 'Ana', apellido: 'Paz', dni: '30111222', email: 'ana@x.com' }
  const lastMail = () => mockSend.mock.calls.at(-1)[0]

  beforeEach(() => {
    mailer = loadMailer(RESEND_OK)
  })

  it('receta: tipo, ítems y datos del paciente', async () => {
    await mailer.sendRecetaSolicitudEmail({
      to: 'd@x.com', medico, paciente, tipo: 'estandar',
      items: [{ medicamento: 'Ibuprofeno', dosis: '400mg' }, { medicamento: 'Paracetamol' }],
    })
    const { subject, text } = lastMail()
    expect(subject).toBe('Solicitud de receta estándar — Agisad')
    expect(text).toContain('Estándar (7 días)')
    expect(text).toContain('1. Ibuprofeno — 400mg\n2. Paracetamol')
    expect(text).toContain('Obra social: Particular / Sin cobertura')
    expect(text).toContain('DNI paciente: 30111222')
  })

  it('mensaje del paciente', async () => {
    await mailer.sendPacienteMensajeEmail({ to: 'd@x.com', medico, paciente: { nombre: 'Ana', apellido: 'Paz' }, asunto: 'Dolor', mensaje: 'Hola' })
    expect(lastMail().subject).toBe('Nuevo mensaje de paciente — Dolor')
    expect(lastMail().text).toContain('DNI paciente: N/D')
  })

  it('código de verificación', async () => {
    await mailer.sendVerificacionEmailCodigo({ to: 'a@x.com', codigo: '654321' })
    expect(lastMail().text).toContain('654321')
  })

  it('invitación de gerente', async () => {
    await mailer.sendInvitacionMedicoEmail({ to: 'd@x.com', gerente: { nombre: 'Laura', apellido: 'Ríos' }, clinica: { nombre: 'Sur' }, link: 'http://x/inv' })
    expect(lastMail().subject).toBe('Laura Ríos te invitó a sumarte en Agisad')
    expect(lastMail().text).toContain('http://x/inv')
  })

  it('turno nuevo con y sin tipo', async () => {
    await mailer.sendTurnoNuevoEmail({ to: 'd@x.com', medico, paciente, fecha: '20/10/2026', hora: '10:00', tipoNombre: 'Control' })
    expect(lastMail().subject).toBe('Nuevo turno (Control) — Agisad')
    expect(lastMail().text).toContain('Tipo de turno: Control')

    await mailer.sendTurnoNuevoEmail({ to: 'd@x.com', medico, paciente: null, fecha: '20/10/2026', hora: '10:00' })
    expect(lastMail().subject).toBe('Nuevo turno agendado — Agisad')
    expect(lastMail().text).not.toContain('Tipo de turno')
  })

  it('turno cancelado', async () => {
    await mailer.sendTurnoCanceladoEmail({ to: 'd@x.com', medico, paciente, fecha: '20/10/2026', hora: '10:00', canceladoPor: 'el paciente' })
    expect(lastMail().text).toContain('Cancelado por: el paciente')
  })

  it('solicitud de consultorio con y sin mensaje', async () => {
    await mailer.sendSolicitudConsultorioEmail({ to: 'o@x.com', medico, consultorio: { nombre: 'Sala 1' }, mensaje: 'Hola' })
    expect(lastMail().subject).toBe('Solicitud para usar "Sala 1" — Agisad')
    expect(lastMail().text).toContain('Mensaje: Hola')

    await mailer.sendSolicitudConsultorioEmail({ to: 'o@x.com', medico, consultorio: { nombre: 'Sala 1' } })
    expect(lastMail().text).not.toContain('Mensaje:')
  })

  it('solicitud resuelta: aprobada y rechazada', async () => {
    await mailer.sendSolicitudResueltaEmail({ to: 'd@x.com', consultorio: { nombre: 'Sala 1' }, aprobada: true })
    expect(lastMail().subject).toBe('Solicitud aprobada — Sala 1')

    await mailer.sendSolicitudResueltaEmail({ to: 'd@x.com', consultorio: { nombre: 'Sala 1' }, aprobada: false, motivo: 'Sin lugar' })
    expect(lastMail().subject).toBe('Solicitud rechazada — Sala 1')
    expect(lastMail().text).toContain('Motivo: Sin lugar')
  })
})
