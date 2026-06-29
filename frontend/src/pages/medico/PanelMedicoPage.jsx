import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { medicosApi } from '../../services/medicos.api'
import { turnosApi } from '../../services/turnos.api'
import { formatDateDdMmYyyy } from '../../utils/dateFormat'
import AgendaTab       from './tabs/AgendaTab'
import ConfiguracionTab from './tabs/ConfiguracionTab'
import PacientesTab    from './tabs/PacientesTab'
import HistorialTab    from './tabs/HistorialTab'
import RecetasTab      from './tabs/RecetasTab'
import './PanelMedicoPage.css'

const TABS = [
  { id: 'agenda',         label: 'Agenda' },
  { id: 'recetas',        label: 'Recetas' },
  { id: 'configuracion',  label: 'Configuración' },
  { id: 'pacientes',      label: 'Pacientes' },
  { id: 'historial',      label: 'Historial' },
]

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function PanelMedicoPage() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('agenda')
  const [kpis, setKpis] = useState({ total: 0, tiposConfigurados: 0, libres: 0 })
  const hoy = formatDateDdMmYyyy(new Date())
  const todayDate = new Date()
  const todayIso = toIsoDate(todayDate)
  const isMedico = usuario?.rol === 'medico'
  const permiteTurnos = Boolean(usuario?.membresia?.permite_turnos)

  useEffect(() => {
    if (!isMedico || !usuario?.idUsuario || !permiteTurnos) return

    let cancelled = false
    async function loadKpis() {
      try {
        const [consultorios, turnos, turnosConfig] = await Promise.all([
          medicosApi.listMyClinicas(),
          turnosApi.listarPorMedico({ desde: todayIso, hasta: todayIso }),
          medicosApi.getMyTurnosConfig().catch(() => null),
        ])

        if (cancelled) return
        const total = Array.isArray(turnos) ? turnos.length : 0
        const tiposConfigurados = Array.isArray(turnosConfig?.tipos_turno) ? turnosConfig.tipos_turno.length : 0
        const capacidad = Array.isArray(consultorios) ? consultorios.length * 16 : 0
        setKpis({ total, tiposConfigurados, libres: Math.max(capacidad - total, 0) })
      } catch {
        if (!cancelled) {
          setKpis({ total: 0, tiposConfigurados: 0, libres: 0 })
        }
      }
    }

    loadKpis()
    return () => {
      cancelled = true
    }
  }, [isMedico, usuario?.idUsuario, todayIso, permiteTurnos])

  useEffect(() => {
    if (!permiteTurnos && ['agenda', 'historial'].includes(tab)) {
      setTab('pacientes')
    }
  }, [permiteTurnos, tab])

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
          <span className="kpi-valor">{kpis.total}</span>
          <span className="kpi-label">Turnos totales</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor">{kpis.tiposConfigurados}</span>
          <span className="kpi-label">Tipos configurados</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor kpi-accent">{kpis.libres}</span>
          <span className="kpi-label">Libres hoy</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="panel-tabs">
        {TABS.map(t => (
          (t.id !== 'agenda' && t.id !== 'historial') || permiteTurnos ? (
          <button
            key={t.id}
            className={`panel-tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
          ) : null
        ))}
      </div>

      {/* Contenido */}
      <div className="panel-tab-content">
        {tab === 'agenda'        && permiteTurnos && <AgendaTab />}
        {tab === 'recetas'       && <RecetasTab />}
        {tab === 'configuracion' && <ConfiguracionTab permiteTurnos={permiteTurnos} />}
        {tab === 'pacientes'     && <PacientesTab />}
        {tab === 'historial'     && permiteTurnos && <HistorialTab />}
      </div>
    </div>
  )
}
