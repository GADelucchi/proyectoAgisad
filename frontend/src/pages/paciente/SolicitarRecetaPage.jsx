import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import { api, ApiError } from '../../services/apiClient'
import './SolicitarRecetaPage.css'

export default function SolicitarRecetaPage() {
  const { medicoId } = useParams()
  const navigate = useNavigate()
  const [tipo, setTipo] = useState('estandar')
  const [medicamento, setMedicamento] = useState('')
  const [dosis, setDosis] = useState('')
  const [lista, setLista] = useState([])
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)

  function agregarMedicamento() {
    if (!medicamento.trim()) { setError('Ingresá el nombre del medicamento.'); return }
    if (lista.length >= 5)   { setError('Podés agregar hasta 5 medicamentos por receta.'); return }
    setLista(prev => [...prev, { medicamento: medicamento.trim(), dosis: dosis.trim() }])
    setMedicamento('')
    setDosis('')
    setError('')
  }

  function quitarMedicamento(idx) {
    setLista(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleEnviar() {
    if (lista.length === 0) { setError('Agregá al menos un medicamento antes de enviar.'); return }
    setError('')
    setLoading(true)
    try {
      await api.post(`/pacientes/medicos/${medicoId}/recetas`, {
        tipo,
        items: lista,
      })
      setEnviado(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'No se pudo enviar la solicitud de receta.')
      } else {
        setError('No se pudo enviar la solicitud de receta.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (enviado) {
    return (
      <div className="receta-page">
        <div className="receta-confirmacion surface-raised">
          <h2>✓ Solicitud enviada</h2>
          <p>
            Tu solicitud de receta {tipo === 'urgente' ? <strong>urgente (24 h)</strong> : <strong>estándar (7 días)</strong>} fue enviada al médico.<br />
            Te notificaremos por email cuando esté lista.
          </p>
          <Button onClick={() => navigate(`/paciente/medico/${medicoId}`)}>
            Volver al menú
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="receta-page">
      <button className="acciones-volver" onClick={() => navigate(`/paciente/medico/${medicoId}`)}>
        <ChevronLeft size={16} /> Volver al menú
      </button>

      <h1>Solicitar receta</h1>

      <div className="receta-card surface-raised">
        {/* Tipo */}
        <div className="receta-tipo">
          <p className="form-label" style={{ marginBottom: '0.75rem' }}>Tipo de receta</p>
          <div className="receta-tipo-opciones">
            {[
              { val: 'estandar', label: 'Estándar', sub: '7 días de espera' },
              { val: 'urgente',  label: 'Urgente',  sub: '24 horas' },
            ].map(op => (
              <label key={op.val} className={`receta-tipo-opcion ${tipo === op.val ? 'selected' : ''}`}>
                <input type="radio" name="tipo" value={op.val} checked={tipo === op.val} onChange={() => setTipo(op.val)} />
                <span className="receta-tipo-label">{op.label}</span>
                <span className="receta-tipo-sub">{op.sub}</span>
              </label>
            ))}
          </div>
        </div>

        <hr className="divider" />

        {/* Instrucción */}
        <p className="receta-instruccion">
          Completá los campos, hacé clic en <strong>Agregar medicamento</strong> y luego en <strong>Enviar</strong>.
          Podés agregar hasta <strong>5 medicamentos</strong> por receta.
        </p>

        {/* Input */}
        <div className="receta-input-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="medicamento">Droga o medicamento</label>
            <input
              id="medicamento"
              className="form-input"
              placeholder="Ej: Omeprazol"
              value={medicamento}
              onChange={e => setMedicamento(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarMedicamento()}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="dosis">Dosis / Cantidad</label>
            <input
              id="dosis"
              className="form-input"
              placeholder="Ej: 20mg, 1 caja"
              value={dosis}
              onChange={e => setDosis(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarMedicamento()}
            />
          </div>
        </div>

        <Button variant="secondary" onClick={agregarMedicamento} disabled={lista.length >= 5}>
          <Plus size={16} /> Agregar medicamento
        </Button>

        {error && <p className="auth-error" style={{ marginTop: '0.5rem' }}>{error}</p>}

        {/* Lista */}
        {lista.length > 0 && (
          <div className="receta-lista">
            {lista.map((item, i) => (
              <div key={i} className="receta-lista-item">
                <div>
                  <strong>{item.medicamento}</strong>
                  {item.dosis && <span className="receta-lista-dosis"> — {item.dosis}</span>}
                </div>
                <button className="receta-lista-remove" onClick={() => quitarMedicamento(i)} title="Quitar">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <Button onClick={handleEnviar} disabled={lista.length === 0 || loading}>
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </Button>
        </div>
      </div>
    </div>
  )
}
