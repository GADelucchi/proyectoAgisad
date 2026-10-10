import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '../../src/context/AuthContext'
import { ThemeProvider } from '../../src/context/ThemeContext'
import { STORAGE_KEYS } from '../../src/services/apiClient'

/** Muestra la ruta actual para poder verificar redirecciones. */
export function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

/**
 * Renderiza `ui` con los providers de la app.
 *
 * - `usuario`: sesión guardada (como la deja el login). Sin token, para que
 *   AuthProvider no intente refrescarla contra /auth/me.
 * - `route` / `path`: URL inicial y patrón de la ruta (para useParams).
 * - `extraRoutes`: otras rutas a las que la pantalla puede navegar.
 */
export function renderWithProviders(ui, { usuario = null, route = '/', path = '*', extraRoutes = null } = {}) {
  if (usuario) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(usuario))
  }

  return render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
            {extraRoutes}
            {/* Destino neutro para las navegaciones fuera de la pantalla bajo test. */}
            {path !== '*' && <Route path="*" element={null} />}
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export const usuarios = {
  paciente: { idUsuario: 50, rol: 'paciente', nombre: 'Ana', email: 'ana@x.com' },
  medico: {
    idUsuario: 60,
    rol: 'medico',
    nombre: 'Juan',
    email: 'doc@x.com',
    membresia: { plan_nombre: 'Medio', permite_turnos: true, permite_asistentes: true, activa_vigente: true, membresia_vencida: false },
  },
  asistente: { idUsuario: 61, rol: 'asistente', nombre: 'Lu', email: 'lu@x.com' },
  gerente: { idUsuario: 70, rol: 'gerente', nombre: 'Laura', email: 'laura@x.com', membresia: { activa_vigente: true } },
  propietario: { idUsuario: 80, rol: 'propietario', nombre: 'Marta', email: 'marta@x.com', membresia: { activa_vigente: true } },
  admin: { idUsuario: 1, rol: 'admin', nombre: 'Root', email: 'root@x.com' },
}
