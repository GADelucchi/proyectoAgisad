import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { getUserDisplayName } from '../utils/userDisplay'
import './PanelLayout.css'

export default function PropietarioLayout() {
  const { usuario } = useAuth()

  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.rol !== 'propietario') return <Navigate to="/login" replace />

  return (
    <div className="panel-layout">
      <Navbar
        titulo={`Panel Propietario — ${getUserDisplayName(usuario, 'Propietario')}`}
        subtitulo="Consultorios en alquiler"
      />
      <main className="panel-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
