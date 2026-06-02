import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Button from '../../components/ui/Button'
import { formatTime24h } from '../../utils/dateFormat'
import './CancelarTurnoPage.css'

const TURNOS_MOCK = [
  { id: 1, fecha: '28/05/2026', hora: '10:00', consultorio: 'Virtual',   tipo: 'Seguimiento' },
  { id: 2, fecha: '02/06/2026', hora: '14:30', consultorio: 'Caraga',    tipo: 'Primera vez' },
]

export default function CancelarTurnoPage() {
  const { medicoId } = useParams()
  const navigate = useNavigate()
  const [seleccionado, setSeleccionado] = useState(null)
  const [confirmado, setConfirmado] = useState(false)
  const [motivo, setMotivo] = useState('')

  if (confirmado) {
    return (
      <div className="cancelar-page">
        <div className="receta-confirmacion surface-raised">
          <h2 style={{ color: 'var(--error)' }}>Turno cancelado</h2>
          <p>Tu turno fue cancelado correctamente. Podés solicitar uno nuevo cuando lo necesites.</p>
          <Button onClick={() => navigate(`/paciente/medico/${medicoId}`)}>Volver al menú</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="cancelar-page">
      <button className="acciones-volver" onClick={() => navigate(`/paciente/medico/${medicoId}`)}>
        <ChevronLeft size={16} /> Volver al menú
      </button>

      <h1>Cancelar turno</h1>
      <p>Seleccioná el turno que querés cancelar. Recordá que los turnos no se pueden cancelar con menos de 72 horas de anticipación.</p>

      {TURNOS_MOCK.length === 0 ? (
        <div className="surface-raised cancelar-empty">
          <p>No tenés turnos activos para cancelar.</p>
        </div>
      ) : (
        <div className="cancelar-turnos">
          {TURNOS_MOCK.map(t => (
            <button
              key={t.id}
              className={`cancelar-turno-card surface-raised ${seleccionado?.id === t.id ? 'selected' : ''}`}
              onClick={() => setSeleccionado(t)}
            >
              <div>
                <strong>{t.fecha} a las {formatTime24h(t.hora)}</strong>
                <p>{t.tipo} · {t.consultorio}</p>
              </div>
              {seleccionado?.id === t.id && <span className="badge badge-error">Seleccionado</span>}
            </button>
          ))}
        </div>
      )}

      {seleccionado && (
        <div className="cancelar-motivo surface-raised">
          <div className="form-group">
            <label className="form-label" htmlFor="motivo">Motivo de cancelación (opcional)</label>
            <textarea
              id="motivo"
              className="form-textarea"
              placeholder="Ej: viaje imprevisto, emergencia..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
          </div>
          <Button variant="danger" onClick={() => setConfirmado(true)}>
            Confirmar cancelación
          </Button>
        </div>
      )}
    </div>
  )
}
