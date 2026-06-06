import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../../context/AuthContext'
import AltaAsistenteForm from '../../../components/forms/AltaAsistenteForm'
import { authApi } from '../../../services/auth.api'
import { medicosApi } from '../../../services/medicos.api'
import { getClinicsByDoctor, setClinicsByDoctor, getAssistantsByDoctor, setAssistantsByDoctor, createAssistantForDoctor } from '../../../mock/demoData'
import SmartDateInput from '../../../components/ui/SmartDateInput'
import './ConfiguracionTab.css'

const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
const TERMINOS_KEY = 'agisad-terms-by-doctor'
const TERMINOS_PREDETERMINADOS = `Estos términos y condiciones regulan la atención a través de Agisad. La solicitud de turnos, recetas y mensajes no reemplaza una consulta médica de urgencia. Los datos personales serán tratados de forma confidencial según normativa vigente.`

function crearRango(id = Date.now()) {
  return {
    id,
    frecuencia: 'semanal',
    dia: 'Lun',
    fecha: '',
    desde: '',
    hasta: '',
    dias: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'],
    inicio: '09:00',
    fin: '17:00',
  }
}

function crearConsultorioVacio() {
  return {
    id: Date.now(),
    nombre: '',
    tipo: 'presencial',
    ciudad: '',
    direccion: '',
    rangos: [crearRango()],
  }
}

function resumenHorarios(rangos) {
  if (!rangos || rangos.length === 0) return 'Sin rangos cargados'
  const primero = rangos[0]
  if (primero.frecuencia === 'semanal') {
    const dias = primero.dias?.length ? primero.dias.join(' · ') : primero.dia
    return `${dias}: ${primero.inicio}-${primero.fin}`
  }
  if (primero.frecuencia === 'unica') {
    return `Unica vez ${primero.fecha || '--/--/----'}: ${primero.inicio}-${primero.fin}`
  }
  const etiqueta = `${primero.desde || '--/--/----'} a ${primero.hasta || '--/--/----'}`
  return `Rango ${etiqueta}: ${primero.inicio}-${primero.fin}`
}

export default function ConfiguracionTab() {
  const { usuario, demoMode } = useAuth()
  const doctorId = String(usuario?.idUsuario || usuario?.id || 0)
  const [consultorios, setConsultorios] = useState(() => getClinicsByDoctor(doctorId))
  const [asistentes, setAsistentes] = useState(() => getAssistantsByDoctor(doctorId))
  const [duracion, setDuracion]   = useState('30')
  const [recordatorio, setRecordatorio] = useState('10')
  const [desdeBloqueo, setDesdeBloqueo] = useState('')
  const [hastaBloqueo, setHastaBloqueo] = useState('')
  const [motivoBloqueo, setMotivoBloqueo] = useState('')
  const [mostrarModal, setMostrarModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [consultorioDraft, setConsultorioDraft] = useState(crearConsultorioVacio())
  const [terminos, setTerminos] = useState('')
  const [terminosEstado, setTerminosEstado] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadTerminos() {
      if (demoMode) {
        const guardados = JSON.parse(localStorage.getItem(TERMINOS_KEY) || '{}')
        if (!cancelled) setTerminos(guardados[doctorId] || '')
        return
      }

      try {
        const tyc = await medicosApi.getMyTyc()
        if (!cancelled) {
          setTerminos(tyc?.texto || '')
        }
      } catch {
        if (!cancelled) {
          setTerminos('')
          setTerminosEstado('No se pudieron cargar los términos desde la DB.')
        }
      }
    }

    loadTerminos()

    return () => {
      cancelled = true
    }
  }, [demoMode, doctorId])

  function toggleAsistente(id) {
    setAsistentes(prev => {
      const updated = prev.map(a => a.id === id
        ? { ...a, estado: a.estado === 'activa' ? 'bloqueada' : 'activa' }
        : a
      )
      setAssistantsByDoctor(doctorId, updated)
      return updated
    })
  }

  function togglePermisoAsistente(id, permiso) {
    setAsistentes(prev => {
      const updated = prev.map(a => {
        if (a.id !== id) return a
        const permisos = a.permisos || { agenda: true, pacientes: false }
        return {
          ...a,
          permisos: {
            ...permisos,
            [permiso]: !permisos[permiso],
          },
        }
      })
      setAssistantsByDoctor(doctorId, updated)
      return updated
    })
  }

  async function crearAsistente(payload) {
    if (demoMode) {
      const nuevo = createAssistantForDoctor(doctorId, payload)
      setAsistentes((prev) => [...prev, nuevo])
      return nuevo
    }

    const response = await authApi.registerAsistente({
      ...payload,
      clinic_ids: payload.clinic_ids,
    })

    setAsistentes((prev) => [
      ...prev,
      {
        id: response?.id_asistente || Date.now(),
        nombre: payload.nombre,
        usuario: response?.username || payload.username || payload.email.split('@')[0],
        estado: payload.permisos?.bloqueado ? 'bloqueada' : 'activa',
        permisos: payload.permisos,
      },
    ])

    return response
  }

  function abrirNuevoConsultorio() {
    setEditandoId(null)
    setConsultorioDraft(crearConsultorioVacio())
    setMostrarModal(true)
  }

  function abrirEdicionConsultorio(consultorio) {
    setEditandoId(consultorio.id)
    setConsultorioDraft({
      ...consultorio,
      rangos: consultorio.rangos.length > 0 ? consultorio.rangos : [crearRango()],
    })
    setMostrarModal(true)
  }

  function cerrarModalConsultorio() {
    setMostrarModal(false)
  }

  function actualizarDraft(campo, valor) {
    setConsultorioDraft(prev => ({ ...prev, [campo]: valor }))
  }

  function actualizarRango(rangoId, campo, valor) {
    setConsultorioDraft(prev => ({
      ...prev,
      rangos: prev.rangos.map(r => (r.id === rangoId ? { ...r, [campo]: valor } : r)),
    }))
  }

  function cambiarFrecuencia(rangoId, frecuencia) {
    setConsultorioDraft(prev => ({
      ...prev,
      rangos: prev.rangos.map(r => {
        if (r.id !== rangoId) return r
        if (frecuencia === 'semanal') return { ...r, frecuencia, fecha: '', desde: '', hasta: '', dias: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'] }
        if (frecuencia === 'unica') return { ...r, frecuencia, dia: 'Lun', desde: '', hasta: '', dias: [] }
        return { ...r, frecuencia, dia: 'Lun', fecha: '', dias: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'] }
      }),
    }))
  }

  function toggleDiaRango(rangoId, dia) {
    setConsultorioDraft(prev => ({
      ...prev,
      rangos: prev.rangos.map(r => {
        if (r.id !== rangoId) return r
        const existe = r.dias.includes(dia)
        const dias = existe ? r.dias.filter(d => d !== dia) : [...r.dias, dia]
        return { ...r, dias }
      }),
    }))
  }

  function agregarRango() {
    setConsultorioDraft(prev => ({ ...prev, rangos: [...prev.rangos, crearRango(Date.now() + prev.rangos.length)] }))
  }

  function quitarRango(rangoId) {
    setConsultorioDraft(prev => {
      if (prev.rangos.length <= 1) return prev
      return { ...prev, rangos: prev.rangos.filter(r => r.id !== rangoId) }
    })
  }

  function guardarConsultorio() {
    if (!consultorioDraft.nombre.trim()) return
    if (consultorioDraft.tipo === 'presencial' && !consultorioDraft.ciudad.trim()) return

    const payload = {
      ...consultorioDraft,
      nombre: consultorioDraft.nombre.trim(),
      ciudad: consultorioDraft.ciudad.trim(),
      direccion: consultorioDraft.direccion.trim(),
      rangos: consultorioDraft.rangos,
    }

    if (editandoId) {
      setConsultorios(prev => {
        const updated = prev.map(c => (c.id === editandoId ? payload : c))
        setClinicsByDoctor(doctorId, updated)
        return updated
      })
    } else {
      setConsultorios(prev => {
        const updated = [...prev, payload]
        setClinicsByDoctor(doctorId, updated)
        return updated
      })
    }
    cerrarModalConsultorio()
  }

  function eliminarConsultorio(id) {
    setConsultorios(prev => {
      const updated = prev.filter(c => c.id !== id)
      setClinicsByDoctor(doctorId, updated)
      return updated
    })
  }

  async function guardarTerminos() {
    const texto = terminos.trim()
    if (!texto) {
      setTerminosEstado('Ingresá un texto de términos antes de guardar.')
      return
    }

    try {
      if (demoMode) {
        const guardados = JSON.parse(localStorage.getItem(TERMINOS_KEY) || '{}')
        guardados[doctorId] = texto
        localStorage.setItem(TERMINOS_KEY, JSON.stringify(guardados))
      } else {
        await medicosApi.saveMyTyc(texto)
      }

      setTerminosEstado('Términos guardados correctamente.')
      setTimeout(() => setTerminosEstado(''), 2000)
    } catch (err) {
      setTerminosEstado(err?.message || 'No se pudieron guardar los términos.')
    }
  }

  function restaurarPredeterminados() {
    setTerminos(TERMINOS_PREDETERMINADOS)
  }

  return (
    <div className="config-tab">
      {/* Consultorios */}
      <section className="config-section surface-raised">
        <div className="config-section-header">
          <h3>🏥 Mis consultorios</h3>
          <Button variant="accent" size="sm" onClick={abrirNuevoConsultorio}><Plus size={14} /> Agregar consultorio</Button>
        </div>
        <p className="config-section-sub">Agregá, editá o eliminá los lugares donde atendés.</p>
        {consultorios.map(c => (
          <div key={c.id} className="config-consultorio-card">
            <div className="config-consultorio-info">
              <div>
                <strong>{c.nombre}</strong>
                <span className={`badge ${c.tipo === 'virtual' ? 'badge-primary' : 'badge-muted'}`} style={{ marginLeft: 8 }}>
                  {c.tipo === 'virtual' ? '🖥 Virtual' : '🏥 Presencial'}
                </span>
              </div>
              <p className="config-consultorio-horarios">{resumenHorarios(c.rangos)}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="ghost" size="sm" onClick={() => abrirEdicionConsultorio(c)}><Edit2 size={13} /> Editar</Button>
              <Button variant="danger" size="sm" onClick={() => eliminarConsultorio(c.id)}><Trash2 size={13} /> Eliminar</Button>
            </div>
          </div>
        ))}
      </section>

      {/* Config turnos */}
      <section className="config-section surface-raised">
        <h3>⚙️ Configuración general de turnos</h3>
        <div className="config-grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="duracion">Duración turno estándar</label>
            <select id="duracion" className="form-select" value={duracion} onChange={e => setDuracion(e.target.value)}>
              <option value="15">15 minutos</option>
              <option value="20">20 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">60 minutos</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="recordatorio">Recordatorio</label>
            <select id="recordatorio" className="form-select" value={recordatorio} onChange={e => setRecordatorio(e.target.value)}>
              <option value="10">10 minutos antes</option>
              <option value="30">30 minutos antes</option>
              <option value="60">1 hora antes</option>
              <option value="1440">1 día antes</option>
            </select>
          </div>
        </div>
        <Button size="sm">Guardar configuración</Button>
      </section>

      <section className="config-section surface-raised">
        <h3>📝 Términos y condiciones</h3>
        <p className="config-section-sub">Estos términos se mostrarán al paciente antes de solicitar receta o turno.</p>
        <div className="form-group">
          <label className="form-label" htmlFor="terminos">Texto de términos</label>
          <textarea
            id="terminos"
            className="form-textarea"
            rows={6}
            value={terminos}
            onChange={e => setTerminos(e.target.value)}
            placeholder={TERMINOS_PREDETERMINADOS}
          />
        </div>
        <div className="config-terms-actions">
          <Button variant="ghost" size="sm" onClick={restaurarPredeterminados}>Usar predeterminados</Button>
          <Button size="sm" onClick={guardarTerminos}>Guardar términos</Button>
        </div>
        {terminosEstado && <p className="config-terms-msg">{terminosEstado}</p>}
      </section>

      {/* Bloqueo de fechas */}
      <section className="config-section surface-raised">
        <h3>🚫 Bloquear fechas / vacaciones</h3>
        <div className="config-grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="desde">Desde</label>
            <SmartDateInput id="desde" name="desde" value={desdeBloqueo} onChange={e => setDesdeBloqueo(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="hasta">Hasta</label>
            <SmartDateInput id="hasta" name="hasta" value={hastaBloqueo} onChange={e => setHastaBloqueo(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="consultorioAfectado">Consultorio afectado</label>
          <select id="consultorioAfectado" className="form-select">
            <option>Todos los consultorios</option>
            {consultorios.map(c => <option key={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="motivo">Motivo (opcional)</label>
          <input id="motivo" type="text" className="form-input" placeholder="Vacaciones, congreso..." value={motivoBloqueo} onChange={e => setMotivoBloqueo(e.target.value)} />
        </div>
        <Button variant="secondary" size="sm"><Plus size={14} /> Agregar bloqueo</Button>
        <p className="config-bloqueos-vacio">No hay bloqueos vigentes.</p>
      </section>

      {/* Gestión de asistentes */}
      <section className="config-section surface-raised">
        <h3>👤 Gestión de asistentes</h3>
        <p className="config-section-sub">Podés bloquearlos para que no realicen acciones y solo vean la agenda.</p>
        {asistentes.map(a => (
          <div key={a.id} className="config-asistente-row">
            <div>
              <strong>{a.nombre}</strong>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Usuario: {a.usuario} · Estado: <span style={{ color: a.estado === 'activa' ? 'var(--success)' : 'var(--error)' }}>{a.estado === 'activa' ? 'Activa' : 'Bloqueada'}</span>
              </p>
              <div className="config-asistente-permisos">
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(a.permisos?.agenda)}
                    onChange={() => togglePermisoAsistente(a.id, 'agenda')}
                  />
                  Agenda
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(a.permisos?.pacientes)}
                    onChange={() => togglePermisoAsistente(a.id, 'pacientes')}
                  />
                  Pacientes
                </label>
              </div>
            </div>
            <Button
              variant={a.estado === 'activa' ? 'danger' : 'secondary'}
              size="sm"
              onClick={() => toggleAsistente(a.id)}
            >
              {a.estado === 'activa' ? 'Bloquear' : 'Desbloquear'}
            </Button>
          </div>
        ))}

        <AltaAsistenteForm
          title="Alta de asistente"
          subtitle="Le damos acceso al sistema y lo vinculamos a este profesional."
          clinicOptions={consultorios.map((consultorio) => ({
            id: consultorio.id,
            label: consultorio.nombre,
          }))}
          onCreate={crearAsistente}
        />
      </section>

      {/* Cambiar contraseña */}
      <section className="config-section surface-raised">
        <h3>🔒 Cambiar contraseña</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="passActual">Contraseña actual</label>
          <input id="passActual" type="password" className="form-input" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="passNueva">Nueva contraseña</label>
          <input id="passNueva" type="password" className="form-input" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="passConfirmar">Confirmar nueva contraseña</label>
          <input id="passConfirmar" type="password" className="form-input" />
        </div>
        <Button size="sm">Actualizar contraseña</Button>
      </section>

      {mostrarModal && (
        <div className="config-modal-backdrop" role="dialog" aria-modal="true">
          <div className="config-modal surface-raised">
            <div className="config-modal-header">
              <h3>{editandoId ? 'Editar consultorio' : 'Agregar consultorio'}</h3>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="consultorioNombre">Nombre del consultorio</label>
              <input
                id="consultorioNombre"
                className="form-input"
                value={consultorioDraft.nombre}
                onChange={e => actualizarDraft('nombre', e.target.value)}
                placeholder="Ej: Caraga"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de atención</label>
              <div className="config-radio-row">
                <label className="config-radio-option">
                  <input
                    type="radio"
                    name="tipoAtencion"
                    checked={consultorioDraft.tipo === 'presencial'}
                    onChange={() => actualizarDraft('tipo', 'presencial')}
                  />
                  <span>Presencial</span>
                </label>
                <label className="config-radio-option">
                  <input
                    type="radio"
                    name="tipoAtencion"
                    checked={consultorioDraft.tipo === 'virtual'}
                    onChange={() => actualizarDraft('tipo', 'virtual')}
                  />
                  <span>Virtual (videollamada)</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="consultorioCiudad">Ciudad</label>
              <input
                id="consultorioCiudad"
                className="form-input"
                value={consultorioDraft.ciudad}
                onChange={e => actualizarDraft('ciudad', e.target.value)}
                placeholder="Ej: La Plata"
                disabled={consultorioDraft.tipo === 'virtual'}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="consultorioDireccion">Direccion</label>
              <input
                id="consultorioDireccion"
                className="form-input"
                value={consultorioDraft.direccion}
                onChange={e => actualizarDraft('direccion', e.target.value)}
                placeholder="Calle y altura"
                disabled={consultorioDraft.tipo === 'virtual'}
              />
            </div>

            <div className="config-rangos-header">
              <h4>Rangos de atencion</h4>
              <Button variant="secondary" size="sm" onClick={agregarRango}><Plus size={14} /> Agregar rango</Button>
            </div>

            <div className="config-rangos-list">
              {consultorioDraft.rangos.map((rango, index) => (
                <div key={rango.id} className="config-rango-card">
                  <div className="form-group">
                    <label className="form-label" htmlFor={`freq-${rango.id}`}>Frecuencia</label>
                    <select
                      id={`freq-${rango.id}`}
                      className="form-select"
                      value={rango.frecuencia}
                      onChange={e => cambiarFrecuencia(rango.id, e.target.value)}
                    >
                      <option value="semanal">Semanal</option>
                      <option value="unica">Unica vez</option>
                      <option value="rango">Rango</option>
                    </select>
                  </div>

                  {rango.frecuencia === 'unica' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor={`fecha-${rango.id}`}>Fecha</label>
                      <SmartDateInput
                        id={`fecha-${rango.id}`}
                        name={`fecha-${rango.id}`}
                        value={rango.fecha}
                        onChange={e => actualizarRango(rango.id, 'fecha', e.target.value)}
                      />
                    </div>
                  )}

                  {rango.frecuencia === 'rango' && (
                    <>
                      <div className="config-grid-2">
                        <div className="form-group">
                          <label className="form-label" htmlFor={`desde-${rango.id}`}>Desde</label>
                          <SmartDateInput
                            id={`desde-${rango.id}`}
                            name={`desde-${rango.id}`}
                            value={rango.desde}
                            onChange={e => actualizarRango(rango.id, 'desde', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor={`hasta-${rango.id}`}>Hasta</label>
                          <SmartDateInput
                            id={`hasta-${rango.id}`}
                            name={`hasta-${rango.id}`}
                            value={rango.hasta}
                            onChange={e => actualizarRango(rango.id, 'hasta', e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {(rango.frecuencia === 'semanal' || rango.frecuencia === 'rango') && (
                    <div className="form-group">
                      <label className="form-label">Días</label>
                      <div className="config-dias-row">
                        {DIAS.map(dia => (
                          <button
                            key={`${rango.id}-${dia}`}
                            type="button"
                            className={`config-dia-btn ${rango.dias.includes(dia) ? 'active' : ''}`}
                            onClick={() => toggleDiaRango(rango.id, dia)}
                          >
                            {dia[0]}
                          </button>
                        ))}
                      </div>
                      {rango.frecuencia === 'semanal' && (
                        <small className="config-dia-hint">Se repetirá indefinidamente en los días marcados.</small>
                      )}
                    </div>
                  )}

                  <div className="config-grid-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`inicio-${rango.id}`}>Inicio</label>
                      <input
                        id={`inicio-${rango.id}`}
                        type="time"
                        className="form-input"
                        value={rango.inicio}
                        onChange={e => actualizarRango(rango.id, 'inicio', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`fin-${rango.id}`}>Fin</label>
                      <input
                        id={`fin-${rango.id}`}
                        type="time"
                        className="form-input"
                        value={rango.fin}
                        onChange={e => actualizarRango(rango.id, 'fin', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="config-rango-footer">
                    <Button variant="danger" size="sm" onClick={() => quitarRango(rango.id)} disabled={consultorioDraft.rangos.length === 1}>
                      Quitar
                    </Button>
                    <span>Rango {index + 1}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="config-modal-actions">
              <Button variant="secondary" onClick={cerrarModalConsultorio}>Cancelar</Button>
              <Button variant="primary" onClick={guardarConsultorio}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
