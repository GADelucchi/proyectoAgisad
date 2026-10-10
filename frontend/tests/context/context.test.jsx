import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/auth.api', () => ({
  authApi: { me: vi.fn(), login: vi.fn() },
}))

import { authApi } from '../../src/services/auth.api'
import { STORAGE_KEYS } from '../../src/services/apiClient'
import { AuthProvider, useAuth } from '../../src/context/AuthContext'
import { ThemeProvider, useTheme } from '../../src/context/ThemeContext'

function AuthProbe() {
  const { usuario, login, logout, completarSesion } = useAuth()
  return (
    <div>
      <span data-testid="usuario">{usuario ? `${usuario.nombre}:${usuario.rol}` : 'anon'}</span>
      <button onClick={() => login('a@x.com', 'clave')}>login</button>
      <button onClick={logout}>logout</button>
      <button onClick={() => completarSesion('tok2', { email: 'b@x.com', rol: 'medico' })}>completar</button>
    </div>
  )
}

const renderAuth = () => render(<AuthProvider><AuthProbe /></AuthProvider>)

describe('AuthContext', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('arranca sin sesión', () => {
    renderAuth()
    expect(screen.getByTestId('usuario')).toHaveTextContent('anon')
    expect(authApi.me).not.toHaveBeenCalled()
  })

  it('restaura la sesión guardada y completa el nombre', () => {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ email: 'ana@x.com', rol: 'paciente' }))
    renderAuth()
    expect(screen.getByTestId('usuario')).toHaveTextContent('ana:paciente')
  })

  it('ignora una sesión guardada corrupta', () => {
    localStorage.setItem(STORAGE_KEYS.user, '{roto')
    renderAuth()
    expect(screen.getByTestId('usuario')).toHaveTextContent('anon')
  })

  it('con token refresca el usuario contra /auth/me', async () => {
    localStorage.setItem(STORAGE_KEYS.token, 'tok')
    authApi.me.mockResolvedValue({ nombre: 'Ana', rol: 'paciente' })

    renderAuth()

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('Ana:paciente'))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.user))).toMatchObject({ nombre: 'Ana' })
  })

  it('si el token ya no sirve cierra la sesión', async () => {
    localStorage.setItem(STORAGE_KEYS.token, 'vencido')
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ nombre: 'Ana', rol: 'paciente' }))
    authApi.me.mockRejectedValue(new Error('401'))

    renderAuth()

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('anon'))
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.user)).toBeNull()
  })

  it('login guarda token y usuario; logout los borra', async () => {
    authApi.login.mockResolvedValue({ token: 'nuevo', user: { nombre: 'Juan', rol: 'medico' } })
    renderAuth()

    await userEvent.click(screen.getByText('login'))
    expect(screen.getByTestId('usuario')).toHaveTextContent('Juan:medico')
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBe('nuevo')
    expect(authApi.login).toHaveBeenCalledWith('a@x.com', 'clave')

    await userEvent.click(screen.getByText('logout'))
    expect(screen.getByTestId('usuario')).toHaveTextContent('anon')
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBeNull()
  })

  it('completarSesion usa una sesión ya emitida por el backend', async () => {
    renderAuth()
    await userEvent.click(screen.getByText('completar'))
    expect(screen.getByTestId('usuario')).toHaveTextContent('b:medico')
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBe('tok2')
  })
})

function ThemeProbe() {
  const { theme, themeMode, toggleTheme, setThemeMode } = useTheme()
  return (
    <div>
      <span data-testid="theme">{`${themeMode}:${theme}`}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setThemeMode('system')}>system</button>
    </div>
  )
}

describe('ThemeContext', () => {
  it('usa oscuro por defecto y lo aplica al documento', () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    expect(screen.getByTestId('theme')).toHaveTextContent('dark:dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('restaura el modo guardado', () => {
    localStorage.setItem('agisad-theme-mode', 'light')
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    expect(screen.getByTestId('theme')).toHaveTextContent('light:light')
  })

  it('rota claro → oscuro → sistema → claro y lo persiste', async () => {
    localStorage.setItem('agisad-theme-mode', 'light')
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)

    await userEvent.click(screen.getByText('toggle'))
    expect(screen.getByTestId('theme')).toHaveTextContent('dark:dark')
    await userEvent.click(screen.getByText('toggle'))
    expect(screen.getByTestId('theme')).toHaveTextContent(/^system:/)
    await userEvent.click(screen.getByText('toggle'))
    expect(screen.getByTestId('theme')).toHaveTextContent('light:light')
    expect(localStorage.getItem('agisad-theme-mode')).toBe('light')
  })

  it('en modo sistema sigue la preferencia del sistema operativo', async () => {
    const listeners = []
    let prefiereOscuro = true
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      get matches() { return prefiereOscuro },
      media: query,
      addEventListener: (_e, fn) => listeners.push(fn),
      removeEventListener: () => {},
    }))

    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    await userEvent.click(screen.getByText('system'))
    expect(screen.getByTestId('theme')).toHaveTextContent('system:dark')

    prefiereOscuro = false
    act(() => listeners.forEach((fn) => fn()))
    expect(screen.getByTestId('theme')).toHaveTextContent('system:light')
  })
})
