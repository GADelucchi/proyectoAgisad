import { useAuth } from '../../context/AuthContext'
import AgendaTab    from '../medico/tabs/AgendaTab'
import PacientesTab from '../medico/tabs/PacientesTab'
import { useEffect, useState } from 'react'
import { asistentesApi } from '../../services/asistentes.api'
import { formatDateDdMmYyyy } from '../../utils/dateFormat'
import '../medico/PanelMedicoPage.css'

export default function PanelAsistentePage() {
  const { usuario } = useAuth()
  const [access, setAccess] = useState({
    doctorId: null,
    blocked: true,
    permissions: { agenda: true, pacientes: false },
  })

  useEffect(() => {
    let cancelled = false
    asistentesApi
      .meAccess()
      .then((data) => {
        if (!cancelled) setAccess(data)
      })
      .catch(() => {
        if (!cancelled) {
          setAccess({ doctorId: null, blocked: true, permissions: { agenda: true, pacientes: false } })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const tabs = [
    ...(access.permissions.agenda ? [{ id: 'agenda', label: 'Agenda' }] : []),
    ...(access.permissions.pacientes ? [{ id: 'pacientes', label: 'Pacientes' }] : []),
  ]
  const [tab, setTab] = useState(tabs[0]?.id || 'agenda')
  const hoy = formatDateDdMmYyyy(new Date())

  return (
    <div className="panel-medico">
      <div className="panel-medico-header">
        <div>
          <h1>Panel Asistente — {usuario?.nombre}</h1>
          <p style={{ margin: 0, textTransform: 'capitalize' }}>Hoy, {hoy}</p>
        </div>
      </div>

      <div className="panel-kpis">
        <div className="kpi-card surface-raised">
          <span className="kpi-valor">—</span>
          <span className="kpi-label">Turnos totales</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor">—</span>
          <span className="kpi-label">Primera vez</span>
        </div>
        <div className="kpi-card surface-raised">
          <span className="kpi-valor kpi-accent">—</span>
          <span className="kpi-label">Libres hoy</span>
        </div>
      </div>

      <div className="panel-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`panel-tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {access.blocked && (
        <div className="surface-raised" style={{ padding: '0.8rem 1rem', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Tu usuario está bloqueado por el médico. Solo podés visualizar la agenda.
          </p>
        </div>
      )}

      <div className="panel-tab-content">
        {tab === 'agenda' && <AgendaTab doctorId={access.doctorId} readOnly={access.blocked} />}
        {tab === 'pacientes' && access.permissions.pacientes && <PacientesTab />}
        {tabs.length === 0 && (
          <div className="surface-raised" style={{ padding: '1rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>No tenés permisos asignados.</p>
          </div>
        )}
      </div>
    </div>
  )
}
