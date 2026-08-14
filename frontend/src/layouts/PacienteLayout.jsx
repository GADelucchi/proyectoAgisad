import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { getUserDisplayName } from '../utils/userDisplay'
import './PanelLayout.css'

export default function PacienteLayout() {
  const { usuario } = useAuth()

  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.rol !== 'paciente') return <Navigate to="/login" replace />

  return (
    <div className="panel-layout">
      <Navbar
        titulo={`Hola, ${getUserDisplayName(usuario, 'Paciente')}`}
        subtitulo="Ver mi panel"
        tituloTo="/paciente/panel"
      />
      <main className="panel-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
