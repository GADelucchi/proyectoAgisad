import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import './PanelLayout.css'

export default function AdminLayout() {
  const { usuario } = useAuth()

  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.rol !== 'admin') return <Navigate to="/login" replace />

  return (
    <div className="panel-layout">
      <Navbar titulo={`Admin — ${usuario.nombre || usuario.username || 'Panel principal'}`} subtitulo="Administración total de la app" />
      <main className="panel-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}