import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { medicosApi } from '../../../services/medicos.api'
import { turnosApi } from '../../../services/turnos.api'
import { formatDateDdMmYyyy, formatTime24h } from '../../../utils/dateFormat'
import './AgendaTab.css'

function pad(n) { return String(n).padStart(2, '0') }
function fechaStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getDayIndex(date) {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

function sortSlots(slots) {
  return [...(Array.isArray(slots) ? slots : [])].sort((a, b) => String(a.hora).localeCompare(String(b.hora)))
}

function toMinutes(value) {
  const [hours, minutes] = String(value || '').slice(0, 5).split(':').map(Number)
  return (hours * 60) + minutes
}

function toTime(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mins = String(minutes % 60).padStart(2, '0')
  return `${hours}:${mins}:00`
}

function horaKey(value) {
  return String(value || '').slice(0, 5)
}

function sumarMinutos(hora, minutos = 30) {
  const base = toMinutes(hora)
  return toTime(base + minutos).slice(0, 5)
}

function buildSlotsForDate(consultorio, date) {
  const iso = fechaStr(date)
  const slots = []
  const dayIndex = getDayIndex(date)
  const dayLabel = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'][dayIndex]

  const weeklyRanges = Array.isArray(consultorio?.rangos)
    ? consultorio.rangos.filter((rango) => {
        if (rango?.frecuencia !== 'semanal') return false
        if (Array.isArray(rango?.dias) && rango.dias.length > 0) return rango.dias.includes(dayLabel)
        return rango?.dia === dayLabel
      })
    : []

  const uniqueRanges = Array.isArray(consultorio?.rangos_unicos)
    ? consultorio.rangos_unicos.filter((rango) => String(rango?.fecha || '').slice(0, 10) === iso)
    : []

  const ranges = [...weeklyRanges, ...uniqueRanges]

  for (const rango of ranges) {
    const start = toMinutes(rango.inicio || rango.desde)
    const end = toMinutes(rango.fin || rango.hasta)
    const duration = Number(rango.duracion || 30)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue

    for (let minute = start; minute + duration <= end; minute += duration) {
      slots.push({
        hora: toTime(minute),
        libre: true,
        bloqueado: false,
      })
    }
  }

  return sortSlots(slots)
}

function estadoLabel(estado) {
  if (estado === 'completado') return 'Asistio'
  if (estado === 'ausente') return 'No asistio'
  if (estado === 'cancelado_clinica' || estado === 'cancelado_paciente') return 'Cancelado'
  if (estado === 'en_curso') return 'En curso'
  if (estado === 'confirmado') return 'Confirmado'
  return 'Pendiente'
}

function ocupaSlot(estado) {
  return estado !== 'cancelado_clinica' && estado !== 'cancelado_paciente'
}

export default function AgendaTab({ doctorId, readOnly = false }) {
  const { usuario } = useAuth()
  const isSelfMedico = !doctorId && usuario?.rol === 'medico'
  const ownerDoctorId = doctorId || null
  const [consultorios, setConsultorios] = useState([])
  const [fecha, setFecha] = useState(new Date())
  const [turnos, setTurnos] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [mensajeAccion, setMensajeAccion] = useState('')

  useEffect(() => {
    if (!ownerDoctorId && !isSelfMedico) return

    let cancelled = false
    const request = ownerDoctorId
      ? medicosApi.listClinicasByMedico(ownerDoctorId)
      : medicosApi.listMyClinicas()

    request
      .then((rows) => {
        if (!cancelled) setConsultorios(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setConsultorios([])
      })

    return () => {
      cancelled = true
    }
  }, [ownerDoctorId, isSelfMedico])

  useEffect(() => {
    if (!ownerDoctorId && !isSelfMedico) return

    let cancelled = false
    const desde = fechaStr(fecha)
    const hasta = fechaStr(fecha)

    const turnosReq = ownerDoctorId
      ? turnosApi.listarPorMedico({ idMedico: ownerDoctorId, desde, hasta })
      : turnosApi.listarPorMedico({ desde, hasta })

    turnosReq
      .then((rows) => {
        if (!cancelled) setTurnos(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setTurnos([])
      })

    return () => {
      cancelled = true
    }
  }, [ownerDoctorId, isSelfMedico, fecha])

  useEffect(() => {
    if (!isSelfMedico || readOnly) {
      setBloqueos([])
      return
    }

    let cancelled = false
    medicosApi.listMyBloqueos()
      .then((rows) => {
        if (!cancelled) setBloqueos(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setBloqueos([])
      })

    return () => {
      cancelled = true
    }
  }, [isSelfMedico, readOnly])

  function moverDia(n) {
    const d = new Date(fecha)
    d.setDate(d.getDate() + n)
    setFecha(d)
  }

  const fechaLabel = formatDateDdMmYyyy(fecha)
  const slotsByClinica = useMemo(() => {
    const map = {}
    for (const consultorio of consultorios) {
      map[consultorio.id] = buildSlotsForDate(consultorio, startOfDay(fecha))
    }
    return map
  }, [consultorios, fecha])

  const turnosByClinicaAndDate = useMemo(() => {
    const map = {}
    for (const t of turnos) {
      const fechaKey = t.fecha_iso || t.fecha
      if (!fechaKey) continue
      const byClinica = map[t.id_clinica] || {}
      const byDate = byClinica[fechaKey] || []
      byDate.push(t)
      byClinica[fechaKey] = byDate
      map[t.id_clinica] = byClinica
    }
    return map
  }, [turnos])

  const bloqueosByClinicaAndDate = useMemo(() => {
    const map = {}
    for (const b of bloqueos) {
      const fechaKey = String(b.fecha || '').slice(0, 10)
      if (!fechaKey || !b.id_clinica) continue
      const byClinica = map[b.id_clinica] || {}
      const byDate = byClinica[fechaKey] || []
      byDate.push(b)
      byClinica[fechaKey] = byDate
      map[b.id_clinica] = byClinica
    }
    return map
  }, [bloqueos])

  async function marcarEstado(idTurno, estado) {
    try {
      await turnosApi.cambiarEstado(idTurno, estado)
      setTurnos((prev) => prev.map((t) => (t.id_turno === idTurno ? { ...t, estado } : t)))
      setMensajeAccion('Estado actualizado.')
    } catch (err) {
      setMensajeAccion(err?.message || 'No se pudo actualizar el turno.')
    }
  }

  async function bloquearHorario({ idClinica, fechaIso, hora }) {
    const horaInicio = String(hora || '').slice(0, 5)
    const horaFin = sumarMinutos(horaInicio, 30)
    if (!horaInicio) return

    try {
      await medicosApi.createMyBloqueo({
        id_clinica: Number(idClinica),
        fecha_desde: fechaIso,
        fecha_hasta: fechaIso,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        motivo: 'Bloqueado desde Agenda',
      })

      setBloqueos((prev) => [
        ...prev,
        {
          id_excepcion: `tmp-${idClinica}-${fechaIso}-${horaInicio}`,
          id_clinica: Number(idClinica),
          fecha: fechaIso,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          tipo: 'bloqueo',
          motivo: 'Bloqueado desde Agenda',
        },
      ])
      setMensajeAccion('Horario bloqueado.')
    } catch (err) {
      setMensajeAccion(err?.message || 'No se pudo bloquear el horario.')
    }
  }

  return (
    <div className="agenda-tab">
      {/* Controles */}
      <div className="agenda-controls">
        <div className="agenda-nav">
          <button className="agenda-nav-btn" onClick={() => moverDia(-1)}><ChevronLeft size={16} /></button>
          <span className="agenda-fecha-label" style={{ textTransform: 'capitalize' }}>{fechaLabel}</span>
          <button className="agenda-nav-btn" onClick={() => moverDia(1)}><ChevronRight size={16} /></button>
        </div>
        <div className="agenda-vista-label">Vista diaria</div>
      </div>

      <div className="agenda-columnas">
        {consultorios.map((c) => {
          const key = fechaStr(fecha)
          const slotsDia = slotsByClinica[c.id] || []
          const turnosDia = turnosByClinicaAndDate[c.id]?.[key] || []
          const ocupadosByHora = new Set(turnosDia.filter((t) => ocupaSlot(t.estado)).map((t) => horaKey(t.hora)))

          return (
            <div key={c.id} className="agenda-columna surface-raised">
              <div className="agenda-col-header">
                <span>{c.nombre}</span>
                <span className="agenda-col-sub">{`${Math.max(slotsDia.length - ocupadosByHora.size, 0)} libres`}</span>
              </div>

              {slotsDia.length === 0 && <p className="agenda-no-trabaja">Sin horarios configurados para este día.</p>}

              {slotsDia.map((slot) => {
                const turno = turnosDia.find((t) => horaKey(t.hora) === horaKey(slot.hora) && ocupaSlot(t.estado))
                const bloqueosDia = bloqueosByClinicaAndDate[c.id]?.[key] || []
                const bloqueado = bloqueosDia.some((b) => {
                  const from = String(b.hora_inicio || '').slice(0, 5)
                  const to = String(b.hora_fin || '').slice(0, 5)
                  const slotHora = horaKey(slot.hora)
                  if (!from || !to) return true
                  return slotHora >= from && slotHora < to
                })
                const ocupado = Boolean(turno)
                const libre = !turno && !bloqueado

                return (
                  <div key={`${c.id}-${key}-${slot.hora}`} className={`agenda-slot ${ocupado ? 'ocupado' : libre ? 'libre' : bloqueado ? 'bloqueado' : ''}`}>
                    <span className="agenda-slot-hora">{formatTime24h(slot.hora)}</span>
                    <div className="agenda-slot-turno">
                      {ocupado ? (
                        <>
                          <div>
                            <span className="badge badge-primary" style={{ marginRight: 6 }}>Consulta</span>
                            <span className="badge badge-warning" style={{ marginRight: 6 }}>{estadoLabel(turno.estado)}</span>
                            <span className="agenda-paciente">{`${turno.paciente_nombre} ${turno.paciente_apellido}`}</span>
                          </div>
                          {!readOnly && (
                            <div className="agenda-slot-acciones">
                              <button className="agenda-accion-btn asistio" onClick={() => marcarEstado(turno.id_turno, 'completado')}>Asistio</button>
                              <button className="agenda-accion-btn no-asistio" onClick={() => marcarEstado(turno.id_turno, 'ausente')}>No asistio</button>
                              <button className="agenda-accion-btn cancelar" onClick={() => marcarEstado(turno.id_turno, 'cancelado_clinica')}>Cancelar</button>
                            </div>
                          )}
                        </>
                      ) : bloqueado ? (
                        <div className="agenda-slot-libre">
                          <span className="agenda-slot-libre-texto">Bloqueado</span>
                          <span className="badge badge-warning">No disponible</span>
                        </div>
                      ) : (
                        <div className="agenda-slot-libre">
                          <span className="agenda-slot-libre-texto">Libre</span>
                          <div className="agenda-slot-acciones">
                            <span className="badge badge-muted">Vacio</span>
                            {!readOnly && isSelfMedico && (
                              <button
                                className="agenda-accion-btn bloquear"
                                onClick={() => bloquearHorario({ idClinica: c.id, fechaIso: key, hora: slot.hora })}
                              >
                                Bloquear
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        {consultorios.length === 0 && (
          <div className="agenda-columna surface-raised">
            <p className="agenda-no-trabaja">No hay consultorios cargados. Agregalos desde Configuracion para ver agenda.</p>
          </div>
        )}
      </div>
      {mensajeAccion && <p className="agenda-mensaje-accion">{mensajeAccion}</p>}
    </div>
  )
}
