import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import './PanelLayout.css'

export default function GerenteLayout() {
  const { usuario } = useAuth()

  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.rol !== 'gerente') return <Navigate to="/login" replace />

  return (
    <div className="panel-layout">
      <Navbar titulo={`Panel Gerente — ${usuario.nombre || usuario.username || ''}`} subtitulo="Gestión de clínica" />
      <main className="panel-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
