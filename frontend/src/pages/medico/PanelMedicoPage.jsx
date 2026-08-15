import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { medicosApi } from '../../services/medicos.api'
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

export default function PanelMedicoPage() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('agenda')
  const hoy = formatDateDdMmYyyy(new Date())
  const [kpis, setKpis] = useState({ turnos: 0, tiposConfigurados: 0, libres: 0, fechaLabel: hoy })
  const isMedico = usuario?.rol === 'medico'
  const permiteTurnos = Boolean(usuario?.membresia?.permite_turnos)

  const cargarTiposTurno = useCallback(async () => {
    if (!isMedico || !usuario?.idUsuario || !permiteTurnos) return

    try {
      const turnosConfig = await medicosApi.getMyTurnosConfig()
      const tipos = Array.isArray(turnosConfig?.tipos_turno) ? turnosConfig.tipos_turno.length : 0
      setKpis((prev) => ({ ...prev, tiposConfigurados: tipos }))
    } catch {
      setKpis((prev) => ({ ...prev, tiposConfigurados: 0 }))
    }
  }, [isMedico, usuario?.idUsuario, permiteTurnos])

  // La agenda es la fuente de verdad de la grilla, así que los KPIs siguen al día que muestra.
  const recibirResumenAgenda = useCallback(({ turnos, libres, fechaLabel }) => {
    setKpis((prev) => ({ ...prev, turnos, libres, fechaLabel }))
  }, [])

  useEffect(() => {
    cargarTiposTurno()
  }, [cargarTiposTurno])

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
          <span className="kpi-valor">{kpis.turnos}</span>
          <span className="kpi-label">{`Turnos ${kpis.fechaLabel}`}</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor">{kpis.tiposConfigurados}</span>
          <span className="kpi-label">Tipos configurados</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor kpi-accent">{kpis.libres}</span>
          <span className="kpi-label">{`Libres ${kpis.fechaLabel}`}</span>
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
        {tab === 'agenda'        && permiteTurnos && <AgendaTab onResumenDia={recibirResumenAgenda} />}
        {tab === 'recetas'       && <RecetasTab />}
        {tab === 'configuracion' && <ConfiguracionTab permiteTurnos={permiteTurnos} onConfigChange={cargarTiposTurno} />}
        {tab === 'pacientes'     && <PacientesTab />}
        {tab === 'historial'     && permiteTurnos && <HistorialTab />}
      </div>
    </div>
  )
}
