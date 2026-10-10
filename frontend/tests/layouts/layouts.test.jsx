import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import { ThemeProvider } from '../../src/context/ThemeContext'
import { STORAGE_KEYS } from '../../src/services/apiClient'
import AdminLayout from '../../src/layouts/AdminLayout'
import AsistenteLayout from '../../src/layouts/AsistenteLayout'
import GerenteLayout from '../../src/layouts/GerenteLayout'
import MedicoLayout from '../../src/layouts/MedicoLayout'
import PacienteLayout from '../../src/layouts/PacienteLayout'
import PropietarioLayout from '../../src/layouts/PropietarioLayout'
import PublicLayout from '../../src/layouts/PublicLayout'
import { usuarios } from '../helpers/render'

const LAYOUTS = [
  ['PacienteLayout', PacienteLayout, 'paciente', 'Hola, Ana'],
  ['MedicoLayout', MedicoLayout, 'medico', 'Panel — Juan'],
  ['AsistenteLayout', AsistenteLayout, 'asistente', 'Panel Asistente — Lu'],
  ['AdminLayout', AdminLayout, 'admin', 'Admin — Root'],
  ['GerenteLayout', GerenteLayout, 'gerente', 'Panel Gerente — Laura'],
  ['PropietarioLayout', PropietarioLayout, 'propietario', 'Panel Propietario — Marta'],
]

function renderLayout(Layout, usuario) {
  if (usuario) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(usuario))
  return render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={['/panel']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/panel" element={<p>contenido privado</p>} />
            </Route>
            <Route path="/login" element={<p>pantalla de login</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

describe.each(LAYOUTS)('%s', (_name, Layout, rol, titulo) => {
  it('sin sesión redirige al login', () => {
    renderLayout(Layout, null)
    expect(screen.getByText('pantalla de login')).toBeInTheDocument()
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument()
  })

  it('con otro rol redirige al login', () => {
    const otro = Object.values(usuarios).find((u) => u.rol !== rol)
    renderLayout(Layout, otro)
    expect(screen.getByText('pantalla de login')).toBeInTheDocument()
  })

  it('con el rol correcto muestra el panel', () => {
    renderLayout(Layout, usuarios[rol])
    expect(screen.getByText('contenido privado')).toBeInTheDocument()
    expect(screen.getByText(titulo)).toBeInTheDocument()
  })
})

describe('PublicLayout', () => {
  it('muestra el contenido y los links legales', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<p>landing</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    )
    expect(screen.getByText('landing')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Términos y condiciones' })).toHaveAttribute('href', '/terminos')
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', '/privacidad')
  })
})
