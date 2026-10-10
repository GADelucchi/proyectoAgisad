import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { medicosApi } from '../../../services/medicos.api'
import { turnosApi } from '../../../services/turnos.api'
import { formatDateDdMmYyyy, formatTime24h } from '../../../utils/dateFormat'
import './WizardTurnoPage.css'

const STEPS = ['Consultorio', 'Tipo de consulta', 'Fecha y horario', 'Confirmacion']
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getMonthMatrix(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days = []

  for (let i = 0; i < first.getDay(); i += 1) {
    days.push(null)
  }

  for (let d = 1; d <= last.getDate(); d += 1) {
    days.push(new Date(year, month, d))
  }

  return days
}

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
  const [step, setStep] = useState(0)
  const [submitError, setSubmitError] = useState('')
  const [medico, setMedico] = useState({ nombre: `Medico ${medicoId}` })
  const [consultorios, setConsultorios] = useState([])
  const [slots, setSlots] = useState([])
  const [today] = useState(() => startOfDay(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [calendarStateByDate, setCalendarStateByDate] = useState({})
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [sel, setSel] = useState({ consultorio: null, tipo: null, fecha: null, horario: null, idDisponibilidad: null })
  const [permiteTurnos, setPermiteTurnos] = useState(true)
  const [tiposConsulta, setTiposConsulta] = useState([])
  const resumenPorMes = useRef(new Map())

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      try {
        const [found, clinicasRows, turnosConfig] = await Promise.all([
          medicosApi.getById(medicoId).catch(() => null),
          medicosApi.listClinicasByMedico(medicoId),
          medicosApi.getTurnosConfigByMedico(medicoId).catch(() => null),
        ])

        if (cancelled) return
        if (found) {
          setMedico({ nombre: found.nombre })
          setPermiteTurnos(found.permiteTurnos !== false)
        }
        setConsultorios(Array.isArray(clinicasRows) ? clinicasRows : [])
        const tipos = Array.isArray(turnosConfig?.tipos_turno)
          ? turnosConfig.tipos_turno
              .map((tipo, index) => ({
                id: tipo?.id_tipo_turno || `tipo-${index}`,
                label: String(tipo?.nombre || '').trim(),
                duracion: Number(tipo?.duracion_minutos || 0),
              }))
              .filter((tipo) => tipo.label && tipo.duracion > 0)
          : []
        setTiposConsulta(tipos)
      } catch {
        if (!cancelled) {
          setConsultorios([])
          setPermiteTurnos(true)
          setTiposConsulta([])
        }
      }
    }

    loadInitial()
    return () => {
      cancelled = true
    }
  }, [medicoId])

  useEffect(() => {
    let cancelled = false

    async function loadDisponibilidad() {
      if (!sel.consultorio || !sel.fecha) {
        setSlots([])
        return
      }

      try {
        const fecha = toIsoDate(sel.fecha)
        const res = await medicosApi.getDisponibilidad({
          idMedico: medicoId,
          idClinica: sel.consultorio.id,
          fecha,
          duracionMinutos: sel.tipo?.duracion || null,
        })
        if (!cancelled) {
          const rows = Array.isArray(res?.slots) ? res.slots : []
          setSlots(rows)
        }
      } catch {
        if (!cancelled) setSlots([])
      }
    }

    loadDisponibilidad()
    return () => {
      cancelled = true
    }
  }, [medicoId, sel.consultorio, sel.fecha, sel.tipo])

  // Estado de los días del mes: una sola request por mes (antes, una por día),
  // y se recuerda mientras el paciente está en el wizard para no repetirla al
  // volver a un mes o a un tipo de consulta ya vistos.
  useEffect(() => {
    let cancelled = false

    async function loadMonthStates() {
      // El calendario recién se muestra después de elegir el tipo de consulta,
      // y su duración cambia qué días quedan libres.
      if (!sel.consultorio || !sel.tipo) {
        setCalendarStateByDate({})
        return
      }

      const year = calendarMonth.getFullYear()
      const month = calendarMonth.getMonth()
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)
      const desde = toIsoDate(monthStart < today ? today : monthStart)
      const hasta = toIsoDate(monthEnd)
      const duracionMinutos = sel.tipo?.duracion || null
      const clave = `${sel.consultorio.id}|${duracionMinutos}|${desde}|${hasta}`

      const guardado = resumenPorMes.current.get(clave)
      if (guardado) {
        setCalendarStateByDate(guardado)
        return
      }

      setLoadingMonth(true)
      try {
        const res = await medicosApi.getResumenDisponibilidad({
          idMedico: medicoId,
          idClinica: sel.consultorio.id,
          desde,
          hasta,
          duracionMinutos,
        })
        const estados = Object.fromEntries((Array.isArray(res?.dias) ? res.dias : []).map((d) => [d.fecha, d.estado]))
        resumenPorMes.current.set(clave, estados)
        if (!cancelled) setCalendarStateByDate(estados)
      } catch {
        if (!cancelled) setCalendarStateByDate({})
      } finally {
        if (!cancelled) setLoadingMonth(false)
      }
    }

    loadMonthStates()
    return () => {
      cancelled = true
    }
  }, [calendarMonth, medicoId, sel.consultorio, sel.tipo, today])

  function avanzar() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
  }

  function retroceder() {
    if (step > 0) setStep((s) => s - 1)
  }

  const puedeAvanzar =
    (step === 0 && sel.consultorio) ||
    (step === 1 && sel.tipo) ||
    (step === 2 && sel.fecha && sel.horario && sel.idDisponibilidad) ||
    step === 3

  async function confirmarTurno() {
    if (!sel.consultorio || !sel.tipo || !sel.fecha || !sel.horario || !sel.idDisponibilidad) return

    setSubmitError('')
    try {
      const idTipoTurno = Number(sel.tipo.id)
      await turnosApi.crear({
        id_medico: Number(medicoId),
        id_clinica: Number(sel.consultorio.id),
        id_disponibilidad: Number(sel.idDisponibilidad),
        fecha: toIsoDate(sel.fecha),
        hora: sel.horario,
        motivo_consulta: sel.tipo.label,
        duracion_minutos: Number(sel.tipo.duracion),
        id_tipo_turno: Number.isFinite(idTipoTurno) ? idTipoTurno : null,
      })
      setStep(4)
    } catch (err) {
      setSubmitError(err?.message || 'No se pudo solicitar el turno.')
    }
  }

  function renderConsultorio() {
    return (
      <div>
        <h2 className="wizard-step-title"><span className="wizard-step-num">1</span> Selecciona donde atenderte</h2>
        {consultorios.length === 0 && <p className="wizard-no-disponible">Este medico no tiene clinicas cargadas.</p>}
        <div className="wizard-cards">
          {consultorios.map((c) => (
            <button
              key={c.id}
              className={`wizard-option-card ${sel.consultorio?.id === c.id ? 'selected' : ''}`}
              onClick={() => setSel((prev) => ({ ...prev, consultorio: c, fecha: null, horario: null, idDisponibilidad: null }))}
            >
              <span className="wizard-option-nombre">{c.nombre}</span>
              <span className="wizard-option-sub">{c.ciudad || 'Sin ciudad'}</span>
              <span className="wizard-option-dias">{c.direccion || 'Sin direccion'}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderTipo() {
    return (
      <div>
        <h2 className="wizard-step-title"><span className="wizard-step-num">2</span> Tipo de consulta</h2>
        <div className="wizard-cards wizard-cards-2">
          {tiposConsulta.map((t) => (
            <button
              key={t.id}
              className={`wizard-option-card wizard-option-card-lg ${sel.tipo?.id === t.id ? 'selected' : ''}`}
              onClick={() => setSel((prev) => ({ ...prev, tipo: t }))}
            >
              <span className="wizard-option-nombre">{t.label}</span>
              <span className={`wizard-duracion ${t.duracion >= 60 ? 'wizard-duracion-accent' : ''}`}>{t.duracion} min</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderFechaHorario() {
    const monthDays = getMonthMatrix(calendarMonth)
    const canGoPrevMonth = calendarMonth.getFullYear() > today.getFullYear() ||
      (calendarMonth.getFullYear() === today.getFullYear() && calendarMonth.getMonth() > today.getMonth())
    const availableSlots = slots.filter((slot) => Boolean(slot.libre))
    const selectedDayBlocked = slots.some((slot) => Boolean(slot.bloqueado)) && availableSlots.length === 0

    return (
      <div>
        <h2 className="wizard-step-title"><span className="wizard-step-num">3</span> Elige fecha y horario</h2>
        <div className="wizard-fecha-horario-grid">
          <div className="wizard-calendario surface-raised" style={{ padding: '1rem' }}>
            <div className="wizard-cal-header-row">
              <button
                type="button"
                className="wizard-cal-nav-btn"
                disabled={!canGoPrevMonth}
                onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="wizard-cal-header">
                {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </div>
              <button
                type="button"
                className="wizard-cal-nav-btn"
                onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="wizard-cal-grid">
              {DOW_LABELS.map((d) => (
                <div key={d} className="wizard-cal-dow">{d}</div>
              ))}

              {monthDays.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="wizard-cal-empty" />
                }

                const iso = toIsoDate(date)
                const state = calendarStateByDate[iso] || 'sin-horarios'
                const isPast = date < today
                const isSelected = sel.fecha ? isSameDay(date, sel.fecha) : false

                return (
                  <button
                    key={iso}
                    type="button"
                    className={`wizard-cal-dia ${state} ${isSameDay(date, today) ? 'hoy' : ''} ${isSelected ? 'seleccionado' : ''}`}
                    disabled={isPast || state === 'sin-horarios'}
                    onClick={() => {
                      setSel((prev) => ({
                        ...prev,
                        fecha: date,
                        horario: null,
                        idDisponibilidad: null,
                      }))
                    }}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="wizard-cal-legend">
              <span><i className="wizard-dot wizard-dot-disponible" /> Disponible</span>
              <span><i className="wizard-dot wizard-dot-bloqueada" /> Bloqueada por medico</span>
              <span><i className="wizard-dot wizard-dot-sin" /> Sin horarios libres</span>
            </div>

            {loadingMonth && <p className="wizard-no-disponible">Cargando disponibilidad del mes...</p>}
          </div>

          <div className="wizard-horarios-panel surface-raised">
            <h3>Horarios disponibles</h3>
            {!sel.fecha && <p className="wizard-no-disponible">Selecciona una fecha para ver horarios.</p>}
            {sel.fecha && (
              <>
                <p className="wizard-horarios-fecha">{formatDateDdMmYyyy(sel.fecha)}</p>
                <div className="wizard-horarios">
                    {slots.map((slot) => {
                      const isBlocked = Boolean(slot.bloqueado)
                      // El turno elegido no termina antes de que cierre la agenda del médico.
                      const excede = Boolean(slot.excede_horario) && !isBlocked
                      const isOccupied = !slot.libre && !isBlocked && !excede

                      return (
                        <button
                          key={`${slot.id_disponibilidad}-${slot.hora}`}
                          type="button"
                          className={`wizard-horario-btn ${sel.horario === slot.hora ? 'selected' : ''} ${isBlocked ? 'bloqueado' : ''} ${isOccupied || excede ? 'ocupado' : ''}`}
                          disabled={!slot.libre}
                          title={excede ? `Un turno de ${sel.tipo?.duracion} minutos no termina antes del cierre de la agenda` : undefined}
                          onClick={() => setSel((prev) => ({ ...prev, horario: slot.hora, idDisponibilidad: slot.id_disponibilidad }))}
                        >
                          <span className="wizard-horario-texto">{formatTime24h(slot.hora)}</span>
                        </button>
                      )
                    })}
                  {availableSlots.length === 0 && !selectedDayBlocked && (
                    <p className="wizard-no-disponible">No hay horarios libres para esta fecha.</p>
                  )}
                  {selectedDayBlocked && (
                    <p className="wizard-no-disponible wizard-no-disponible-bloqueado">Esta fecha esta bloqueada por el medico.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!permiteTurnos) {
    return (
      <div className="wizard-page">
        <div className="surface-raised" style={{ padding: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Turnos no disponibles</h2>
          <p style={{ marginTop: '0.3rem' }}>
            Este medico tiene plan Inicial, por lo que no esta habilitada la solicitud de turnos.
          </p>
          <Button onClick={() => navigate(`/paciente/medico/${medicoId}`)}>Volver al menu</Button>
        </div>
      </div>
    )
  }

  function renderConfirmacion() {
    return (
      <div className="wizard-confirmacion">
        <h2 className="wizard-step-title"><span className="wizard-step-num">4</span> Confirma tu turno</h2>
        <div className="surface-raised wizard-resumen">
          <div className="wizard-resumen-row"><span>Medico</span><strong>{medico.nombre}</strong></div>
          <div className="wizard-resumen-row"><span>Consultorio</span><strong>{sel.consultorio?.nombre}</strong></div>
          <div className="wizard-resumen-row"><span>Tipo</span><strong>{sel.tipo?.label}</strong></div>
          <div className="wizard-resumen-row"><span>Fecha</span><strong>{sel.fecha ? formatDateDdMmYyyy(sel.fecha) : '-'}</strong></div>
          <div className="wizard-resumen-row"><span>Horario</span><strong>{sel.horario ? formatTime24h(sel.horario) : '-'}</strong></div>
        </div>
      </div>
    )
  }

  const PASOS_RENDER = [renderConsultorio, renderTipo, renderFechaHorario, renderConfirmacion]

  if (step === 4) {
    return (
      <div className="wizard-page">
        <div className="receta-confirmacion surface-raised">
          <h2>Turno solicitado</h2>
          <p>
            Tu turno en <strong>{sel.consultorio?.nombre}</strong> para el{' '}
            <strong>{sel.fecha ? formatDateDdMmYyyy(sel.fecha) : '-'}</strong> a las{' '}
            <strong>{sel.horario ? formatTime24h(sel.horario) : '-'}</strong> fue enviado al medico.
          </p>
          <Button onClick={() => navigate(`/paciente/medico/${medicoId}`)}>Volver al menu</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="wizard-page">
      <button className="acciones-volver" onClick={() => navigate(`/paciente/medico/${medicoId}`)}>
        <ChevronLeft size={16} /> Volver al menu
      </button>

      <StepBar current={step} />

      <div className="wizard-body surface-raised">{PASOS_RENDER[step]()}</div>

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

      {submitError && <p style={{ marginTop: '0.85rem', color: 'var(--error)', fontSize: '0.86rem' }}>{submitError}</p>}
    </div>
  )
}
