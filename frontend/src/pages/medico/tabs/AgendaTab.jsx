import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { medicosApi } from '../../../services/medicos.api'
import { turnosApi } from '../../../services/turnos.api'
import { formatDateDdMmYyyy, formatTime24h } from '../../../utils/dateFormat'
import './AgendaTab.css'

function pad(n) { return String(n).padStart(2, '0') }
function fechaStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

function startOfWeek(date) {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  return start
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function estadoLabel(estado) {
  if (estado === 'asistio') return 'Asistio'
  if (estado === 'no_asistio') return 'No asistio'
  if (estado === 'cancelado') return 'Cancelado'
  return 'Pendiente'
}

export default function AgendaTab({ doctorId, readOnly = false }) {
  const { usuario } = useAuth()
  const ownerDoctorId = doctorId || (usuario?.rol === 'medico' ? (usuario?.idUsuario || usuario?.id) : null)
  const [consultorios, setConsultorios] = useState([])
  const [vista, setVista] = useState('dia') // 'dia' | 'semana'
  const [fecha, setFecha] = useState(new Date())
  const [turnos, setTurnos] = useState([])

  useEffect(() => {
    if (!ownerDoctorId) {
      setConsultorios([])
      return
    }
    let cancelled = false
    medicosApi.listClinicasByMedico(ownerDoctorId)
      .then((rows) => {
        if (!cancelled) setConsultorios(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setConsultorios([])
      })
    return () => {
      cancelled = true
    }
  }, [ownerDoctorId])

  useEffect(() => {
    if (!ownerDoctorId) {
      setTurnos([])
      return
    }
    let cancelled = false
    const desde = vista === 'dia' ? fechaStr(fecha) : fechaStr(startOfWeek(fecha))
    const hasta = vista === 'dia' ? fechaStr(fecha) : fechaStr(addDays(startOfWeek(fecha), 6))

    turnosApi
      .listarPorMedico({ idMedico: ownerDoctorId, desde, hasta })
      .then((rows) => {
        if (!cancelled) setTurnos(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setTurnos([])
      })

    return () => {
      cancelled = true
    }
  }, [ownerDoctorId, fecha, vista])

  function moverDia(n) {
    const d = new Date(fecha)
    d.setDate(d.getDate() + (vista === 'dia' ? n : n * 7))
    setFecha(d)
  }

  const fechaLabel = formatDateDdMmYyyy(fecha)
  const semanaInicio = useMemo(() => startOfWeek(fecha), [fecha])
  const semanaDias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i)), [semanaInicio])

  const turnosByClinicaAndDate = useMemo(() => {
    const map = {}
    for (const t of turnos) {
      const byClinica = map[t.id_clinica] || {}
      const byDate = byClinica[t.fecha] || []
      byDate.push(t)
      byClinica[t.fecha] = byDate
      map[t.id_clinica] = byClinica
    }
    return map
  }, [turnos])

  function getDayStats(dateObj) {
    const key = fechaStr(dateObj)
    const ocupados = consultorios.reduce((acc, consultorio) => {
      const turnosDia = turnosByClinicaAndDate[consultorio.id]?.[key] || []
      return acc + turnosDia.length
    }, 0)
    const capacidad = consultorios.length * 16
    return {
      ocupados,
      libres: Math.max(capacidad - ocupados, 0),
    }
  }

  async function marcarEstado(idTurno, estado) {
    await turnosApi.cambiarEstado(idTurno, estado)
    setTurnos((prev) => prev.map((t) => (t.id_turno === idTurno ? { ...t, estado } : t)))
  }

  function renderWeekSummary(consultorio, dateObj) {
    const key = fechaStr(dateObj)
    const turnosDia = turnosByClinicaAndDate[consultorio.id]?.[key] || []
    const ocupados = [...turnosDia].sort((a, b) => String(a.hora).localeCompare(String(b.hora)))
    const libres = Math.max(16 - ocupados.length, 0)

    return (
      <div className="agenda-week-consultorio">
        <div className="agenda-week-consultorio-head">
          <strong>{consultorio.nombre}</strong>
          <span className="agenda-week-consultorio-free">{libres} libres</span>
        </div>

        {ocupados.length === 0 ? (
          <div className="agenda-week-empty">Jornada libre</div>
        ) : (
          <div className="agenda-week-turnos">
            {ocupados.slice(0, 3).map(t => (
              <div key={`${consultorio.id}-${key}-${t.hora}`} className="agenda-week-turno-item">
                <span className="agenda-week-turno-hora">{formatTime24h(t.hora)}</span>
                <div className="agenda-week-turno-meta">
                  <span className="badge badge-primary">Consulta</span>
                  <span className="badge badge-warning">{estadoLabel(t.estado)}</span>
                  <span className="agenda-week-turno-paciente">{`${t.paciente_nombre} ${t.paciente_apellido}`}</span>
                </div>
              </div>
            ))}
            {ocupados.length > 3 && <span className="badge badge-muted">+{ocupados.length - 3} más</span>}
          </div>
        )}
      </div>
    )
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
        <div className="agenda-vista-toggle">
          <button className={`vista-btn ${vista === 'dia' ? 'active' : ''}`} onClick={() => setVista('dia')}>Día</button>
          <button className={`vista-btn ${vista === 'semana' ? 'active' : ''}`} onClick={() => setVista('semana')}>Semana</button>
        </div>
      </div>

      {/* Vista día */}
      {vista === 'dia' && (
        <div className="agenda-columnas">
          {consultorios.map(c => {
            const key = fechaStr(fecha)
            const turnosDia = turnosByClinicaAndDate[c.id]?.[key] || []
            return (
              <div key={c.id} className="agenda-columna surface-raised">
                <div className="agenda-col-header">
                  <span>{c.nombre}</span>
                  <span className="agenda-col-sub">{`${16 - (turnosDia?.length || 0)} libres`}</span>
                </div>
                {turnosDia.length === 0 && <p className="agenda-no-trabaja">Sin turnos para este día.</p>}
                {turnosDia.map((t) => (
                  <div key={t.id_turno} className="agenda-slot ocupado">
                    <span className="agenda-slot-hora">{formatTime24h(t.hora)}</span>
                    <div className="agenda-slot-turno">
                      <div>
                        <span className="badge badge-primary" style={{ marginRight: 6 }}>Consulta</span>
                        <span className="badge badge-warning" style={{ marginRight: 6 }}>{estadoLabel(t.estado)}</span>
                        <span className="agenda-paciente">{`${t.paciente_nombre} ${t.paciente_apellido}`}</span>
                      </div>
                      {!readOnly && (
                        <div className="agenda-slot-acciones">
                          <button className="agenda-accion-btn asistio" onClick={() => marcarEstado(t.id_turno, 'asistio')}>Asistio</button>
                          <button className="agenda-accion-btn no-asistio" onClick={() => marcarEstado(t.id_turno, 'no_asistio')}>No asistio</button>
                          <button className="agenda-accion-btn cancelar" onClick={() => marcarEstado(t.id_turno, 'cancelado')}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
          {consultorios.length === 0 && (
            <div className="agenda-columna surface-raised">
              <p className="agenda-no-trabaja">No hay consultorios cargados. Agregalos desde Configuracion para ver agenda.</p>
            </div>
          )}
        </div>
      )}

      {/* Vista semana */}
      {vista === 'semana' && (
        <div className="agenda-semana-wrap">
          <div className="agenda-semana-header surface-raised">
            {semanaDias.map(dia => (
              <div key={dia.toISOString()} className="agenda-semana-dia-head">
                <span>{dia.toLocaleDateString('es-AR', { weekday: 'short' })}</span>
                <strong>{formatDateDdMmYyyy(dia)}</strong>
                {consultorios.length > 0 && (() => {
                  const stats = getDayStats(dia)
                  return (
                    <div className="agenda-semana-totals" aria-label="Resumen diario">
                      <span className="agenda-total-pill ocupado">{stats.ocupados} ocup.</span>
                      <span className="agenda-total-pill libre">{stats.libres} libres</span>
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>

          <div className="agenda-semana-grid">
            {semanaDias.map(dia => (
              <div key={dia.toISOString()} className="agenda-semana-col surface-raised">
                <div className="agenda-semana-col-head">
                  <span className="agenda-semana-day-name">{dia.toLocaleDateString('es-AR', { weekday: 'long' })}</span>
                  <strong>{formatDateDdMmYyyy(dia)}</strong>
                  {consultorios.length > 0 && (() => {
                    const stats = getDayStats(dia)
                    return (
                      <div className="agenda-semana-totals" aria-label="Resumen diario">
                        <span className="agenda-total-pill ocupado">{stats.ocupados} ocupados</span>
                        <span className="agenda-total-pill libre">{stats.libres} libres</span>
                      </div>
                    )
                  })()}
                </div>
                {consultorios.length === 0 ? (
                  <p className="agenda-no-trabaja">Sin consultorios.</p>
                ) : (
                  consultorios.map(consultorio => (
                    <div key={`${consultorio.id}-${dia.toISOString()}`}>
                      {renderWeekSummary(consultorio, dia)}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
