import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Button from '../../components/ui/Button'
import { turnosApi } from '../../services/turnos.api'
import { medicosApi } from '../../services/medicos.api'
import { formatDateDdMmYyyy, formatTime24h } from '../../utils/dateFormat'
import './CancelarTurnoPage.css'

export default function CancelarTurnoPage() {
  const { medicoId } = useParams()
  const navigate = useNavigate()

  const [turnos, setTurnos] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [confirmado, setConfirmado] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  // Carga de turnos activos del paciente desde DB
  useEffect(() => {
    let cancelled = false

    async function cargar() {
      try {
        const medicosRows = await medicosApi.list('')
        const medico = (Array.isArray(medicosRows) ? medicosRows : []).find((m) => String(m.id) === String(medicoId))
        if (medico && medico.permiteTurnos === false) {
          if (!cancelled) {
            setError('Este médico tiene plan Inicial, por lo que no tiene módulo de turnos habilitado.')
            setTurnos([])
          }
          return
        }

        const rows = await turnosApi.listarMisTurnos({ idMedico: medicoId })
        if (!cancelled) {
          const activos = rows.filter(t => ['pendiente', 'confirmado', 'en_curso'].includes(t.status))
          setTurnos(activos)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'No se pudieron cargar tus turnos.')
          setTurnos([])
        }
      }
    }

    cargar()

    return () => {
      cancelled = true
    }
  }, [medicoId])

  async function confirmarCancelacion() {
    if (!seleccionado) return

    setError('')
    try {
      await turnosApi.cancelarPropio(seleccionado.id, motivo)
      setConfirmado(true)
    } catch (err) {
      setError(err?.message || 'No se pudo cancelar el turno.')
    }
  }

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

      {error && <p style={{ color: 'var(--error)', fontSize: '0.86rem' }}>{error}</p>}

      {turnos.length === 0 ? (
        <div className="surface-raised cancelar-empty">
          <p>No tenés turnos activos para cancelar con este médico.</p>
        </div>
      ) : (
        <div className="cancelar-turnos">
          {turnos.map(t => (
            <button
              key={t.id}
              className={`cancelar-turno-card surface-raised ${seleccionado?.id === t.id ? 'selected' : ''}`}
              onClick={() => setSeleccionado(t)}
            >
              <div>
                <strong>{formatDateDdMmYyyy(t.dateIso)} a las {formatTime24h(t.time)}</strong>
                <p>{t.type} · {t.clinicName}</p>
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
          <Button variant="danger" onClick={confirmarCancelacion}>
            Confirmar cancelación
          </Button>
        </div>
      )}
    </div>
  )
}
