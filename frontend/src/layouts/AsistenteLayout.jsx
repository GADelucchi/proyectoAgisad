import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { formatDateDdMmYyyy } from '../utils/dateFormat'
import './PanelLayout.css'

export default function AsistenteLayout() {
  const { usuario } = useAuth()

  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.rol !== 'asistente') return <Navigate to="/login" replace />

  return (
    <div className="panel-layout">
      <Navbar titulo={`Panel Asistente — ${usuario.nombre}`} subtitulo={`Hoy, ${formatDateDdMmYyyy(new Date())}`} />
      <main className="panel-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
