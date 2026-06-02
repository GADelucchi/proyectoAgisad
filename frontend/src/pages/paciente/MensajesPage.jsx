import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Send } from 'lucide-react'
import Button from '../../components/ui/Button'
import { formatDateDdMmYyyy } from '../../utils/dateFormat'
import './MensajesPage.css'

const MENSAJES_MOCK = [
  { id: 1, asunto: '¿Puedo tomar Ibuprofeno con la medicación actual?', estado: 'respondido', fecha: '15/05/2026', respuesta: 'Sí, podés tomar hasta 400mg sin problema. Cualquier duda me escribís.' },
  { id: 2, asunto: 'Necesito renovar el certificado laboral',          estado: 'pendiente',  fecha: '19/05/2026', respuesta: null },
]

export default function MensajesPage() {
  const { medicoId } = useParams()
  const navigate = useNavigate()
  const [mensajes, setMensajes] = useState(MENSAJES_MOCK)
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [enviado, setEnviado] = useState(false)

  function handleEnviar() {
    if (!asunto.trim() || !cuerpo.trim()) return
    setMensajes(prev => [
      ...prev,
      { id: Date.now(), asunto: asunto.trim(), estado: 'pendiente', fecha: formatDateDdMmYyyy(new Date()), respuesta: null }
    ])
    setAsunto('')
    setCuerpo('')
    setEnviado(true)
    setTimeout(() => setEnviado(false), 3000)
  }

  return (
    <div className="mensajes-page">
      <button className="acciones-volver" onClick={() => navigate(`/paciente/medico/${medicoId}`)}>
        <ChevronLeft size={16} /> Volver al menú
      </button>

      <h1>Mensajes y consultas</h1>

      {/* Formulario nuevo mensaje */}
      <div className="mensajes-nuevo surface-raised">
        <h3>Nueva consulta</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="asunto">Asunto</label>
          <input id="asunto" className="form-input" placeholder="Ej: Consulta sobre medicación" value={asunto} onChange={e => setAsunto(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cuerpo">Mensaje</label>
          <textarea id="cuerpo" className="form-textarea" placeholder="Describí tu consulta con detalle..." value={cuerpo} onChange={e => setCuerpo(e.target.value)} />
        </div>
        {enviado && <p className="mensajes-ok">✓ Consulta enviada correctamente.</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleEnviar} disabled={!asunto.trim() || !cuerpo.trim()}>
            <Send size={15} /> Enviar consulta
          </Button>
        </div>
      </div>

      {/* Historial */}
      <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Historial de consultas</h3>
      <div className="mensajes-lista">
        {mensajes.length === 0 && <p className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>No hay consultas registradas.</p>}
        {mensajes.map(m => (
          <div key={m.id} className="mensaje-card surface-raised">
            <div className="mensaje-card-header">
              <span className="mensaje-asunto">{m.asunto}</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={`badge ${m.estado === 'respondido' ? 'badge-success' : 'badge-warning'}`}>
                  {m.estado === 'respondido' ? 'Respondido' : 'Pendiente'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.fecha}</span>
              </div>
            </div>
            {m.respuesta && (
              <div className="mensaje-respuesta">
                <p className="form-label" style={{ marginBottom: '4px' }}>Respuesta del médico</p>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>{m.respuesta}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
