import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { getClinicsByDoctor, summarizeClinicDays } from '../../../mock/demoData'
import { formatDateDdMmYyyy, formatTime24h } from '../../../utils/dateFormat'
import './WizardTurnoPage.css'

const TIPOS_CONSULTA = [
  { id: 'seguimiento', label: 'Seguimiento',  desc: 'Ya te atendiste con el médico',    duracion: 30 },
  { id: 'primera',     label: 'Primera vez',  desc: 'Primera consulta con el médico',   duracion: 60 },
]
const STEPS = ['Consultorio', 'Tipo de consulta', 'Fecha', 'Horario', 'Confirmación']
const DAY_TO_INDEX = { Dom: 0, Lun: 1, Mar: 2, Mie: 3, Jue: 4, Vie: 5, Sab: 6 }

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function fmtMinutes(total) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function buildSlots(inicio, fin) {
  if (!inicio || !fin) return []
  const start = parseMinutes(inicio)
  const end = parseMinutes(fin)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return []

  const slots = []
  for (let t = start; t <= end - 30; t += 30) {
    slots.push(fmtMinutes(t))
  }
  return slots
}

function dateInsideRange(dateIso, fromIso, toIso) {
  if (!fromIso || !toIso) return false
  return dateIso >= fromIso && dateIso <= toIso
}

function isRangeAvailableOnDate(rango, date) {
  const dateIso = toIsoDate(date)
  if (rango.frecuencia === 'semanal') {
    return DAY_TO_INDEX[rango.dia] === date.getDay()
  }
  if (rango.frecuencia === 'unica') {
    return rango.fecha === dateIso
  }
  if (rango.frecuencia === 'rango') {
    if (!dateInsideRange(dateIso, rango.desde, rango.hasta)) return false
    if (!rango.dias?.length) return true
    const dayIndex = date.getDay()
    return rango.dias.some(d => DAY_TO_INDEX[d] === dayIndex)
  }
  return false
}

function StepBar({ current }) {
  return (
    <div className="wizard-steps">
      {STEPS.map((s, i) => (
        <div key={s} className={`wizard-step ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}`}>
          <div className="wizard-step-circle">{i < current ? '✓' : i + 1}</div>
          <span className="wizard-step-label">{s}</span>
          {i < STEPS.length - 1 && <div className="wizard-step-line" />}
        </div>
      ))}
    </div>
  )
}

export default function WizardTurnoPage() {
  const { medicoId } = useParams()
  const navigate = useNavigate()
  const [consultorios, setConsultorios] = useState(() => getClinicsByDoctor(medicoId))
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState({ consultorio: null, tipo: null, fecha: null, horario: null })

  useEffect(() => {
    const refresh = () => setConsultorios(getClinicsByDoctor(medicoId))
    window.addEventListener('agisad-demo-data-changed', refresh)
    return () => window.removeEventListener('agisad-demo-data-changed', refresh)
  }, [medicoId])

  const horariosDisponibles = sel.consultorio && sel.fecha
    ? Array.from(new Set(
      sel.consultorio.rangos
        .filter(r => isRangeAvailableOnDate(r, sel.fecha))
        .flatMap(r => buildSlots(r.inicio, r.fin))
    ))
    : []

  // Genera los días disponibles del mes actual según rangos del consultorio
  function getDiasDisponibles() {
    const dias = []
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes  = hoy.getMonth()
    const totalDias = new Date(anio, mes + 1, 0).getDate()

    for (let d = hoy.getDate(); d <= totalDias; d++) {
      const fecha = new Date(anio, mes, d)
      const disponible = sel.consultorio?.rangos?.some(r => isRangeAvailableOnDate(r, fecha))
      if (disponible) dias.push(fecha)
    }
    return dias
  }

  function avanzar() { if (step < STEPS.length - 1) setStep(s => s + 1) }
  function retroceder() { if (step > 0) setStep(s => s - 1) }

  const puedeAvanzar =
    (step === 0 && sel.consultorio) ||
    (step === 1 && sel.tipo) ||
    (step === 2 && sel.fecha) ||
    (step === 3 && sel.horario) ||
    step === 4

  // ── Paso 0: Consultorio ─────────────────────────────────────────────────
  function renderConsultorio() {
    const virtuales = consultorios.filter(c => c.tipo === 'virtual')
    const presenciales = consultorios.filter(c => c.tipo !== 'virtual')
    const ciudades = Array.from(new Set(presenciales.map(c => c.ciudad || 'Sin ciudad')))

    const grupos = [
      ...(virtuales.length ? [{ titulo: 'Virtual', items: virtuales }] : []),
      ...ciudades.map(ciudad => ({
        titulo: ciudad,
        items: presenciales.filter(c => (c.ciudad || 'Sin ciudad') === ciudad),
      })),
    ].filter(g => g.items.length > 0)

    return (
      <div>
        <h2 className="wizard-step-title"><span className="wizard-step-num">1</span> Seleccioná dónde atenderte</h2>
        <p>El médico atiende en los siguientes centros.</p>
        {consultorios.length === 0 && (
          <p className="wizard-no-disponible">Este médico no tiene clínicas cargadas en la demo.</p>
        )}
        {grupos.map(g => (
          <div key={g.titulo} className="wizard-grupo">
            <p className="wizard-grupo-titulo">{g.titulo}</p>
            <div className="wizard-cards">
              {g.items.map(c => (
                <button
                  key={c.id}
                  className={`wizard-option-card ${sel.consultorio?.id === c.id ? 'selected' : ''}`}
                  onClick={() => setSel(prev => ({ ...prev, consultorio: c, fecha: null, horario: null }))}
                >
                  <span className="wizard-option-nombre">{c.nombre}</span>
                  <span className="wizard-option-sub">{c.tipo === 'virtual' ? 'Consulta virtual' : c.ciudad}</span>
                  <span className="wizard-option-dias">{summarizeClinicDays(c)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Paso 1: Tipo ─────────────────────────────────────────────────────────
  function renderTipo() {
    return (
      <div>
        <h2 className="wizard-step-title"><span className="wizard-step-num">2</span> Tipo de consulta</h2>
        <p>Los turnos de primera vez tienen duración doble.</p>
        <div className="wizard-cards wizard-cards-2">
          {TIPOS_CONSULTA.map(t => (
            <button
              key={t.id}
              className={`wizard-option-card wizard-option-card-lg ${sel.tipo?.id === t.id ? 'selected' : ''}`}
              onClick={() => setSel(prev => ({ ...prev, tipo: t }))}
            >
              <span className="wizard-option-nombre">{t.label}</span>
              <span className="wizard-option-sub">{t.desc}</span>
              <span className={`wizard-duracion ${t.duracion >= 60 ? 'wizard-duracion-accent' : ''}`}>{t.duracion} min</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Paso 2: Fecha ────────────────────────────────────────────────────────
  function renderFecha() {
    const disponibles = getDiasDisponibles()
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes  = hoy.getMonth()
    const primerDia = new Date(anio, mes, 1).getDay()
    const totalDias = new Date(anio, mes + 1, 0).getDate()
    const diasSemana = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB']
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

    const celdas = []
    for (let i = 0; i < primerDia; i++) celdas.push(null)
    for (let d = 1; d <= totalDias; d++) celdas.push(d)

    const esDisponible = d => disponibles.some(f => f.getDate() === d)
    const esHoy = d => d === hoy.getDate()
    const esSeleccionado = d => sel.fecha?.getDate() === d

    return (
      <div>
        <h2 className="wizard-step-title"><span className="wizard-step-num">3</span> Elegí fecha</h2>
        <p>Solo se muestran los días disponibles del consultorio seleccionado.</p>
        <div className="wizard-calendario surface-raised">
          <div className="wizard-cal-header">
            <span>{meses[mes]} {anio}</span>
          </div>
          <div className="wizard-cal-grid">
            {diasSemana.map(d => <div key={d} className="wizard-cal-dow">{d}</div>)}
            {celdas.map((d, i) => {
              if (!d) return <div key={`e-${i}`} />
              const disp = esDisponible(d)
              const hoyFlag = esHoy(d)
              const selFlag = esSeleccionado(d)
              return (
                <button
                  key={d}
                  disabled={!disp}
                  className={`wizard-cal-dia ${disp ? 'disponible' : 'no-disponible'} ${hoyFlag ? 'hoy' : ''} ${selFlag ? 'seleccionado' : ''}`}
                  onClick={() => disp && setSel(prev => ({ ...prev, fecha: new Date(anio, mes, d), horario: null }))}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Paso 3: Horario ──────────────────────────────────────────────────────
  function renderHorario() {
    return (
      <div>
        <h2 className="wizard-step-title">
          <span className="wizard-step-num" style={{ background: 'var(--accent)', color: '#fff' }}>●</span>
          &nbsp;Horarios disponibles
        </h2>
        <p>{formatDateDdMmYyyy(sel.fecha)}</p>
        <div className="wizard-horarios">
          {horariosDisponibles.map(h => (
            <button
              key={h}
              className={`wizard-horario-btn ${sel.horario === h ? 'selected' : ''}`}
              onClick={() => setSel(prev => ({ ...prev, horario: h }))}
            >
              {formatTime24h(h)}
            </button>
          ))}
          {horariosDisponibles.length === 0 && (
            <p className="wizard-no-disponible">No hay horarios disponibles para la fecha elegida.</p>
          )}
        </div>
      </div>
    )
  }

  // ── Paso 4: Confirmación ─────────────────────────────────────────────────
  function renderConfirmacion() {
    return (
      <div className="wizard-confirmacion">
        <h2 className="wizard-step-title"><span className="wizard-step-num">5</span> Confirmá tu turno</h2>
        <div className="surface-raised wizard-resumen">
          <div className="wizard-resumen-row"><span>Consultorio</span><strong>{sel.consultorio?.nombre}</strong></div>
          <div className="wizard-resumen-row"><span>Tipo</span><strong>{sel.tipo?.label} — {sel.tipo?.duracion} min</strong></div>
          <div className="wizard-resumen-row"><span>Fecha</span><strong>{formatDateDdMmYyyy(sel.fecha)}</strong></div>
          <div className="wizard-resumen-row"><span>Horario</span><strong>{formatTime24h(sel.horario)}</strong></div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Al confirmar, el médico recibirá la solicitud de turno. Te notificaremos la confirmación por email.
        </p>
      </div>
    )
  }

  const PASOS_RENDER = [renderConsultorio, renderTipo, renderFecha, renderHorario, renderConfirmacion]

  // ── Enviado ──────────────────────────────────────────────────────────────
  if (step === 5) {
    return (
      <div className="wizard-page">
        <div className="receta-confirmacion surface-raised">
          <h2>✓ Turno solicitado</h2>
          <p>
            Tu turno en <strong>{sel.consultorio?.nombre}</strong> para el{' '}
            <strong>{formatDateDdMmYyyy(sel.fecha)}</strong> a las{' '}
            <strong>{formatTime24h(sel.horario)}</strong> fue enviado al médico.
          </p>
          <Button onClick={() => navigate(`/paciente/medico/${medicoId}`)}>Volver al menú</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="wizard-page">
      <button className="acciones-volver" onClick={() => navigate(`/paciente/medico/${medicoId}`)}>
        <ChevronLeft size={16} /> Volver al menú
      </button>

      <StepBar current={step} />

      <div className="wizard-body surface-raised">
        {PASOS_RENDER[step]()}
      </div>

      <div className="wizard-nav">
        {step > 0 && (
          <Button variant="secondary" onClick={retroceder}>
            <ChevronLeft size={16} /> Volver
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Button disabled={!puedeAvanzar} onClick={step === 4 ? () => setStep(5) : avanzar}>
          {step === 4 ? 'Confirmar turno' : 'Continuar'} <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}
