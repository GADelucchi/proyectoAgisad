import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { consultoriosApi } from '../../services/consultorios.api'
import ConsultoriosTab from './tabs/ConsultoriosTab'
import SolicitudesTab from './tabs/SolicitudesTab'
import ReporteUsoTab from './tabs/ReporteUsoTab'
import '../medico/PanelMedicoPage.css'

const TABS = [
  { id: 'consultorios', label: 'Mis consultorios' },
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'reporte', label: 'Reporte de uso' },
]

export default function PanelPropietarioPage() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('consultorios')
  const [consultorios, setConsultorios] = useState([])
  const [pendientes, setPendientes] = useState(0)

  const cargarResumen = useCallback(async () => {
    try {
      const [propios, solicitudes] = await Promise.all([
        consultoriosApi.listMios().catch(() => []),
        consultoriosApi.listSolicitudesRecibidas().catch(() => []),
      ])
      setConsultorios(Array.isArray(propios) ? propios : [])
      setPendientes(
        (Array.isArray(solicitudes) ? solicitudes : []).filter((s) => s.estado === 'pendiente').length
      )
    } catch {
      setConsultorios([])
      setPendientes(0)
    }
  }, [])

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

  return (
    <div className="panel-medico">
      <div className="panel-medico-header">
        <div>
          <h1>Panel — {usuario?.nombre}</h1>
          <p style={{ margin: 0 }}>Alquiler de consultorios</p>
        </div>
      </div>

      <div className="panel-kpis">
        <div className="kpi-card surface-raised">
          <span className="kpi-valor">{consultorios.length}</span>
          <span className="kpi-label">Consultorios</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor">{consultorios.filter((c) => c.compartido).length}</span>
          <span className="kpi-label">Publicados</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor kpi-accent">{pendientes}</span>
          <span className="kpi-label">Solicitudes pendientes</span>
        </div>
      </div>

      <div className="panel-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`panel-tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel-tab-content">
        {tab === 'consultorios' && <ConsultoriosTab onChange={cargarResumen} />}
        {tab === 'solicitudes' && <SolicitudesTab onChange={cargarResumen} />}
        {tab === 'reporte' && <ReporteUsoTab />}
      </div>
    </div>
  )
}
