import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { getClinicsByDoctor } from '../../../mock/demoData'
import { formatDateDdMmYyyy } from '../../../utils/dateFormat'
import './AgendaTab.css'

const HORARIOS_BASE = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30']

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

function createInitialTurnos(clinics) {
  const today = fechaStr(new Date())
  if (!clinics.length) return {}
  return {
    [clinics[0].id]: {
      [today]: [
        { hora: '09:00', paciente: 'Paciente demo', tipo: 'Seguimiento', estado: 'pendiente' },
      ],
    },
  }
}

export default function AgendaTab({ doctorId, readOnly = false }) {
  const { usuario } = useAuth()
  const ownerDoctorId = doctorId || (usuario?.rol === 'medico' ? usuario.id : 1)
  const [consultorios, setConsultorios] = useState(() => getClinicsByDoctor(ownerDoctorId))
  const [vista, setVista] = useState('dia') // 'dia' | 'semana'
  const [fecha, setFecha] = useState(new Date())
  const [turnosByConsultorio, setTurnosByConsultorio] = useState(() => createInitialTurnos(consultorios))

  useEffect(() => {
    const refresh = () => setConsultorios(getClinicsByDoctor(ownerDoctorId))
    window.addEventListener('agisad-demo-data-changed', refresh)
    return () => window.removeEventListener('agisad-demo-data-changed', refresh)
  }, [ownerDoctorId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTurnosByConsultorio(createInitialTurnos(consultorios))
  }, [consultorios])

  function moverDia(n) {
    const d = new Date(fecha)
    d.setDate(d.getDate() + (vista === 'dia' ? n : n * 7))
    setFecha(d)
  }

  const fechaLabel = formatDateDdMmYyyy(fecha)
  const semanaInicio = useMemo(() => startOfWeek(fecha), [fecha])
  const semanaDias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i)), [semanaInicio])

  function getDayStats(dateObj) {
    const key = fechaStr(dateObj)
    const ocupados = consultorios.reduce((acc, consultorio) => {
      const turnosDia = turnosByConsultorio[consultorio.id]?.[key] || []
      return acc + turnosDia.length
    }, 0)
    const capacidad = consultorios.length * HORARIOS_BASE.length
    return {
      ocupados,
      libres: Math.max(capacidad - ocupados, 0),
    }
  }

  function marcarEstado(consultorioId, dateKey, hora, estado) {
    setTurnosByConsultorio(prev => {
      const dayTurnos = prev[consultorioId]?.[dateKey] || []
      const updatedDayTurnos = dayTurnos.map(t => (t.hora === hora ? { ...t, estado } : t))
      return {
        ...prev,
        [consultorioId]: {
          ...(prev[consultorioId] || {}),
          [dateKey]: updatedDayTurnos,
        },
      }
    })
  }

  function cancelarTurno(consultorioId, dateKey, hora) {
    setTurnosByConsultorio(prev => {
      const dayTurnos = prev[consultorioId]?.[dateKey] || []
      const updatedDayTurnos = dayTurnos.filter(t => t.hora !== hora)
      return {
        ...prev,
        [consultorioId]: {
          ...(prev[consultorioId] || {}),
          [dateKey]: updatedDayTurnos,
        },
      }
    })
  }

  function agendarTurnoDemo(consultorioId, dateKey, hora) {
    setTurnosByConsultorio(prev => {
      const dayTurnos = prev[consultorioId]?.[dateKey] || []
      if (dayTurnos.some(t => t.hora === hora)) return prev
      return {
        ...prev,
        [consultorioId]: {
          ...(prev[consultorioId] || {}),
          [dateKey]: [...dayTurnos, { hora, paciente: 'Paciente demo', tipo: 'Seguimiento', estado: 'pendiente' }],
        },
      }
    })
  }

  function renderWeekSummary(consultorio, dateObj) {
    const key = fechaStr(dateObj)
    const turnosDia = turnosByConsultorio[consultorio.id]?.[key] || []
    const ocupados = turnosDia.sort((a, b) => a.hora.localeCompare(b.hora))
    const libres = Math.max(HORARIOS_BASE.length - ocupados.length, 0)

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
                <span className="agenda-week-turno-hora">{t.hora}</span>
                <div className="agenda-week-turno-meta">
                  <span className="badge badge-primary">{t.tipo}</span>
                  {t.estado === 'asistio' && <span className="badge badge-success">Asistio</span>}
                  {t.estado === 'no_asistio' && <span className="badge badge-error">No asistio</span>}
                  {t.estado === 'pendiente' && <span className="badge badge-warning">Pendiente</span>}
                  <span className="agenda-week-turno-paciente">{t.paciente}</span>
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
            const turnosDia = turnosByConsultorio[c.id]?.[key] || []
            return (
              <div key={c.id} className="agenda-columna surface-raised">
                <div className="agenda-col-header">
                  <span>{c.nombre}</span>
                  <span className="agenda-col-sub">{`${16 - (turnosDia?.length || 0)} libres`}</span>
                </div>
                {HORARIOS_BASE.map(h => {
                  const t = turnosDia.find(x => x.hora === h)
                  return (
                    <div key={h} className={`agenda-slot ${t ? 'ocupado' : ''}`}>
                      <span className="agenda-slot-hora">{h}</span>
                      {t ? (
                        <div className="agenda-slot-turno">
                          <div>
                            <span className="badge badge-primary" style={{ marginRight: 6 }}>{t.tipo}</span>
                            {t.estado === 'asistio' && <span className="badge badge-success" style={{ marginRight: 6 }}>Asistio</span>}
                            {t.estado === 'no_asistio' && <span className="badge badge-error" style={{ marginRight: 6 }}>No asistio</span>}
                            {t.estado === 'pendiente' && <span className="badge badge-warning" style={{ marginRight: 6 }}>Pendiente</span>}
                            <span className="agenda-paciente">{t.paciente}</span>
                          </div>
                          {!readOnly && (
                            <div className="agenda-slot-acciones">
                              <button className="agenda-accion-btn asistio" onClick={() => marcarEstado(c.id, key, h, 'asistio')}>Asistio</button>
                              <button className="agenda-accion-btn no-asistio" onClick={() => marcarEstado(c.id, key, h, 'no_asistio')}>No asistio</button>
                              <button className="agenda-accion-btn cancelar" onClick={() => cancelarTurno(c.id, key, h)}>Cancelar</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="agenda-slot-libre">
                          <span className="badge badge-muted">Libre</span>
                          {!readOnly && (
                            <button className="agenda-agendar-btn" onClick={() => agendarTurnoDemo(c.id, key, h)}><Plus size={13} /> Agendar</button>
                          )}
                        </div>
                      )}
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
