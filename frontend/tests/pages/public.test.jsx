import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    registerPaciente: vi.fn(),
    registerMedico: vi.fn(),
    registerGerente: vi.fn(),
    registerPropietario: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    verificarEmail: vi.fn(),
    reenviarCodigo: vi.fn(),
  },
}))
vi.mock('../../src/services/gerentes.api', () => ({
  gerentesApi: { getInvitacionPorToken: vi.fn(), aceptarInvitacion: vi.fn(), registrarViaInvitacion: vi.fn() },
}))

import { authApi } from '../../src/services/auth.api'
import { gerentesApi } from '../../src/services/gerentes.api'
import { ApiError } from '../../src/services/apiClient'
import ContactoPage from '../../src/pages/public/ContactoPage'
import InvitacionPage from '../../src/pages/public/InvitacionPage'
import LandingPage from '../../src/pages/public/LandingPage'
import LoginPage from '../../src/pages/public/LoginPage'
import NotFoundPage from '../../src/pages/public/NotFoundPage'
import NuevaPasswordPage from '../../src/pages/public/NuevaPasswordPage'
import PrivacidadPage from '../../src/pages/public/PrivacidadPage'
import RecuperarPasswordPage from '../../src/pages/public/RecuperarPasswordPage'
import RegistroMedicoPage from '../../src/pages/public/RegistroMedicoPage'
import RegistroPacientePage from '../../src/pages/public/RegistroPacientePage'
import RegistroPage from '../../src/pages/public/RegistroPage'
import RegistroPropietarioPage from '../../src/pages/public/RegistroPropietarioPage'
import TerminosPage from '../../src/pages/public/TerminosPage'
import VerificarEmailPage from '../../src/pages/public/VerificarEmailPage'
import { renderWithProviders } from '../helpers/render'

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const location = () => screen.getByTestId('location')

describe('páginas estáticas', () => {
  it.each([
    ['LandingPage', LandingPage, /Agisad/],
    ['ContactoPage', ContactoPage, 'Contacto'],
    ['TerminosPage', TerminosPage, 'Términos y condiciones'],
    ['PrivacidadPage', PrivacidadPage, /privacidad/i],
    ['NotFoundPage', NotFoundPage, 'Página no encontrada'],
  ])('%s renderiza', (_name, Page, heading) => {
    renderWithProviders(<Page />)
    expect(screen.getAllByRole('heading', { name: heading }).length).toBeGreaterThan(0)
  })

  it('RegistroPage ofrece los tres tipos de cuenta', () => {
    renderWithProviders(<RegistroPage />)
    expect(screen.getByRole('link', { name: 'Crear cuenta de paciente' })).toHaveAttribute('href', '/registro/paciente')
    expect(screen.getByRole('link', { name: 'Crear cuenta profesional' })).toHaveAttribute('href', '/registro/profesional')
    expect(screen.getByRole('link', { name: 'Crear cuenta de propietario' })).toHaveAttribute('href', '/registro/propietario')
  })
})

describe('LoginPage', () => {
  async function loginCon(email, password) {
    renderWithProviders(<LoginPage />, { route: '/login' })
    if (email) await userEvent.type(screen.getByLabelText('Email'), email)
    if (password) await userEvent.type(screen.getByLabelText('Contraseña'), password)
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  }

  it('exige ambos campos', async () => {
    await loginCon('a@x.com', '')
    expect(screen.getByText('Completá todos los campos.')).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it.each([
    ['admin', '/admin'],
    ['medico', '/medico'],
    ['asistente', '/asistente'],
    ['gerente', '/gerente'],
    ['propietario', '/propietario'],
    ['paciente', '/paciente'],
  ])('un %s va a %s', async (rol, destino) => {
    authApi.login.mockResolvedValue({ token: 't', user: { nombre: 'X', rol } })
    await loginCon('a@x.com', 'clave1234')
    await waitFor(() => expect(location()).toHaveTextContent(destino))
  })

  it('con el email sin verificar lleva a verificarlo', async () => {
    authApi.login.mockRejectedValue(new ApiError(403, 'No verificado', { code: 'EMAIL_NO_VERIFICADO' }))
    await loginCon('a@x.com', 'clave1234')
    await waitFor(() => expect(location()).toHaveTextContent('/verificar-email'))
  })

  it.each([
    [new ApiError(401, 'x'), 'Credenciales incorrectas.'],
    [new ApiError(429, 'Demasiados intentos'), 'Demasiados intentos'],
    [new Error('red'), 'No se pudo iniciar sesión.'],
  ])('muestra el error %#', async (error, mensaje) => {
    authApi.login.mockRejectedValue(error)
    await loginCon('a@x.com', 'clave1234')
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
  })

  it('el link de olvidé contraseña lleva a recuperarla', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })
    await userEvent.click(screen.getByRole('button', { name: 'Olvidé contraseña' }))
    expect(location()).toHaveTextContent('/recuperar-password')
  })
})

describe('RegistroPacientePage', () => {
  async function completar({ confirmar, ...overrides } = {}) {
    const datos = {
      Nombre: 'Ana', Apellido: 'Paz', DNI: '30111222', Teléfono: '2214563895', Email: 'Ana@x.com',
      'Obra social': 'OSDE', 'Nro. de afiliado': '123', ...overrides,
    }
    for (const [label, value] of Object.entries(datos)) {
      if (value) await userEvent.type(screen.getByLabelText(label), value)
    }
    await userEvent.type(screen.getByPlaceholderText('DD/MM/AAAA'), '01051990')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), confirmar || 'clave1234')
    await userEvent.click(screen.getByRole('checkbox'))
  }

  it('no deja enviar sin aceptar TyC', () => {
    renderWithProviders(<RegistroPacientePage />)
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  })

  it('valida DNI y contraseñas', async () => {
    renderWithProviders(<RegistroPacientePage />)
    await completar({ DNI: '123' })
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByText('DNI inválido (7 u 8 dígitos).')).toBeInTheDocument()
  })

  it('rechaza contraseñas que el backend no aceptaría', async () => {
    renderWithProviders(<RegistroPacientePage />)
    await completar()
    await userEvent.clear(screen.getByLabelText('Contraseña'))
    await userEvent.type(screen.getByLabelText('Contraseña'), 'abcdef')
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument()
    expect(authApi.registerPaciente).not.toHaveBeenCalled()
  })

  it('valida que las contraseñas coincidan', async () => {
    renderWithProviders(<RegistroPacientePage />)
    await completar({ confirmar: 'otra1234' })
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
  })

  it('registra al paciente y lo manda a verificar el email', async () => {
    authApi.registerPaciente.mockResolvedValue({})
    renderWithProviders(<RegistroPacientePage />)
    await completar()
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(authApi.registerPaciente).toHaveBeenCalledWith({
      username: 'ana', email: 'Ana@x.com', password: 'clave1234', dni: '30111222', nombre: 'Ana', apellido: 'Paz',
      telefono: '+5492214563895', fecha_nac: '1990-05-01', obra_social: 'OSDE', nro_obra_social: '123', acepta_tyc: true,
    })
    await waitFor(() => expect(location()).toHaveTextContent('/verificar-email'))
  })

  it('muestra el error del backend', async () => {
    authApi.registerPaciente.mockRejectedValue(new ApiError(409, 'Username, email o DNI ya existen'))
    renderWithProviders(<RegistroPacientePage />)
    await completar()
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByText('Username, email o DNI ya existen')).toBeInTheDocument()
  })
})

describe('RegistroMedicoPage', () => {
  async function completarBase() {
    await userEvent.type(screen.getByLabelText('Nombre'), 'Juan')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Gómez')
    await userEvent.type(screen.getByLabelText('Email'), 'doc@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'clave1234')
    await userEvent.click(screen.getByRole('checkbox'))
  }

  const crearMedico = () => screen.getByRole('button', { name: 'Crear cuenta de médico' })

  it('registra un médico con especialidad nueva', async () => {
    authApi.registerMedico.mockResolvedValue({})
    renderWithProviders(<RegistroMedicoPage />)
    await completarBase()
    await userEvent.type(screen.getByLabelText('DNI'), '20111222')
    await userEvent.type(screen.getByLabelText('Matrícula'), 'MP-1')
    await userEvent.selectOptions(screen.getByLabelText('Especialidad'), '__otra__')
    await userEvent.click(crearMedico())
    expect(screen.getByText('Ingresá la nueva especialidad.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nueva especialidad'), ' Endocrinología ')
    await userEvent.click(crearMedico())

    expect(authApi.registerMedico).toHaveBeenCalledWith(expect.objectContaining({
      email: 'doc@x.com', dni: '20111222', matricula: 'MP-1', especialidad: 'Endocrinología', plan: 'medio', acepta_tyc: true,
    }))
    expect(authApi.registerGerente).not.toHaveBeenCalled()
    await waitFor(() => expect(location()).toHaveTextContent('/verificar-email'))
  })

  it('con plan empresarial registra un gerente con su clínica', async () => {
    authApi.registerGerente.mockResolvedValue({})
    renderWithProviders(<RegistroMedicoPage />)
    await userEvent.selectOptions(screen.getByLabelText('Membresía'), 'empresarial')
    expect(screen.queryByLabelText('Matrícula')).not.toBeInTheDocument()
    await completarBase()

    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta de gerente' }))
    expect(screen.getByText('Ingresá el nombre de la clínica.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nombre de la clínica'), 'Clínica Sur')
    await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 1')
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta de gerente' }))

    expect(authApi.registerGerente).toHaveBeenCalledWith(expect.objectContaining({ plan: 'empresarial', clinica_nombre: 'Clínica Sur', direccion: 'Calle 1' }))
  })
})

describe('RegistroPropietarioPage', () => {
  it('registra un propietario', async () => {
    authApi.registerPropietario.mockResolvedValue({})
    renderWithProviders(<RegistroPropietarioPage />)
    for (const [label, value] of [['Nombre', 'Marta'], ['Apellido', 'Sosa'], ['Email', 'm@x.com'], ['Contraseña', 'clave1234'], ['Confirmar contraseña', 'clave1234']]) {
      await userEvent.type(screen.getByLabelText(label), value)
    }
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /Crear cuenta/ }))
    expect(authApi.registerPropietario).toHaveBeenCalledWith({
      username: 'm', email: 'm@x.com', password: 'clave1234', nombre: 'Marta', apellido: 'Sosa', telefono: null, acepta_tyc: true,
    })
    await waitFor(() => expect(location()).toHaveTextContent('/verificar-email'))
  })

  it('el propietario ve el error del backend', async () => {
    authApi.registerPropietario.mockRejectedValue(new ApiError(409, 'Username o email ya existen'))
    renderWithProviders(<RegistroPropietarioPage />)
    for (const [label, value] of [['Nombre', 'Marta'], ['Apellido', 'Sosa'], ['Email', 'm@x.com'], ['Contraseña', 'clave1234'], ['Confirmar contraseña', 'clave1234']]) {
      await userEvent.type(screen.getByLabelText(label), value)
    }
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /Crear cuenta/ }))
    expect(await screen.findByText('Username o email ya existen')).toBeInTheDocument()
  })
})

describe('VerificarEmailPage', () => {
  it('valida el código antes de enviarlo', async () => {
    renderWithProviders(<VerificarEmailPage />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@x.com')
    await userEvent.type(screen.getByLabelText('Código de 6 dígitos'), '12a3')
    expect(screen.getByLabelText('Código de 6 dígitos')).toHaveValue('123')
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(screen.getByText('El código tiene 6 dígitos.')).toBeInTheDocument()
  })

  it('verifica, inicia sesión y redirige según el rol', async () => {
    authApi.verificarEmail.mockResolvedValue({ token: 't', user: { email: 'a@x.com', rol: 'medico' } })
    renderWithProviders(<VerificarEmailPage />)
    await userEvent.type(screen.getByLabelText('Email'), ' a@x.com ')
    await userEvent.type(screen.getByLabelText('Código de 6 dígitos'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(authApi.verificarEmail).toHaveBeenCalledWith('a@x.com', '123456')
    await waitFor(() => expect(location()).toHaveTextContent('/medico'))
    expect(localStorage.getItem('agisad-token')).toBe('t')
  })

  it('muestra el error del backend', async () => {
    authApi.verificarEmail.mockRejectedValue(new ApiError(400, 'El código ingresado es incorrecto'))
    renderWithProviders(<VerificarEmailPage />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@x.com')
    await userEvent.type(screen.getByLabelText('Código de 6 dígitos'), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('El código ingresado es incorrecto')).toBeInTheDocument()
  })

  it('reenvía el código y arranca el cooldown', async () => {
    authApi.reenviarCodigo.mockResolvedValue()
    renderWithProviders(<VerificarEmailPage />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@x.com')
    await userEvent.click(screen.getByRole('button', { name: 'reenviá el código' }))

    expect(authApi.reenviarCodigo).toHaveBeenCalledWith('a@x.com')
    expect(await screen.findByText('Te mandamos un código nuevo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reenviá el código \(45s\)/ })).toBeDisabled()
  })

  it('reenviar exige el email', async () => {
    renderWithProviders(<VerificarEmailPage />)
    await userEvent.click(screen.getByRole('button', { name: 'reenviá el código' }))
    expect(screen.getByText('Ingresá tu email para poder reenviar el código.')).toBeInTheDocument()
    expect(authApi.reenviarCodigo).not.toHaveBeenCalled()
  })

  it('viniendo del registro el email queda fijo y el reenvío espera 45 segundos', () => {
    vi.useFakeTimers()
    try {
      renderWithProviders(<VerificarEmailPage />, { route: { pathname: '/verificar-email', state: { email: 'a@x.com' } } })

      expect(screen.getByLabelText('Email')).toHaveValue('a@x.com')
      expect(screen.getByLabelText('Email')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'reenviá el código (45s)' })).toBeDisabled()

      act(() => vi.advanceTimersByTime(10_000))
      expect(screen.getByRole('button', { name: 'reenviá el código (35s)' })).toBeDisabled()

      act(() => vi.advanceTimersByTime(35_000))
      expect(screen.getByRole('button', { name: 'reenviá el código' })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('RecuperarPasswordPage', () => {
  it('valida el email', async () => {
    renderWithProviders(<RecuperarPasswordPage />)
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }))
    expect(screen.getByText('Ingresá un email válido.')).toBeInTheDocument()
  })

  it.each([
    ['cuando el backend responde', () => authApi.forgotPassword.mockResolvedValue({})],
    ['aunque el backend falle (no revela si existe)', () => authApi.forgotPassword.mockRejectedValue(new Error('x'))],
  ])('confirma el envío %s', async (_caso, setup) => {
    setup()
    renderWithProviders(<RecuperarPasswordPage />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@x.com')
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }))
    expect(await screen.findByText(/Si el email existe en Agisad/)).toBeInTheDocument()
  })
})

describe('NuevaPasswordPage', () => {
  const renderNueva = () => renderWithProviders(<NuevaPasswordPage />, { route: '/nueva-password/tok', path: '/nueva-password/:token' })

  it('valida la misma regla que el backend y la coincidencia', async () => {
    renderNueva()
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'abc123')
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }))
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Nueva contraseña'))
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'soloLetras')
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }))
    expect(screen.getByText('La contraseña debe incluir letras y números.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Nueva contraseña'))
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'clave1234')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'otra')
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }))
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
  })

  it('actualiza y vuelve al login', async () => {
    authApi.resetPassword.mockResolvedValue({})
    renderNueva()
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'clave1234')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }))
    expect(authApi.resetPassword).toHaveBeenCalledWith('tok', 'clave1234')
    await waitFor(() => expect(location()).toHaveTextContent('/login'))
  })

  it('muestra el error si el enlace venció', async () => {
    authApi.resetPassword.mockRejectedValue(new ApiError(400, 'El enlace es inválido o ya expiró'))
    renderNueva()
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'clave1234')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }))
    expect(await screen.findByText('El enlace es inválido o ya expiró')).toBeInTheDocument()
  })
})

describe('InvitacionPage', () => {
  const invitacion = { clinica: { nombre: 'Clínica Sur' }, gerente: { nombre: 'Laura', apellido: 'Ríos' }, email_invitado: 'doc@x.com' }
  const renderInvitacion = () => renderWithProviders(<InvitacionPage />, { route: '/invitacion/tok', path: '/invitacion/:token' })

  it('muestra el error si la invitación no existe', async () => {
    gerentesApi.getInvitacionPorToken.mockRejectedValue(new ApiError(410, 'Esta invitación expiró'))
    renderInvitacion()
    expect(await screen.findByText('Invitación no disponible')).toBeInTheDocument()
    expect(screen.getByText('Esta invitación expiró')).toBeInTheDocument()
  })

  it('un médico nuevo se registra desde la invitación', async () => {
    gerentesApi.getInvitacionPorToken.mockResolvedValue(invitacion)
    gerentesApi.registrarViaInvitacion.mockResolvedValue({ clinica: 'Clínica Sur' })
    renderInvitacion()

    expect(await screen.findByText(/Laura Ríos te invitó a "Clínica Sur"/)).toBeInTheDocument()
    for (const [label, value] of [['Nombre', 'Juan'], ['Apellido', 'Gómez'], ['DNI', '20111222'], ['Matrícula', 'MP-1'], ['Contraseña', 'clave1234'], ['Confirmar contraseña', 'clave1234']]) {
      await userEvent.type(screen.getByLabelText(label), value)
    }
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /Crear cuenta/ }))

    expect(gerentesApi.registrarViaInvitacion).toHaveBeenCalledWith('tok', expect.objectContaining({ username: 'doc', dni: '20111222', matricula: 'MP-1' }))
    expect(await screen.findByText('¡Listo!')).toBeInTheDocument()
  })

  it('un médico existente inicia sesión y acepta', async () => {
    gerentesApi.getInvitacionPorToken.mockResolvedValue(invitacion)
    gerentesApi.aceptarInvitacion.mockResolvedValue({ clinica: 'Clínica Sur' })
    authApi.login.mockResolvedValue({ token: 't', user: { rol: 'medico' } })
    renderInvitacion()

    await userEvent.click(await screen.findByRole('button', { name: 'Ya tengo cuenta' }))
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión y aceptar' }))

    expect(authApi.login).toHaveBeenCalledWith('doc@x.com', 'clave1234')
    expect(gerentesApi.aceptarInvitacion).toHaveBeenCalledWith('tok')
    expect(await screen.findByText('¡Listo!')).toBeInTheDocument()
  })

  it('con contraseña incorrecta avisa', async () => {
    gerentesApi.getInvitacionPorToken.mockResolvedValue(invitacion)
    authApi.login.mockRejectedValue(new ApiError(401, 'x'))
    renderInvitacion()
    await userEvent.click(await screen.findByRole('button', { name: 'Ya tengo cuenta' }))
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión y aceptar' }))
    expect(await screen.findByText('Contraseña incorrecta.')).toBeInTheDocument()
  })
})
