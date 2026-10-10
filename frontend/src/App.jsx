import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import SeoManager from './components/SeoManager'
import PublicLayout    from './layouts/PublicLayout'
import PacienteLayout  from './layouts/PacienteLayout'
import MedicoLayout    from './layouts/MedicoLayout'
import AsistenteLayout from './layouts/AsistenteLayout'
import AdminLayout     from './layouts/AdminLayout'
import GerenteLayout   from './layouts/GerenteLayout'
import PropietarioLayout from './layouts/PropietarioLayout'
import LandingPage          from './pages/public/LandingPage'
import LoginPage            from './pages/public/LoginPage'
import RegistroPage         from './pages/public/RegistroPage'
import RegistroPacientePage from './pages/public/RegistroPacientePage'
import RegistroMedicoPage   from './pages/public/RegistroMedicoPage'
import RegistroPropietarioPage from './pages/public/RegistroPropietarioPage'
import InvitacionPage       from './pages/public/InvitacionPage'
import VerificarEmailPage   from './pages/public/VerificarEmailPage'
import RecuperarPasswordPage from './pages/public/RecuperarPasswordPage'
import NuevaPasswordPage     from './pages/public/NuevaPasswordPage'
import ContactoPage          from './pages/public/ContactoPage'
import TerminosPage          from './pages/public/TerminosPage'
import PrivacidadPage        from './pages/public/PrivacidadPage'
import NotFoundPage          from './pages/public/NotFoundPage'

// Los paneles se cargan aparte: quien entra a la landing no descarga el resto de la app.
const BuscadorMedicoPage  = lazy(() => import('./pages/paciente/BuscadorMedicoPage'))
const PanelPacientePage   = lazy(() => import('./pages/paciente/PanelPacientePage'))
const AccionesPage        = lazy(() => import('./pages/paciente/AccionesPage'))
const SolicitarRecetaPage = lazy(() => import('./pages/paciente/SolicitarRecetaPage'))
const WizardTurnoPage     = lazy(() => import('./pages/paciente/turno/WizardTurnoPage'))
const CancelarTurnoPage   = lazy(() => import('./pages/paciente/CancelarTurnoPage'))
const MensajesPage        = lazy(() => import('./pages/paciente/MensajesPage'))
const PanelMedicoPage     = lazy(() => import('./pages/medico/PanelMedicoPage'))
const PanelAsistentePage  = lazy(() => import('./pages/asistente/PanelAsistentePage'))
const PanelAdminPage      = lazy(() => import('./pages/admin/PanelAdminPage'))
const PanelGerentePage    = lazy(() => import('./pages/gerente/PanelGerentePage'))
const PanelPropietarioPage = lazy(() => import('./pages/propietario/PanelPropietarioPage'))
const ConsultoriosPublicosPage = lazy(() => import('./pages/medico/ConsultoriosPublicosPage'))

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <SeoManager />
          <Suspense fallback={null}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/"                element={<LandingPage />} />
                <Route path="/login"           element={<LoginPage />} />
                <Route path="/registro"        element={<RegistroPage />} />
                <Route path="/registro/paciente" element={<RegistroPacientePage />} />
                <Route path="/registro/profesional" element={<RegistroMedicoPage />} />
                <Route path="/registro/medico" element={<RegistroMedicoPage />} />
                {/* Los gerentes se registran desde /registro/profesional con el plan Empresarial. */}
                <Route path="/registro/gerente" element={<Navigate to="/registro/profesional" replace />} />
                <Route path="/registro/propietario" element={<RegistroPropietarioPage />} />
                <Route path="/invitacion/:token" element={<InvitacionPage />} />
                <Route path="/verificar-email" element={<VerificarEmailPage />} />
                <Route path="/recuperar-password" element={<RecuperarPasswordPage />} />
                <Route path="/nueva-password/:token" element={<NuevaPasswordPage />} />
                <Route path="/contacto"    element={<ContactoPage />} />
                <Route path="/terminos"    element={<TerminosPage />} />
                <Route path="/privacidad"  element={<PrivacidadPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route element={<PacienteLayout />}>
                <Route path="/paciente"                    element={<BuscadorMedicoPage />} />
                <Route path="/paciente/panel"              element={<PanelPacientePage />} />
                <Route path="/paciente/medico/:medicoId"   element={<AccionesPage />} />
                <Route path="/paciente/receta/:medicoId"   element={<SolicitarRecetaPage />} />
                <Route path="/paciente/turno/:medicoId"    element={<WizardTurnoPage />} />
                <Route path="/paciente/cancelar/:medicoId" element={<CancelarTurnoPage />} />
                <Route path="/paciente/mensajes/:medicoId" element={<MensajesPage />} />
              </Route>
              <Route element={<MedicoLayout />}>
                <Route path="/medico" element={<PanelMedicoPage />} />
                <Route path="/medico/consultorios" element={<ConsultoriosPublicosPage />} />
              </Route>
              <Route element={<AsistenteLayout />}>
                <Route path="/asistente" element={<PanelAsistentePage />} />
              </Route>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<PanelAdminPage />} />
              </Route>
              <Route element={<GerenteLayout />}>
                <Route path="/gerente" element={<PanelGerentePage />} />
              </Route>
              <Route element={<PropietarioLayout />}>
                <Route path="/propietario" element={<PanelPropietarioPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
