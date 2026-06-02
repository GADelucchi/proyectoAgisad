import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { formatDateDdMmYyyy } from '../../utils/dateFormat'
import AgendaTab       from './tabs/AgendaTab'
import ConfiguracionTab from './tabs/ConfiguracionTab'
import PacientesTab    from './tabs/PacientesTab'
import HistorialTab    from './tabs/HistorialTab'
import './PanelMedicoPage.css'

const TABS = [
  { id: 'agenda',         label: 'Agenda' },
  { id: 'configuracion',  label: 'Configuración' },
  { id: 'pacientes',      label: 'Pacientes' },
  { id: 'historial',      label: 'Historial' },
]

const KPI_MOCK = { total: 1, primeraVez: 0, libres: 15 }

export default function PanelMedicoPage() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('agenda')
  const hoy = formatDateDdMmYyyy(new Date())

  return (
    <div className="panel-medico">
      {/* Header */}
      <div className="panel-medico-header">
        <div>
          <h1>Panel — {usuario?.nombre}</h1>
          <p style={{ margin: 0, textTransform: 'capitalize' }}>Hoy, {hoy}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="panel-kpis">
        <div className="kpi-card surface-raised">
          <span className="kpi-valor">{KPI_MOCK.total}</span>
          <span className="kpi-label">Turnos totales</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor">{KPI_MOCK.primeraVez}</span>
          <span className="kpi-label">Primera vez</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor kpi-accent">{KPI_MOCK.libres}</span>
          <span className="kpi-label">Libres hoy</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="panel-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`panel-tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="panel-tab-content">
        {tab === 'agenda'        && <AgendaTab />}
        {tab === 'configuracion' && <ConfiguracionTab />}
        {tab === 'pacientes'     && <PacientesTab />}
        {tab === 'historial'     && <HistorialTab />}
      </div>
    </div>
  )
}
