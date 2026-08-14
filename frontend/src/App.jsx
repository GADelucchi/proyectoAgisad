import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import PublicLayout    from './layouts/PublicLayout'
import PacienteLayout  from './layouts/PacienteLayout'
import MedicoLayout    from './layouts/MedicoLayout'
import AsistenteLayout from './layouts/AsistenteLayout'
import AdminLayout     from './layouts/AdminLayout'
import GerenteLayout   from './layouts/GerenteLayout'
import LandingPage          from './pages/public/LandingPage'
import LoginPage            from './pages/public/LoginPage'
import RegistroPage         from './pages/public/RegistroPage'
import RegistroPacientePage from './pages/public/RegistroPacientePage'
import RegistroMedicoPage   from './pages/public/RegistroMedicoPage'
import RegistroGerentePage  from './pages/public/RegistroGerentePage'
import VerificarEmailPage   from './pages/public/VerificarEmailPage'
import RecuperarPasswordPage from './pages/public/RecuperarPasswordPage'
import NuevaPasswordPage     from './pages/public/NuevaPasswordPage'
import BuscadorMedicoPage   from './pages/paciente/BuscadorMedicoPage'
import PanelPacientePage    from './pages/paciente/PanelPacientePage'
import AccionesPage         from './pages/paciente/AccionesPage'
import SolicitarRecetaPage  from './pages/paciente/SolicitarRecetaPage'
import WizardTurnoPage      from './pages/paciente/turno/WizardTurnoPage'
import CancelarTurnoPage    from './pages/paciente/CancelarTurnoPage'
import MensajesPage         from './pages/paciente/MensajesPage'
import PanelMedicoPage      from './pages/medico/PanelMedicoPage'
import PanelAsistentePage   from './pages/asistente/PanelAsistentePage'
import PanelAdminPage       from './pages/admin/PanelAdminPage'
import PanelGerentePage     from './pages/gerente/PanelGerentePage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/"                element={<LandingPage />} />
              <Route path="/login"           element={<LoginPage />} />
              <Route path="/registro"        element={<RegistroPage />} />
              <Route path="/registro/paciente" element={<RegistroPacientePage />} />
              <Route path="/registro/profesional" element={<RegistroMedicoPage />} />
              <Route path="/registro/medico" element={<RegistroMedicoPage />} />
              <Route path="/registro/gerente" element={<RegistroGerentePage />} />
              <Route path="/verificar-email" element={<VerificarEmailPage />} />
              <Route path="/recuperar-password" element={<RecuperarPasswordPage />} />
              <Route path="/nueva-password/:token" element={<NuevaPasswordPage />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
