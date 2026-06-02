import { Outlet } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import './PublicLayout.css'

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <Navbar />
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <span>Agisad &copy; {new Date().getFullYear()} - Agenda Integral de Salud </span>
        <span className="public-footer-dev">Desarrollado por GADelucchi</span>
      </footer>
    </div>
  )
}
