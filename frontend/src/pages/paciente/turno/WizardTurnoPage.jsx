import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../../context/AuthContext'
import { medicosApi } from '../../../services/medicos.api'
import { turnosApi } from '../../../services/turnos.api'
import {
  createAppointment,
  getBookedSlotsByDoctorClinicDate,
  getClinicsByDoctor,
  getDemoDoctorById,
  summarizeClinicDays,
} from '../../../mock/demoData'
import { formatDateDdMmYyyy, formatTime24h } from '../../../utils/dateFormat'
import './WizardTurnoPage.css'

const TIPOS_CONSULTA = [
  { id: 'seguimiento', label: 'Seguimiento',  desc: 'Ya te atendiste con el médico',    duracion: 30 },
  { id: 'primera',     label: 'Primera vez',  desc: 'Primera consulta con el médico',   duracion: 60 },
]
const STEPS = ['Consultorio', 'Tipo de consulta', 'Fecha y horario', 'Confirmación']
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
  const { usuario, demoMode } = useAuth()
  const [consultorios, setConsultorios] = useState(() => getClinicsByDoctor(medicoId))
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState({ consultorio: null, tipo: null, fecha: null, horario: null })
  const [submitError, setSubmitError] = useState('')

  const medico = useMemo(() => getDemoDoctorById(medicoId), [medicoId])
  const patientId = usuario?.idUsuario || usuario?.id || null

  useEffect(() => {
    if (!demoMode) {
      let cancelled = false
      medicosApi
        .listClinicasByMedico(medicoId)
        .then((rows) => {
          if (!cancelled) {
            setConsultorios(Array.isArray(rows) ? rows : [])
          }
        })
        .catch(() => {
          if (!cancelled) setConsultorios([])
        })

      return () => {
        cancelled = true
      }
    }

    const refresh = () => setConsultorios(getClinicsByDoctor(medicoId))
    window.addEventListener('agisad-demo-data-changed', refresh)
    return () => window.removeEventListener('agisad-demo-data-changed', refresh)
  }, [medicoId, demoMode])

  function getSlotsForDate(date) {
    if (!sel.consultorio || !date) return []
    return Array.from(new Set(
      sel.consultorio.rangos
        .filter(r => isRangeAvailableOnDate(r, date))
        .flatMap(r => buildSlots(r.inicio, r.fin))
    ))
  }

  const dateIso = sel.fecha ? toIsoDate(sel.fecha) : null
  const allSlotsOfDay = sel.fecha ? getSlotsForDate(sel.fecha) : []
  const bookedSlots = dateIso
    ? new Set(
      demoMode
        ? getBookedSlotsByDoctorClinicDate({
          doctorId: medicoId,
          clinicId: sel.consultorio?.id,
          dateIso,
        })
        : []
    )
    : new Set()

  const horariosDisponibles = allSlotsOfDay.filter(slot => !bookedSlots.has(slot))

  // Genera disponibilidad de días del mes actual teniendo en cuenta turnos ocupados
  function getDisponibilidadMes() {
    const disponibilidad = {}
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes  = hoy.getMonth()
    const totalDias = new Date(anio, mes + 1, 0).getDate()

    for (let d = hoy.getDate(); d <= totalDias; d++) {
      const fecha = new Date(anio, mes, d)
      const dateIso = toIsoDate(fecha)
      const slots = getSlotsForDate(fecha)
      if (!slots.length) continue

      const booked = new Set(
        getBookedSlotsByDoctorClinicDate({
          doctorId: medicoId,
          clinicId: sel.consultorio?.id,
          dateIso,
        })
      )
      const libres = slots.filter(slot => !booked.has(slot))

      disponibilidad[d] = {
        fecha,
        total: slots.length,
        libres: libres.length,
      }
    }

    return disponibilidad
  }

  function avanzar() { if (step < STEPS.length - 1) setStep(s => s + 1) }
  function retroceder() { if (step > 0) setStep(s => s - 1) }

  const puedeAvanzar =
    (step === 0 && sel.consultorio) ||
    (step === 1 && sel.tipo) ||
    (step === 2 && sel.fecha && sel.horario) ||
    step === 3

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

  // ── Paso 2: Fecha y horario ───────────────────────────────────────────────
  function renderFechaHorario() {
    const disponibilidad = getDisponibilidadMes()
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

    const esDisponible = d => (disponibilidad[d]?.libres || 0) > 0
    const esCompleto = d => (disponibilidad[d]?.total || 0) > 0 && (disponibilidad[d]?.libres || 0) === 0
    const esHoy = d => d === hoy.getDate()
    const esSeleccionado = d => sel.fecha?.getDate() === d

    return (
      <div>
        <h2 className="wizard-step-title"><span className="wizard-step-num">3</span> Elegí fecha y horario</h2>
        <p>Los días en gris están completos. Al seleccionar día, vas a ver horarios a la derecha (o debajo en mobile).</p>

        <div className="wizard-fecha-horario-grid">
          <div className="wizard-calendario surface-raised">
            <div className="wizard-cal-header">
              <span>{meses[mes]} {anio}</span>
            </div>
            <div className="wizard-cal-grid">
              {diasSemana.map(d => <div key={d} className="wizard-cal-dow">{d}</div>)}
              {celdas.map((d, i) => {
                if (!d) return <div key={`e-${i}`} />
                const disp = esDisponible(d)
                const full = esCompleto(d)
                const hoyFlag = esHoy(d)
                const selFlag = esSeleccionado(d)

                return (
                  <button
                    key={d}
                    disabled={!disp}
                    className={`wizard-cal-dia ${disp ? 'disponible' : 'no-disponible'} ${full ? 'completo' : ''} ${hoyFlag ? 'hoy' : ''} ${selFlag ? 'seleccionado' : ''}`}
                    onClick={() => disp && setSel(prev => ({ ...prev, fecha: new Date(anio, mes, d), horario: null }))}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="wizard-horarios-panel surface-raised">
            <h3>Horarios disponibles</h3>
            {!sel.fecha && (
              <p className="wizard-no-disponible">Seleccioná una fecha para ver horarios.</p>
            )}

            {sel.fecha && (
              <>
                <p className="wizard-horarios-fecha">{formatDateDdMmYyyy(sel.fecha)}</p>
                <div className="wizard-horarios">
                  {allSlotsOfDay.map(h => {
                    const ocupado = bookedSlots.has(h)
                    return (
                      <button
                        key={h}
                        disabled={ocupado}
                        className={`wizard-horario-btn ${sel.horario === h ? 'selected' : ''} ${ocupado ? 'ocupado' : ''}`}
                        onClick={() => !ocupado && setSel(prev => ({ ...prev, horario: h }))}
                      >
                        {formatTime24h(h)}
                      </button>
                    )
                  })}

                  {allSlotsOfDay.length === 0 && (
                    <p className="wizard-no-disponible">No hay turnos configurados para esta fecha.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Paso 3: Confirmación ─────────────────────────────────────────────────
  function renderConfirmacion() {
    return (
      <div className="wizard-confirmacion">
        <h2 className="wizard-step-title"><span className="wizard-step-num">4</span> Confirmá tu turno</h2>
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

  const PASOS_RENDER = [renderConsultorio, renderTipo, renderFechaHorario, renderConfirmacion]

  async function confirmarTurno() {
    if (!sel.consultorio || !sel.tipo || !sel.fecha || !sel.horario || !patientId) return

    setSubmitError('')
    try {
      if (demoMode) {
        createAppointment({
          patientId,
          doctorId: Number(medicoId),
          doctorName: medico?.nombre || `Médico ${medicoId}`,
          clinicId: sel.consultorio.id,
          clinicName: sel.consultorio.nombre,
          type: sel.tipo.label,
          dateIso: toIsoDate(sel.fecha),
          time: sel.horario,
        })
      } else {
        await turnosApi.crear({
          id_medico: Number(medicoId),
          id_clinica: Number(sel.consultorio.id),
          fecha: toIsoDate(sel.fecha),
          hora: `${sel.horario}:00`,
          motivo_consulta: sel.tipo.label,
        })
      }

      setStep(4)
    } catch (err) {
      setSubmitError(err?.message || 'No se pudo solicitar el turno.')
    }
  }

  // ── Enviado ──────────────────────────────────────────────────────────────
  if (step === 4) {
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
        <Button disabled={!puedeAvanzar} onClick={step === 3 ? confirmarTurno : avanzar}>
          {step === 3 ? 'Confirmar turno' : 'Continuar'} <ChevronRight size={16} />
        </Button>
      </div>

      {submitError && (
        <p style={{ marginTop: '0.85rem', color: 'var(--error)', fontSize: '0.86rem' }}>{submitError}</p>
      )}
    </div>
  )
}
