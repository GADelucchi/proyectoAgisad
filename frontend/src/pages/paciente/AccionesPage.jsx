import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, XCircle, FileText, MessageSquare, ChevronLeft } from 'lucide-react'
import { getDemoDoctorById } from '../../mock/demoData'
import { pacientesApi } from '../../services/pacientes.api'
import { useAuth } from '../../context/AuthContext'
import './AccionesPage.css'

const ACCIONES_POR_PLAN = {
  basico:       ['receta'],
  intermedio:   ['receta', 'turno', 'cancelar'],
  profesional:  ['receta', 'turno', 'cancelar', 'mensaje'],
  empresarial:  ['receta', 'turno', 'cancelar', 'mensaje'],
}

const ACCIONES_CONFIG = {
  turno:   { label: 'Solicitar turno',  icon: <Calendar size={32} />,    ruta: 'turno' },
  cancelar:{ label: 'Cancelar turno',   icon: <XCircle size={32} />,     ruta: 'cancelar', peligro: true },
  receta:  { label: 'Solicitar receta', icon: <FileText size={32} />,    ruta: 'receta' },
  mensaje: { label: 'Enviar mensaje',   icon: <MessageSquare size={32} />, ruta: 'mensajes' },
}

const ACCIONES_CON_TERMINOS = ['receta', 'turno']
const TERMINOS_KEY = 'agisad-terms-by-doctor'
const TERMINOS_ACEPTED_KEY = 'agisad-tyc-acepted'
const TERMINOS_PREDETERMINADOS = 'Estos términos y condiciones regulan la atención a través de Agisad. La solicitud de turnos, recetas y mensajes no reemplaza una consulta médica de urgencia. Los datos personales serán tratados de forma confidencial según normativa vigente.'

// Hash determinístico del texto de los términos para detectar cambios
function hashText(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
  }
  return String(h)
}

function getAceptedHash(patientId, medicoId) {
  try {
    const stored = JSON.parse(localStorage.getItem(TERMINOS_ACEPTED_KEY) || '{}')
    return stored?.[String(patientId)]?.[String(medicoId)] ?? null
  } catch {
    return null
  }
}

function saveAceptedHash(patientId, medicoId, hash) {
  try {
    const stored = JSON.parse(localStorage.getItem(TERMINOS_ACEPTED_KEY) || '{}')
    if (!stored[String(patientId)]) stored[String(patientId)] = {}
    stored[String(patientId)][String(medicoId)] = hash
    localStorage.setItem(TERMINOS_ACEPTED_KEY, JSON.stringify(stored))
  } catch {
    // localStorage no disponible: ignorar
  }
}

export default function AccionesPage() {
  const { medicoId } = useParams()
  const navigate = useNavigate()
  const { usuario, demoMode } = useAuth()
  const patientId = usuario?.idUsuario || usuario?.id || null
  const medicoDemo = getDemoDoctorById(medicoId)
  const medico = useMemo(() => {
    if (medicoDemo) return medicoDemo
    return {
      id: Number(medicoId),
      nombre: `Médico ${medicoId}`,
      especialidad: 'Especialidad',
      matricula: '-',
      plan: 'profesional',
    }
  }, [medicoDemo, medicoId])
  const [showAceptacion, setShowAceptacion] = useState(false)
  const [showTerminos, setShowTerminos] = useState(false)
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [accionPendiente, setAccionPendiente] = useState(null)
  const [tycApi, setTycApi] = useState(null)

  const accionesDisponibles = ACCIONES_POR_PLAN[medico.plan] || []

  const terminosPorMedico = JSON.parse(localStorage.getItem(TERMINOS_KEY) || '{}')
  const terminosActuales = terminosPorMedico[medicoId] || TERMINOS_PREDETERMINADOS
  const terminosHash = hashText(terminosActuales)

  useEffect(() => {
    let cancelled = false

    async function loadTyc() {
      if (demoMode) {
        setTycApi(null)
        return
      }

      try {
        const response = await pacientesApi.getTycMedico(medicoId)
        if (!cancelled) {
          setTycApi(response)
        }
      } catch {
        if (!cancelled) {
          setTycApi(null)
        }
      }
    }

    loadTyc()

    return () => {
      cancelled = true
    }
  }, [demoMode, medicoId])

  function yAceptoTerminos() {
    if (!demoMode) {
      if (!tycApi || !tycApi.requiere_aceptacion) return true
      return Boolean(tycApi.aceptado)
    }

    if (!patientId) return false
    return getAceptedHash(patientId, medicoId) === terminosHash
  }

  function navegarAccion(key) {
    const a = ACCIONES_CONFIG[key]
    navigate(`/paciente/${a.ruta}/${medicoId}`)
  }

  function handleClickAccion(key) {
    if (ACCIONES_CON_TERMINOS.includes(key) && !yAceptoTerminos()) {
      setAccionPendiente(key)
      setAceptaTerminos(false)
      setShowAceptacion(true)
      return
    }
    navegarAccion(key)
  }

  async function confirmarAceptacion() {
    if (!accionPendiente || !aceptaTerminos) return

    if (demoMode) {
      saveAceptedHash(patientId, medicoId, terminosHash)
    } else if (tycApi?.tyc?.id_tyc) {
      await pacientesApi.aceptarTycMedico(medicoId, tycApi.tyc.id_tyc)
      setTycApi(prev => (prev ? { ...prev, aceptado: true } : prev))
    }

    setShowAceptacion(false)
    navegarAccion(accionPendiente)
  }

  const textoTerminosModal = demoMode
    ? terminosActuales
    : tycApi?.tyc?.texto || TERMINOS_PREDETERMINADOS

  return (
    <div className="acciones-page">
      <button className="acciones-volver" onClick={() => navigate('/paciente')}>
        <ChevronLeft size={16} /> Volver al buscador
      </button>

      <div className="acciones-medico-header">
        <h1>{medico.nombre}</h1>
        <p>{medico.especialidad} &middot; {medico.matricula}</p>
      </div>

      <h2 className="acciones-pregunta">¿Qué querés hacer hoy?</h2>

      <div className="acciones-grid">
        {accionesDisponibles.map(key => {
          const a = ACCIONES_CONFIG[key]
          return (
            <button
              key={key}
              className={`accion-card surface-raised ${a.peligro ? 'accion-card-peligro' : ''}`}
              onClick={() => handleClickAccion(key)}
            >
              <div className="accion-icon">{a.icon}</div>
              <span className="accion-label">{a.label}</span>
            </button>
          )
        })}
      </div>

      {showAceptacion && (
        <div className="acciones-modal-backdrop" role="dialog" aria-modal="true">
          <div className="acciones-modal surface-raised">
            <h3>Confirmación de términos</h3>
            <p>Antes de continuar, tenés que aceptar las condiciones del médico.</p>
            <label className="acciones-checkbox-row">
              <input type="checkbox" checked={aceptaTerminos} onChange={e => setAceptaTerminos(e.target.checked)} />
              <span>
                Acepto los{' '}
                <button type="button" className="acciones-terms-link" onClick={() => setShowTerminos(true)}>
                  términos y condiciones
                </button>
              </span>
            </label>

            <div className="acciones-modal-actions">
              <button type="button" className="acciones-modal-btn" onClick={() => setShowAceptacion(false)}>Cancelar</button>
              <button type="button" className="acciones-modal-btn acciones-modal-btn-primary" onClick={confirmarAceptacion} disabled={!aceptaTerminos}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTerminos && (
        <div className="acciones-modal-backdrop" role="dialog" aria-modal="true">
          <div className="acciones-modal acciones-modal-terms surface-raised">
            <h3>Términos y condiciones</h3>
            <p className="acciones-terms-text">{textoTerminosModal}</p>
            <div className="acciones-modal-actions">
              <button type="button" className="acciones-modal-btn acciones-modal-btn-primary" onClick={() => setShowTerminos(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
