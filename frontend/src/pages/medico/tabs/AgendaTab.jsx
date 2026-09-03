import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, UserPlus } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { medicosApi } from '../../../services/medicos.api'
import { pacientesApi } from '../../../services/pacientes.api'
import SmartDateInput from '../../../components/ui/SmartDateInput'
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

function buildSlotsForDate(consultorio, date, duracionEstandar = 30) {
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
    const duration = Number(rango.duracion) > 0 ? Number(rango.duracion) : duracionEstandar
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue

    for (let minute = start; minute + duration <= end; minute += duration) {
      slots.push({
        hora: toTime(minute),
        duracion: duration,
      })
    }
  }

  return sortSlots(slots)
}

// La duración real del turno vive en hora_fin; 30 min es el fallback histórico.
function rangoTurno(turno) {
  const inicio = toMinutes(turno.hora)
  const fin = turno.hora_fin ? toMinutes(turno.hora_fin) : inicio + 30
  return { inicio, fin: fin > inicio ? fin : inicio + 30 }
}

function seSuperpone(a, b) {
  return a.inicio < b.fin && b.inicio < a.fin
}

function estadoLabel(estado) {
  if (estado === 'completado') return 'Asistio'
  if (estado === 'ausente') return 'No asistio'
  if (estado === 'cancelado_clinica' || estado === 'cancelado_paciente') return 'Cancelado'
  if (estado === 'en_curso') return 'En curso'
  if (estado === 'confirmado') return 'Confirmado'
  return 'Pendiente'
}

// Asistio y no asistio se comunican con el color del slot, así que no repiten badge.
function claseEstadoTurno(estado) {
  if (estado === 'completado') return 'asistio'
  if (estado === 'ausente') return 'ausente'
  return ''
}

const FORM_ALTA_VACIO = {
  dni: '',
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  fecha_nac: '',
}

function nombrePaciente(p) {
  return `${p?.apellido || ''} ${p?.nombre || ''}`.trim() || 'Paciente'
}

function ocupaSlot(estado) {
  return estado !== 'cancelado_clinica' && estado !== 'cancelado_paciente'
}

export default function AgendaTab({ doctorId, readOnly = false, onResumenDia }) {
  const { usuario } = useAuth()
  const isSelfMedico = !doctorId && usuario?.rol === 'medico'
  const ownerDoctorId = doctorId || null
  const [consultorios, setConsultorios] = useState([])
  const [fecha, setFecha] = useState(new Date())
  const [turnos, setTurnos] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [mensajeAccion, setMensajeAccion] = useState('')
  const [slotAgendando, setSlotAgendando] = useState(null)
  const [pacientes, setPacientes] = useState([])
  const [formTurno, setFormTurno] = useState({ id_paciente: '', motivo: '', id_tipo_turno: '' })
  const [busquedaPaciente, setBusquedaPaciente] = useState('')
  const [tiposTurno, setTiposTurno] = useState([])
  const [guardandoTurno, setGuardandoTurno] = useState(false)
  const [recargarTurnos, setRecargarTurnos] = useState(0)
  const [duracionEstandar, setDuracionEstandar] = useState(30)
  const [editandoFecha, setEditandoFecha] = useState(false)
  const [altaPaciente, setAltaPaciente] = useState(null)
  const [formAlta, setFormAlta] = useState(FORM_ALTA_VACIO)
  const [guardandoAlta, setGuardandoAlta] = useState(false)
  const [mensajeAlta, setMensajeAlta] = useState('')

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
  }, [ownerDoctorId, isSelfMedico, fecha, recargarTurnos])

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

  useEffect(() => {
    if (!ownerDoctorId && !isSelfMedico) return

    let cancelled = false
    const request = ownerDoctorId
      ? medicosApi.getTurnosConfigByMedico(ownerDoctorId)
      : medicosApi.getMyTurnosConfig()

    request
      .then((config) => {
        if (cancelled) return
        const valor = Number(config?.duracion_turno_estandar)
        if (Number.isFinite(valor) && valor > 0) setDuracionEstandar(valor)
        setTiposTurno(Array.isArray(config?.tipos_turno) ? config.tipos_turno : [])
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [ownerDoctorId, isSelfMedico])

  function moverDia(n) {
    const d = new Date(fecha)
    d.setDate(d.getDate() + n)
    setFecha(d)
    setSlotAgendando(null)
  }

  /** Salta a una fecha concreta (YYYY-MM-DD) escrita a mano o elegida del calendario. */
  function irAFecha(iso) {
    if (!iso) return
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return
    const destino = new Date(y, m - 1, d)
    if (Number.isNaN(destino.getTime())) return
    setFecha(destino)
    setSlotAgendando(null)
  }

  const pacienteSeleccionado = useMemo(
    () => pacientes.find((p) => String(p.id_paciente) === String(formTurno.id_paciente)) || null,
    [pacientes, formTurno.id_paciente]
  )

  const pacientesFiltrados = useMemo(() => {
    const q = busquedaPaciente.trim().toLowerCase()
    if (!q) return []
    return pacientes
      .filter((p) => `${p.nombre || ''} ${p.apellido || ''} ${p.dni || ''}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [pacientes, busquedaPaciente])

  const fechaLabel = formatDateDdMmYyyy(fecha)
  const slotsByClinica = useMemo(() => {
    const map = {}
    for (const consultorio of consultorios) {
      map[consultorio.id] = buildSlotsForDate(consultorio, startOfDay(fecha), duracionEstandar)
    }
    return map
  }, [consultorios, fecha, duracionEstandar])

  const turnosDelDia = useMemo(() => {
    const map = {}
    for (const t of turnos) {
      const fechaKey = t.fecha_iso || t.fecha
      if (!fechaKey || !ocupaSlot(t.estado)) continue
      const byDate = map[fechaKey] || []
      byDate.push(t)
      map[fechaKey] = byDate
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

  /**
   * Un slot se ocupa si su rango pisa el de un turno, aunque el turno arranque en otro slot
   * o esté agendado en otra clínica (el médico no puede estar en dos lugares a la vez).
   */
  const resolverSlot = useCallback(({ slot, idClinica, fechaIso }) => {
    const rango = { inicio: toMinutes(slot.hora), fin: toMinutes(slot.hora) + (slot.duracion || 30) }

    const superpuestos = (turnosDelDia[fechaIso] || []).filter((t) => seSuperpone(rango, rangoTurno(t)))
    const propio = superpuestos.find((t) => Number(t.id_clinica) === Number(idClinica))

    if (propio) {
      const arrancaAca = horaKey(propio.hora) === horaKey(slot.hora)
      return { tipo: arrancaAca ? 'turno' : 'continuacion', turno: propio }
    }

    if (superpuestos.length > 0) {
      return { tipo: 'otra-clinica', turno: superpuestos[0] }
    }

    const bloqueado = (bloqueosByClinicaAndDate[idClinica]?.[fechaIso] || []).some((b) => {
      const desde = String(b.hora_inicio || '').slice(0, 5)
      const hasta = String(b.hora_fin || '').slice(0, 5)
      if (!desde || !hasta) return true
      return seSuperpone(rango, { inicio: toMinutes(desde), fin: toMinutes(hasta) })
    })

    return { tipo: bloqueado ? 'bloqueado' : 'libre' }
  }, [turnosDelDia, bloqueosByClinicaAndDate])

  const resumenDia = useMemo(() => {
    const fechaIso = fechaStr(fecha)
    let libres = 0

    for (const consultorio of consultorios) {
      for (const slot of (slotsByClinica[consultorio.id] || [])) {
        if (resolverSlot({ slot, idClinica: consultorio.id, fechaIso }).tipo === 'libre') libres += 1
      }
    }

    return {
      fechaIso,
      fechaLabel: formatDateDdMmYyyy(fecha),
      turnos: (turnosDelDia[fechaIso] || []).length,
      libres,
    }
  }, [fecha, consultorios, slotsByClinica, turnosDelDia, resolverSlot])

  useEffect(() => {
    onResumenDia?.(resumenDia)
  }, [onResumenDia, resumenDia])

  async function marcarEstado(idTurno, estado) {
    try {
      await turnosApi.cambiarEstado(idTurno, estado)
      setTurnos((prev) => prev.map((t) => (t.id_turno === idTurno ? { ...t, estado } : t)))
      setMensajeAccion('Estado actualizado.')
    } catch (err) {
      setMensajeAccion(err?.message || 'No se pudo actualizar el turno.')
    }
  }

  async function abrirAgendar({ idClinica, fechaIso, hora, duracion }) {
    setMensajeAccion('')
    setFormTurno({ id_paciente: '', motivo: '', id_tipo_turno: '' })
    setBusquedaPaciente('')
    setSlotAgendando({ idClinica, fechaIso, hora: horaKey(hora), duracion: duracion || 30 })

    if (pacientes.length > 0) return

    try {
      const rows = await pacientesApi.list(ownerDoctorId ? { idMedico: ownerDoctorId } : {})
      setPacientes(Array.isArray(rows) ? rows : [])
    } catch {
      setPacientes([])
      setMensajeAccion('No se pudo cargar el listado de pacientes.')
    }
  }

  async function agendarTurno(event) {
    event.preventDefault()
    if (!slotAgendando || !formTurno.id_paciente) return

    setGuardandoTurno(true)
    setMensajeAccion('')
    try {
      // Si se eligió un tipo de turno, su duración manda sobre la del slot:
      // una "Primera vez" de 60 min ocupa dos slots de 30.
      const tipo = tiposTurno.find((t) => String(t.id_tipo_turno) === String(formTurno.id_tipo_turno))
      const duracion = Number(tipo?.duracion_minutos) > 0
        ? Number(tipo.duracion_minutos)
        : slotAgendando.duracion

      await turnosApi.crear({
        id_medico: ownerDoctorId || undefined,
        id_paciente: Number(formTurno.id_paciente),
        id_clinica: Number(slotAgendando.idClinica),
        fecha: slotAgendando.fechaIso,
        hora: `${slotAgendando.hora}:00`,
        duracion_minutos: duracion,
        id_tipo_turno: formTurno.id_tipo_turno ? Number(formTurno.id_tipo_turno) : null,
        motivo_consulta: formTurno.motivo || tipo?.nombre || null,
      })
      setSlotAgendando(null)
      setRecargarTurnos((n) => n + 1)
      setMensajeAccion('Turno agendado.')
    } catch (err) {
      setMensajeAccion(err?.message || 'No se pudo agendar el turno.')
    } finally {
      setGuardandoTurno(false)
    }
  }

  function abrirAltaPaciente() {
    setMensajeAlta('')
    setFormAlta({ ...FORM_ALTA_VACIO, nombre: '', apellido: '' })
    setAltaPaciente(slotAgendando)
  }

  /**
   * Alta rápida desde la agenda: crea el paciente y lo deja ya seleccionado
   * en el turno que se estaba agendando, sin pasar por la pestaña Pacientes.
   */
  async function guardarPacienteNuevo(event) {
    event.preventDefault()
    if (!formAlta.dni.trim() || !formAlta.nombre.trim() || !formAlta.apellido.trim()) {
      setMensajeAlta('DNI, nombre y apellido son obligatorios.')
      return
    }

    setGuardandoAlta(true)
    setMensajeAlta('')
    try {
      const creado = await pacientesApi.crear({
        dni: formAlta.dni.trim(),
        nombre: formAlta.nombre.trim(),
        apellido: formAlta.apellido.trim(),
        email: formAlta.email.trim() || null,
        telefono: formAlta.telefono.trim() || null,
        fecha_nac: formAlta.fecha_nac || null,
      })

      setPacientes((prev) => {
        const sinDuplicado = prev.filter((p) => Number(p.id_paciente) !== Number(creado.id_paciente))
        return [...sinDuplicado, creado]
      })
      setFormTurno((prev) => ({ ...prev, id_paciente: String(creado.id_paciente) }))
      setBusquedaPaciente('')
      setAltaPaciente(null)
      setFormAlta(FORM_ALTA_VACIO)
      setMensajeAccion(
        creado?.ya_existia
          ? `${nombrePaciente(creado)} ya estaba registrado y quedó seleccionado.`
          : `${nombrePaciente(creado)} se creó y quedó seleccionado.`
      )
    } catch (err) {
      setMensajeAlta(err?.message || 'No se pudo crear el paciente.')
    } finally {
      setGuardandoAlta(false)
    }
  }

  async function bloquearHorario({ idClinica, fechaIso, hora, duracion }) {
    const horaInicio = String(hora || '').slice(0, 5)
    const horaFin = sumarMinutos(horaInicio, duracion || 30)
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

          {editandoFecha ? (
            <div className="agenda-fecha-editor">
              <SmartDateInput
                id="agenda-fecha"
                name="agenda-fecha"
                className="form-input agenda-fecha-input"
                value={fechaStr(fecha)}
                onChange={(e) => irAFecha(e.target.value)}
              />
              {/* input nativo invisible: aporta el almanaque del sistema */}
              <label className="agenda-nav-btn agenda-fecha-calendario" title="Abrir calendario">
                <CalendarDays size={16} />
                <input
                  type="date"
                  value={fechaStr(fecha)}
                  onChange={(e) => irAFecha(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="agenda-fecha-hoy"
                onClick={() => { setFecha(new Date()); setSlotAgendando(null); setEditandoFecha(false) }}
              >
                Hoy
              </button>
              <button type="button" className="agenda-fecha-hoy" onClick={() => setEditandoFecha(false)}>
                Listo
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="agenda-fecha-label"
              style={{ textTransform: 'capitalize' }}
              onClick={() => setEditandoFecha(true)}
              title="Clickeá para escribir la fecha o abrir el calendario"
            >
              {fechaLabel}
            </button>
          )}

          <button className="agenda-nav-btn" onClick={() => moverDia(1)}><ChevronRight size={16} /></button>
        </div>
        <div className="agenda-vista-label">Vista diaria</div>
      </div>

      <div className="agenda-columnas">
        {consultorios.map((c) => {
          const key = fechaStr(fecha)
          const slotsDia = slotsByClinica[c.id] || []
          const estadoPorSlot = slotsDia.map((slot) => resolverSlot({ slot, idClinica: c.id, fechaIso: key }))
          const libres = estadoPorSlot.filter((s) => s.tipo === 'libre').length

          return (
            <div key={c.id} className="agenda-columna surface-raised">
              <div className="agenda-col-header">
                <span>{c.nombre}</span>
                <span className="agenda-col-sub">{`${libres} libres`}</span>
              </div>

              {slotsDia.length === 0 && <p className="agenda-no-trabaja">Sin horarios configurados para este día.</p>}

              {slotsDia.map((slot, index) => {
                const { tipo, turno } = estadoPorSlot[index]
                const claseSlot = tipo === 'libre'
                  ? 'libre'
                  : tipo === 'bloqueado'
                    ? 'bloqueado'
                    : tipo === 'otra-clinica'
                      ? 'ocupado externo'
                      : `ocupado ${claseEstadoTurno(turno?.estado)}`.trim()
                const marcado = claseEstadoTurno(turno?.estado)

                return (
                  <div key={`${c.id}-${key}-${slot.hora}`} className={`agenda-slot ${claseSlot}`}>
                    <span className="agenda-slot-hora">{formatTime24h(slot.hora)}</span>
                    <div className="agenda-slot-turno">
                      {tipo === 'turno' ? (
                        <>
                          <div>
                            <span className="badge badge-primary" style={{ marginRight: 6 }}>
                              {turno.tipo_turno_nombre || turno.motivo || 'Consulta'}
                            </span>
                            {!marcado && (
                              <span className="badge badge-warning" style={{ marginRight: 6 }}>{estadoLabel(turno.estado)}</span>
                            )}
                            <span className="agenda-paciente">{`${turno.paciente_nombre} ${turno.paciente_apellido}`}</span>
                          </div>
                          {turno.hora_fin && (
                            <span className="agenda-slot-detalle">{`Hasta ${formatTime24h(turno.hora_fin)}`}</span>
                          )}
                          {!readOnly && (
                            <div className="agenda-slot-acciones">
                              <button
                                className={`agenda-accion-btn asistio ${marcado === 'asistio' ? 'marcado' : ''}`}
                                disabled={marcado === 'asistio'}
                                onClick={() => marcarEstado(turno.id_turno, 'completado')}
                              >
                                Asistio
                              </button>
                              <button
                                className={`agenda-accion-btn no-asistio ${marcado === 'ausente' ? 'marcado' : ''}`}
                                disabled={marcado === 'ausente'}
                                onClick={() => marcarEstado(turno.id_turno, 'ausente')}
                              >
                                No asistio
                              </button>
                              <button className="agenda-accion-btn cancelar" onClick={() => marcarEstado(turno.id_turno, 'cancelado_clinica')}>Cancelar</button>
                            </div>
                          )}
                        </>
                      ) : tipo === 'continuacion' ? (
                        <div className="agenda-slot-libre">
                          <span className="agenda-slot-libre-texto">
                            {`Continúa: ${turno.paciente_nombre} ${turno.paciente_apellido}`}
                          </span>
                          <span className="badge badge-muted">{`Desde ${formatTime24h(turno.hora)}`}</span>
                        </div>
                      ) : tipo === 'otra-clinica' ? (
                        <div className="agenda-slot-libre">
                          <span className="agenda-slot-libre-texto">
                            {`Ocupado en ${turno.clinica_nombre || 'otro consultorio'}`}
                          </span>
                          <span className="badge badge-warning">No disponible</span>
                        </div>
                      ) : tipo === 'bloqueado' ? (
                        <div className="agenda-slot-libre">
                          <span className="agenda-slot-libre-texto">Bloqueado</span>
                          <span className="badge badge-warning">No disponible</span>
                        </div>
                      ) : (
                        <>
                          <div className="agenda-slot-libre">
                            <span className="agenda-slot-libre-texto">Libre</span>
                            <div className="agenda-slot-acciones">
                              {!readOnly && isSelfMedico ? (
                                <>
                                  <button
                                    className="agenda-accion-btn agendar"
                                    onClick={() => abrirAgendar({ idClinica: c.id, fechaIso: key, hora: slot.hora, duracion: slot.duracion })}
                                  >
                                    + Agendar
                                  </button>
                                  <button
                                    className="agenda-accion-btn bloquear"
                                    onClick={() => bloquearHorario({ idClinica: c.id, fechaIso: key, hora: slot.hora, duracion: slot.duracion })}
                                  >
                                    Bloquear
                                  </button>
                                </>
                              ) : (
                                <span className="badge badge-muted">Vacio</span>
                              )}
                            </div>
                          </div>

                          {slotAgendando
                            && slotAgendando.idClinica === c.id
                            && slotAgendando.fechaIso === key
                            && slotAgendando.hora === horaKey(slot.hora) && (
                            <form className="agenda-agendar-form" onSubmit={agendarTurno}>
                              {pacienteSeleccionado ? (
                                <div className="agenda-paciente-elegido">
                                  <span>
                                    <strong>{nombrePaciente(pacienteSeleccionado)}</strong>
                                    {pacienteSeleccionado.dni ? ` · DNI ${pacienteSeleccionado.dni}` : ''}
                                  </span>
                                  <button
                                    type="button"
                                    className="agenda-fecha-hoy"
                                    onClick={() => {
                                      setFormTurno({ ...formTurno, id_paciente: '' })
                                      setBusquedaPaciente('')
                                    }}
                                  >
                                    Cambiar
                                  </button>
                                </div>
                              ) : (
                                <div className="agenda-buscar-paciente">
                                  <div className="agenda-buscar-fila">
                                    <input
                                      className="form-input"
                                      placeholder="Buscar por nombre, apellido o DNI..."
                                      value={busquedaPaciente}
                                      onChange={(e) => setBusquedaPaciente(e.target.value)}
                                      autoComplete="off"
                                    />
                                    <button type="button" className="agenda-nuevo-paciente-btn" onClick={abrirAltaPaciente}>
                                      <UserPlus size={13} /> Nuevo paciente
                                    </button>
                                  </div>

                                  {busquedaPaciente.trim().length > 0 && (
                                    <ul className="agenda-resultados">
                                      {pacientesFiltrados.length === 0 && (
                                        <li className="agenda-resultado-vacio">
                                          Sin resultados. Podés crearlo con “Nuevo paciente”.
                                        </li>
                                      )}
                                      {pacientesFiltrados.map((p) => (
                                        <li key={p.id_paciente}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFormTurno({ ...formTurno, id_paciente: String(p.id_paciente) })
                                              setBusquedaPaciente('')
                                            }}
                                          >
                                            {nombrePaciente(p)}
                                            <span className="agenda-resultado-dni">DNI {p.dni || '-'}</span>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}

                              {tiposTurno.length > 0 && (
                                <select
                                  className="form-select"
                                  value={formTurno.id_tipo_turno}
                                  onChange={(e) => setFormTurno({ ...formTurno, id_tipo_turno: e.target.value })}
                                >
                                  <option value="">Tipo de turno (opcional)</option>
                                  {tiposTurno.map((t) => (
                                    <option key={t.id_tipo_turno} value={String(t.id_tipo_turno)}>
                                      {`${t.nombre} · ${t.duracion_minutos} min`}
                                    </option>
                                  ))}
                                </select>
                              )}

                              <input
                                className="form-input"
                                placeholder="Motivo (opcional)"
                                value={formTurno.motivo}
                                onChange={(e) => setFormTurno({ ...formTurno, motivo: e.target.value })}
                              />
                              <div className="agenda-slot-acciones">
                                <button
                                  className="agenda-accion-btn asistio"
                                  type="submit"
                                  disabled={guardandoTurno || !formTurno.id_paciente}
                                >
                                  {guardandoTurno ? 'Agendando...' : 'Confirmar'}
                                </button>
                                <button className="agenda-accion-btn cancelar" type="button" onClick={() => setSlotAgendando(null)}>
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          )}
                        </>
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

      {altaPaciente && (
        <div className="config-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAltaPaciente(null) }}>
          <form className="config-modal surface-raised agenda-alta-modal" onSubmit={guardarPacienteNuevo}>
            <div className="config-modal-header">
              <h3>Nuevo paciente</h3>
              <p className="config-section-sub" style={{ margin: 0 }}>
                Se crea y queda seleccionado para el turno de las {altaPaciente.hora}.
              </p>
            </div>

            <div className="auth-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="ag-dni">DNI</label>
                <input
                  id="ag-dni"
                  className="form-input"
                  inputMode="numeric"
                  placeholder="Sin puntos"
                  value={formAlta.dni}
                  onChange={(e) => setFormAlta({ ...formAlta, dni: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ag-nacimiento">Fecha de nacimiento</label>
                <SmartDateInput
                  id="ag-nacimiento"
                  name="fecha_nac"
                  value={formAlta.fecha_nac}
                  onChange={(e) => setFormAlta({ ...formAlta, fecha_nac: e.target.value })}
                />
              </div>
            </div>

            <div className="auth-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="ag-nombre">Nombre</label>
                <input
                  id="ag-nombre"
                  className="form-input"
                  value={formAlta.nombre}
                  onChange={(e) => setFormAlta({ ...formAlta, nombre: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ag-apellido">Apellido</label>
                <input
                  id="ag-apellido"
                  className="form-input"
                  value={formAlta.apellido}
                  onChange={(e) => setFormAlta({ ...formAlta, apellido: e.target.value })}
                />
              </div>
            </div>

            <div className="auth-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="ag-telefono">Teléfono (opcional)</label>
                <input
                  id="ag-telefono"
                  className="form-input"
                  value={formAlta.telefono}
                  onChange={(e) => setFormAlta({ ...formAlta, telefono: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ag-email">Email (opcional)</label>
                <input
                  id="ag-email"
                  type="email"
                  className="form-input"
                  value={formAlta.email}
                  onChange={(e) => setFormAlta({ ...formAlta, email: e.target.value })}
                />
              </div>
            </div>

            {mensajeAlta && <p className="config-terms-msg">{mensajeAlta}</p>}

            <div className="config-modal-actions">
              <button type="button" className="agenda-accion-btn cancelar" onClick={() => setAltaPaciente(null)}>
                Cancelar
              </button>
              <button type="submit" className="agenda-accion-btn asistio" disabled={guardandoAlta}>
                {guardandoAlta ? 'Creando...' : 'Crear y agregar al turno'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
