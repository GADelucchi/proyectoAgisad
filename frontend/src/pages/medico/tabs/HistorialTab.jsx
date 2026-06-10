import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../../context/AuthContext'
import { turnosApi } from '../../../services/turnos.api'
import './HistorialTab.css'

const BADGE_EVENTO = {
  asistio: 'badge-success',
  no_asistio: 'badge-error',
  cancelado: 'badge-warning',
  pendiente: 'badge-primary',
}

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function asLabel(estado) {
  if (estado === 'asistio') return 'Paciente asistio'
  if (estado === 'no_asistio') return 'Paciente no asistio'
  if (estado === 'cancelado') return 'Turno cancelado'
  return 'Turno pendiente'
}

export default function HistorialTab() {
  const { usuario } = useAuth()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const doctorId = usuario?.idUsuario || usuario?.id

  async function load() {
    if (!doctorId) return
    setLoading(true)
    try {
      const today = new Date()
      const desde = toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1))
      const hasta = toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0))
      const turnos = await turnosApi.listarPorMedico({ idMedico: doctorId, desde, hasta })
      setRows(Array.isArray(turnos) ? turnos : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [doctorId])

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

      <div className="surface-raised historial-tabla-wrap">
        <p style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          Mostrando {filtrados.length} eventos
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha turno</th>
              <th>Evento</th>
              <th>Paciente</th>
              <th>Consultorio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((e) => (
              <tr key={e.id_turno}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{`${e.fecha} ${e.hora}`}</td>
                <td><span className={`badge ${BADGE_EVENTO[e.estado] || 'badge-muted'}`}>{asLabel(e.estado)}</span></td>
                <td>{`${e.paciente_nombre || ''} ${e.paciente_apellido || ''}`.trim()}</td>
                <td>{e.id_clinica}</td>
                <td><span className={`badge ${BADGE_EVENTO[e.estado] || 'badge-muted'}`}>{e.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
