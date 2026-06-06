import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { getUserDisplayName } from '../utils/userDisplay'
import './PanelLayout.css'

export default function AdminLayout() {
  const { usuario } = useAuth()

  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.rol !== 'admin') return <Navigate to="/login" replace />

  return (
    <div className="panel-layout">
      <Navbar titulo={`Admin — ${getUserDisplayName(usuario, 'Panel principal')}`} subtitulo="Administración total de la app" />
      <main className="panel-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}