import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Send } from 'lucide-react'
import Button from '../../components/ui/Button'
import { ApiError } from '../../services/apiClient'
import { pacientesApi } from '../../services/pacientes.api'
import './MensajesPage.css'

export default function MensajesPage() {
  const { medicoId } = useParams()
  const navigate = useNavigate()
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEnviar() {
    const asuntoClean = asunto.trim()
    const cuerpoClean = cuerpo.trim()

    if (!asuntoClean) {
      setError('Ingresa un asunto.')
      setOk('')
      return
    }
    if (!cuerpoClean) {
      setError('Escribe el mensaje para el medico.')
      setOk('')
      return
    }

    setError('')
    setOk('')
    setLoading(true)

    try {
      await pacientesApi.enviarMensaje(medicoId, { asunto: asuntoClean, mensaje: cuerpoClean })
      setAsunto('')
      setCuerpo('')
      setOk('Mensaje enviado correctamente al medico.')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'No se pudo enviar el mensaje.')
      } else {
        setError('No se pudo enviar el mensaje.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mensajes-page">
      <button className="acciones-volver" onClick={() => navigate(`/paciente/medico/${medicoId}`)}>
        <ChevronLeft size={16} /> Volver al menu
      </button>

      <h1>Mensajes y consultas</h1>

      <div className="mensajes-nuevo surface-raised">
        <h3>Nueva consulta</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="asunto">Asunto</label>
          <input id="asunto" className="form-input" placeholder="Ej: Consulta sobre medicacion" value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={150} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cuerpo">Mensaje</label>
          <textarea id="cuerpo" className="form-textarea" placeholder="Describe tu consulta..." value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
        </div>
        {error && <p className="auth-error">{error}</p>}
        {ok && <p style={{ color: 'var(--success)', fontSize: '0.86rem' }}>{ok}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleEnviar} disabled={loading || !asunto.trim() || !cuerpo.trim()}>
            <Send size={15} /> {loading ? 'Enviando...' : 'Enviar consulta'}
          </Button>
        </div>
      </div>

      <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Historial de consultas</h3>
      <div className="mensajes-lista">
        <p className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>
          El historial se habilitara en una siguiente etapa.
        </p>
      </div>
    </div>
  )
}
