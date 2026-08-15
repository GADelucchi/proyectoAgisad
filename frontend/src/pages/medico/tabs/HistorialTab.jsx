import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../../context/AuthContext'
import { turnosApi } from '../../../services/turnos.api'
import './HistorialTab.css'

const BADGE_EVENTO = {
  completado: 'badge-success',
  ausente: 'badge-error',
  cancelado_clinica: 'badge-warning',
  cancelado_paciente: 'badge-warning',
  confirmado: 'badge-primary',
  en_curso: 'badge-primary',
  pendiente: 'badge-primary',
}

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function asLabel(estado) {
  if (estado === 'completado') return 'Paciente asistio'
  if (estado === 'ausente') return 'Paciente no asistio'
  if (estado === 'cancelado_clinica') return 'Turno cancelado por profesional o equipo'
  if (estado === 'cancelado_paciente') return 'Turno cancelado por paciente'
  if (estado === 'confirmado') return 'Turno confirmado'
  if (estado === 'en_curso') return 'Consulta en curso'
  return 'Turno pendiente'
}

function actorLabel(row) {
  if (!row.modificado_por) return 'Sistema'

  const rol = row.actor_rol ? `${row.actor_rol}: ` : ''
  const identity = row.actor_username || row.actor_email || `Usuario ${row.modificado_por}`
  return `${rol}${identity}`
}

export default function HistorialTab() {
  const { usuario } = useAuth()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const isMedico = usuario?.rol === 'medico'

  async function load() {
    if (!isMedico || !usuario?.idUsuario) return
    setLoading(true)
    try {
      const today = new Date()
      const desde = toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1))
      const hasta = toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0))
      const turnos = await turnosApi.listarHistorialPorMedico({ desde, hasta })
      setRows(Array.isArray(turnos) ? turnos : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [isMedico, usuario?.idUsuario])

  const filtrados = useMemo(
    () =>
      rows.filter((e) =>
        `${e.paciente_nombre || ''} ${e.paciente_apellido || ''}`.toLowerCase().includes(query.toLowerCase())
      ),
    [rows, query]
  )

  return (
    <div className="historial-tab">
      <div className="historial-header">
        <div>
          <h3>Historial de turnos</h3>
          <p>Registro de estados sobre turnos en base de datos.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      <div className="pacientes-search surface-raised">
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          className="buscador-input"
          placeholder="Buscar por paciente..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="surface-raised">
        <p style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          Mostrando {filtrados.length} eventos
        </p>
        <div className="historial-tabla-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha turno</th>
                <th>Evento</th>
                <th>Paciente</th>
                <th>Consultorio</th>
                <th>Realizado por</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id_historial}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{`${e.fecha} ${e.hora}`}</td>
                  <td><span className={`badge ${BADGE_EVENTO[e.estado] || 'badge-muted'}`}>{asLabel(e.estado)}</span></td>
                  <td>{`${e.paciente_nombre || ''} ${e.paciente_apellido || ''}`.trim()}</td>
                  <td>{e.clinica_nombre || `Consultorio ${e.id_clinica}`}</td>
                  <td>{actorLabel(e)}</td>
                  <td><span className={`badge ${BADGE_EVENTO[e.estado] || 'badge-muted'}`}>{e.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
