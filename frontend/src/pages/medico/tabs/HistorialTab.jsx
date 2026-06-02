import { useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import Button from '../../../components/ui/Button'
import './HistorialTab.css'

const EVENTOS_MOCK = [
  { id: 1, fecha: '13/05/2026, 02:00 p.m.', evento: 'Paciente no asistió', turno: '2026-05-13 14:00', tipo: 'Seguimiento', paciente: 'Gastón Alejo Delucchi', dni: '40568729', consultorio: 'Virtual', solicitadoPor: 'panel_medico', actor: 'Dr. Gustavo A. Delucchi', asistencia: 'no_asistio' },
  { id: 2, fecha: '13/05/2026, 02:00 p.m.', evento: 'Paciente asistió',    turno: '2026-05-13 09:00', tipo: 'Seguimiento', paciente: 'Gastón Alejo Delucchi', dni: '40568729', consultorio: 'Virtual', solicitadoPor: 'panel_medico', actor: 'Dr. Gustavo A. Delucchi', asistencia: 'asistio' },
  { id: 3, fecha: '13/05/2026, 01:49 p.m.', evento: 'Turno creado',        turno: '2026-05-13 09:00', tipo: 'Seguimiento', paciente: 'Gastón Alejo Delucchi', dni: '40568729', consultorio: 'Virtual', solicitadoPor: 'panel_medico', actor: 'Dr. Gustavo A. Delucchi', asistencia: null },
]

const BADGE_EVENTO = {
  'Paciente asistió':     'badge-success',
  'Paciente no asistió':  'badge-error',
  'Turno creado':         'badge-primary',
  'Turno cancelado':      'badge-warning',
}

export default function HistorialTab() {
  const [query, setQuery] = useState('')

  const filtrados = EVENTOS_MOCK.filter(e =>
    e.paciente.toLowerCase().includes(query.toLowerCase()) ||
    e.dni.includes(query)
  )

  return (
    <div className="historial-tab">
      <div className="historial-header">
        <div>
          <h3>📋 Historial de turnos</h3>
          <p>Registro de creación, cancelación, confirmación y asistencia.</p>
        </div>
        <Button variant="ghost" size="sm"><RefreshCw size={14} /> Actualizar</Button>
      </div>

      <div className="pacientes-search surface-raised">
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          className="buscador-input"
          placeholder="Buscar por paciente (nombre o DNI)..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="surface-raised historial-tabla-wrap">
        <p style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          Mostrando {filtrados.length} eventos
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha evento</th>
              <th>Evento</th>
              <th>Tipo</th>
              <th>Paciente</th>
              <th>Consultorio</th>
              <th>Actor</th>
              <th>Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(e => (
              <tr key={e.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{e.fecha}</td>
                <td><span className={`badge ${BADGE_EVENTO[e.evento] || 'badge-muted'}`}>{e.evento}</span></td>
                <td>{e.tipo}</td>
                <td>
                  <div style={{ fontSize: '0.85rem' }}>{e.paciente}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DNI {e.dni}</div>
                </td>
                <td>{e.consultorio}</td>
                <td style={{ fontSize: '0.82rem' }}>{e.actor}</td>
                <td>
                  {e.asistencia === 'asistio'    && <span className="badge badge-success">Asistió</span>}
                  {e.asistencia === 'no_asistio' && <span className="badge badge-error">No asistió</span>}
                  {e.asistencia === null         && <span className="badge badge-muted">Sin registrar</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
