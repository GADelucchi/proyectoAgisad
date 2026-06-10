import { useEffect, useMemo, useState } from 'react'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../../context/AuthContext'
import AltaAsistenteForm from '../../../components/forms/AltaAsistenteForm'
import { authApi } from '../../../services/auth.api'
import { medicosApi } from '../../../services/medicos.api'
import { asistentesApi } from '../../../services/asistentes.api'
import SmartDateInput from '../../../components/ui/SmartDateInput'
import SmartTimeInput from '../../../components/ui/SmartTimeInput'
import { formatTime24h } from '../../../utils/dateFormat'
import './ConfiguracionTab.css'

const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
const TERMINOS_PREDETERMINADOS =
  'Estos terminos y condiciones regulan la atencion a traves de Agisad. La solicitud de turnos, recetas y mensajes no reemplaza una consulta medica de urgencia. Los datos personales seran tratados de forma confidencial segun normativa vigente.'

function mapAsistente(row) {
  return {
    id: row.id_asistente,
    nombre: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
    usuario: row.username || row.email || '-',
    estado: row.bloqueado ? 'bloqueada' : 'activa',
    permisos: {
      agenda: Boolean(row.agenda),
      pacientes: Boolean(row.pacientes),
      mensajes: Boolean(row.mensajes),
      recetas: Boolean(row.recetas),
      configuracion: Boolean(row.configuracion),
      bloqueado: Boolean(row.bloqueado),
    },
  }
}

function clinicFormFromRow(row = null) {
  const first = row?.rangos?.[0]
  const diasSeleccionados = Array.isArray(row?.rangos)
    ? DIAS.filter((dia) =>
        row.rangos.some((r) => {
          if (Array.isArray(r?.dias) && r.dias.length) return r.dias.includes(dia)
          return r?.dia === dia
        })
      )
    : []
  const rangosUnicos = Array.isArray(row?.rangos_unicos)
    ? row.rangos_unicos.map((r) => ({
        fecha: r.fecha,
        inicio: r.inicio,
        fin: r.fin,
      }))
    : []
  const hasRecurrente = Array.isArray(row?.rangos) && row.rangos.length > 0
  const modoAgenda = row ? (hasRecurrente ? 'recurrente' : 'unica') : 'recurrente'

  return {
    id: row?.id || null,
    nombre: row?.nombre || '',
    tipo: row?.tipo || 'presencial',
    direccion: row?.direccion || '',
    dias: diasSeleccionados.length ? diasSeleccionados : ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'],
    inicio: first?.inicio || '09:00',
    fin: first?.fin || '17:00',
    modoAgenda,
    rangosUnicos,
    unicoFecha: '',
    unicoInicio: '09:00',
    unicoFin: '17:00',
  }
}

function bloqueoFormBase(consultorios = []) {
  return {
    id: null,
    id_clinica: consultorios[0]?.id || '',
    fecha_desde: '',
    fecha_hasta: '',
    motivo: '',
  }
}

export default function ConfiguracionTab() {
  const { usuario } = useAuth()
  const doctorId = String(usuario?.idUsuario || usuario?.id || '')

  const [consultorios, setConsultorios] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [asistentes, setAsistentes] = useState([])
  const [duracion, setDuracion] = useState('30')
  const [recordatorio, setRecordatorio] = useState('10')
  const [terminos, setTerminos] = useState('')
  const [terminosEstado, setTerminosEstado] = useState('')
  const [estadoCrud, setEstadoCrud] = useState('')

  const [showClinicForm, setShowClinicForm] = useState(false)
  const [clinicForm, setClinicForm] = useState(clinicFormFromRow())

  const [bloqueoForm, setBloqueoForm] = useState(bloqueoFormBase([]))

  async function loadData() {
    if (!doctorId) return

    const [clinicasRows, bloqueosRows, asistentesRows, tyc] = await Promise.all([
      medicosApi.listMyClinicas(),
      medicosApi.listMyBloqueos(),
      asistentesApi.listByMedico(doctorId).catch(() => []),
      medicosApi.getMyTyc().catch(() => null),
    ])

    const clinics = Array.isArray(clinicasRows) ? clinicasRows : []
    setConsultorios(clinics)
    setBloqueos(Array.isArray(bloqueosRows) ? bloqueosRows : [])
    setAsistentes(Array.isArray(asistentesRows) ? asistentesRows.map(mapAsistente) : [])
    setTerminos(tyc?.texto || '')
    setBloqueoForm((prev) => ({
      ...prev,
      id_clinica: prev.id_clinica || clinics[0]?.id || '',
    }))
  }

  useEffect(() => {
    loadData().catch(() => {
      setConsultorios([])
      setBloqueos([])
      setAsistentes([])
      setTerminos('')
    })
  }, [doctorId])

  async function patchAsistentePermisos(idAsistente, permisos) {
    await asistentesApi.patchPermisos(idAsistente, doctorId, permisos)
    setAsistentes((prev) =>
      prev.map((a) =>
        a.id === idAsistente
          ? {
              ...a,
              permisos: { ...a.permisos, ...permisos },
              estado: permisos.bloqueado ? 'bloqueada' : 'activa',
            }
          : a
      )
    )
  }

  function toggleAsistente(id) {
    const asistente = asistentes.find((a) => a.id === id)
    if (!asistente) return
    patchAsistentePermisos(id, { bloqueado: !asistente.permisos.bloqueado })
  }

  function togglePermisoAsistente(id, permiso) {
    const asistente = asistentes.find((a) => a.id === id)
    if (!asistente) return
    patchAsistentePermisos(id, { [permiso]: !asistente.permisos[permiso] })
  }

  async function crearAsistente(payload) {
    const response = await authApi.registerAsistente({
      ...payload,
      id_medico: Number(doctorId),
      clinic_ids: payload.clinic_ids,
    })

    await loadData()
    return response
  }

  function openNewClinica() {
    setClinicForm(clinicFormFromRow())
    setShowClinicForm(true)
    setEstadoCrud('')
  }

  function openEditClinica(clinica) {
    setClinicForm(clinicFormFromRow(clinica))
    setShowClinicForm(true)
    setEstadoCrud('')
  }

  function toggleDia(dia) {
    setClinicForm((prev) => {
      const exists = prev.dias.includes(dia)
      const nextDias = exists ? prev.dias.filter((d) => d !== dia) : [...prev.dias, dia]
      return { ...prev, dias: nextDias }
    })
  }

  function addRangoUnico() {
    if (!clinicForm.unicoFecha || !clinicForm.unicoInicio || !clinicForm.unicoFin) {
      setEstadoCrud('Completa fecha, hora inicio y hora fin para agregar un horario de unica vez.')
      return
    }

    setClinicForm((prev) => ({
      ...prev,
      rangosUnicos: [
        ...prev.rangosUnicos,
        {
          fecha: prev.unicoFecha,
          inicio: prev.unicoInicio,
          fin: prev.unicoFin,
        },
      ],
      unicoFecha: '',
    }))
    setEstadoCrud('')
  }

  function removeRangoUnico(index) {
    setClinicForm((prev) => ({
      ...prev,
      rangosUnicos: prev.rangosUnicos.filter((_, i) => i !== index),
    }))
  }

  async function submitClinica(e) {
    e.preventDefault()
    if (!clinicForm.nombre.trim()) {
      setEstadoCrud('Ingresa nombre de consultorio.')
      return
    }
    const rangosPayload = []

    if (clinicForm.modoAgenda === 'recurrente') {
      if (clinicForm.inicio && clinicForm.fin && clinicForm.dias.length > 0) {
        rangosPayload.push({
          frecuencia: 'semanal',
          dias: clinicForm.dias,
          inicio: clinicForm.inicio,
          fin: clinicForm.fin,
          duracion: 30,
        })
      }
    } else {
      for (const r of clinicForm.rangosUnicos) {
        if (!r.fecha || !r.inicio || !r.fin) continue
        rangosPayload.push({
          frecuencia: 'unica',
          fecha: r.fecha,
          inicio: r.inicio,
          fin: r.fin,
          duracion: 30,
        })
      }
    }

    if (rangosPayload.length === 0) {
      setEstadoCrud('Define al menos un rango semanal o una fecha de unica vez.')
      return
    }

    const payload = {
      nombre: clinicForm.nombre.trim(),
      tipo: clinicForm.tipo,
      direccion: clinicForm.direccion.trim(),
      rangos: rangosPayload,
    }

    try {
      if (clinicForm.id) {
        await medicosApi.updateMyClinica(clinicForm.id, payload)
      } else {
        await medicosApi.createMyClinica(payload)
      }
      await loadData()
      setShowClinicForm(false)
      setClinicForm(clinicFormFromRow())
      setEstadoCrud('Consultorio guardado correctamente.')
    } catch (err) {
      setEstadoCrud(err?.message || 'No se pudo guardar el consultorio.')
    }
  }

  async function deleteClinica(idClinica) {
    const ok = window.confirm('Se eliminara el consultorio y su disponibilidad activa. Continuar?')
    if (!ok) return

    try {
      await medicosApi.deleteMyClinica(idClinica)
      await loadData()
      setEstadoCrud('Consultorio eliminado.')
    } catch (err) {
      setEstadoCrud(err?.message || 'No se pudo eliminar el consultorio.')
    }
  }

  const consultorioNombreById = useMemo(
    () => Object.fromEntries(consultorios.map((c) => [String(c.id), c.nombre])),
    [consultorios]
  )

  function startEditBloqueo(b) {
    setBloqueoForm({
      id: b.id_excepcion,
      id_clinica: b.id_clinica,
      fecha_desde: b.fecha,
      fecha_hasta: b.fecha,
      motivo: b.motivo || '',
    })
    setEstadoCrud('')
  }

  function resetBloqueoForm() {
    setBloqueoForm(bloqueoFormBase(consultorios))
  }

  async function submitBloqueo(e) {
    e.preventDefault()
    if (!bloqueoForm.id_clinica || !bloqueoForm.fecha_desde || !bloqueoForm.fecha_hasta) {
      setEstadoCrud('Completa consultorio y rango de fechas para el bloqueo.')
      return
    }

    try {
      if (bloqueoForm.id) {
        await medicosApi.updateMyBloqueo(bloqueoForm.id, {
          id_clinica: Number(bloqueoForm.id_clinica),
          fecha: bloqueoForm.fecha_desde,
          motivo: bloqueoForm.motivo,
        })
      } else {
        await medicosApi.createMyBloqueo({
          id_clinica: Number(bloqueoForm.id_clinica),
          fecha_desde: bloqueoForm.fecha_desde,
          fecha_hasta: bloqueoForm.fecha_hasta,
          motivo: bloqueoForm.motivo,
        })
      }
      await loadData()
      resetBloqueoForm()
      setEstadoCrud('Bloqueo guardado correctamente.')
    } catch (err) {
      setEstadoCrud(err?.message || 'No se pudo guardar el bloqueo.')
    }
  }

  async function deleteBloqueo(idExcepcion) {
    try {
      await medicosApi.deleteMyBloqueo(idExcepcion)
      await loadData()
      setEstadoCrud('Bloqueo eliminado.')
    } catch (err) {
      setEstadoCrud(err?.message || 'No se pudo eliminar el bloqueo.')
    }
  }

  async function guardarTerminos() {
    const texto = terminos.trim() || TERMINOS_PREDETERMINADOS
    try {
      await medicosApi.saveMyTyc(texto)
      setTerminosEstado('Terminos guardados correctamente.')
      setTimeout(() => setTerminosEstado(''), 2000)
    } catch (err) {
      setTerminosEstado(err?.message || 'No se pudieron guardar los terminos.')
    }
  }

  function restaurarPredeterminados() {
    setTerminos(TERMINOS_PREDETERMINADOS)
  }

  return (
    <div className="config-tab">
      <section className="config-section surface-raised">
        <div className="config-section-header">
          <h3>Mis consultorios</h3>
          <Button variant="accent" size="sm" onClick={openNewClinica}>
            <Plus size={14} /> Agregar consultorio
          </Button>
        </div>
        <p className="config-section-sub">Alta, edicion y baja de consultorios del medico autenticado.</p>
        {consultorios.length === 0 && <p className="config-bloqueos-vacio">No hay consultorios cargados.</p>}
        {consultorios.map((c) => (
          <div key={c.id} className="config-consultorio-card">
            <div className="config-consultorio-info">
              <div>
                <strong>{c.nombre}</strong>
                <span className="badge badge-muted" style={{ marginLeft: 8 }}>{c.ciudad || 'Sin ciudad'}</span>
              </div>
              <p className="config-consultorio-horarios">{c.direccion || 'Sin direccion'}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="ghost" size="sm" onClick={() => openEditClinica(c)}><Edit2 size={13} /> Editar</Button>
              <Button variant="danger" size="sm" onClick={() => deleteClinica(c.id)}><Trash2 size={13} /> Eliminar</Button>
            </div>
          </div>
        ))}

        {showClinicForm && (
          <form className="surface" style={{ padding: '1rem', marginTop: '0.9rem' }} onSubmit={submitClinica}>
            <div className="auth-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="clinicaNombre">Nombre</label>
                <input id="clinicaNombre" className="form-input" value={clinicForm.nombre} onChange={(e) => setClinicForm((p) => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="clinicaTipo">Tipo</label>
                <select id="clinicaTipo" className="form-select" value={clinicForm.tipo} onChange={(e) => setClinicForm((p) => ({ ...p, tipo: e.target.value }))}>
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="clinicaDireccion">{clinicForm.tipo === 'virtual' ? 'Link' : 'Direccion'}</label>
              <input id="clinicaDireccion" className="form-input" value={clinicForm.direccion} onChange={(e) => setClinicForm((p) => ({ ...p, direccion: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modoAgenda">Modalidad de agenda</label>
              <select id="modoAgenda" className="form-select" value={clinicForm.modoAgenda} onChange={(e) => setClinicForm((p) => ({ ...p, modoAgenda: e.target.value }))}>
                <option value="recurrente">Recurrente</option>
                <option value="unica">Unica vez</option>
              </select>
            </div>

            {clinicForm.modoAgenda === 'recurrente' && (
              <>
                <div className="form-group">
                  <label className="form-label">Dias de atencion</label>
                  <div className="config-dias-row">
                    {DIAS.map((dia) => (
                      <button
                        key={dia}
                        type="button"
                        className={`config-dia-btn ${clinicForm.dias.includes(dia) ? 'active' : ''}`}
                        onClick={() => toggleDia(dia)}
                      >
                        {dia[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="auth-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="horaInicio">Inicio</label>
                    <SmartTimeInput id="horaInicio" name="horaInicio" value={clinicForm.inicio} onChange={(e) => setClinicForm((p) => ({ ...p, inicio: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="horaFin">Fin</label>
                    <SmartTimeInput id="horaFin" name="horaFin" value={clinicForm.fin} onChange={(e) => setClinicForm((p) => ({ ...p, fin: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {clinicForm.modoAgenda === 'unica' && (
              <div className="surface" style={{ padding: '0.75rem', marginBottom: '0.75rem' }}>
                <p className="form-label" style={{ marginBottom: '0.6rem' }}>Horarios de unica vez</p>
                <div className="auth-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="unicoFecha">Fecha</label>
                    <input id="unicoFecha" type="date" className="form-input" value={clinicForm.unicoFecha} onChange={(e) => setClinicForm((p) => ({ ...p, unicoFecha: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="unicoInicio">Inicio</label>
                    <SmartTimeInput id="unicoInicio" name="unicoInicio" value={clinicForm.unicoInicio} onChange={(e) => setClinicForm((p) => ({ ...p, unicoInicio: e.target.value }))} />
                  </div>
                </div>
                <div className="auth-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="unicoFin">Fin</label>
                    <SmartTimeInput id="unicoFin" name="unicoFin" value={clinicForm.unicoFin} onChange={(e) => setClinicForm((p) => ({ ...p, unicoFin: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'end' }}>
                    <Button type="button" variant="secondary" onClick={addRangoUnico}>
                      <Plus size={14} /> Agregar unica vez
                    </Button>
                  </div>
                </div>

                {clinicForm.rangosUnicos.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.4rem' }}>
                    {clinicForm.rangosUnicos.map((r, idx) => (
                      <div key={`${r.fecha}-${r.inicio}-${idx}`} className="surface" style={{ padding: '0.5rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.86rem' }}>{r.fecha} · {formatTime24h(r.inicio)} - {formatTime24h(r.fin)}</span>
                        <Button type="button" variant="danger" size="sm" onClick={() => removeRangoUnico(idx)}>
                          <Trash2 size={12} /> Quitar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setShowClinicForm(false)}>Cancelar</Button>
              <Button type="submit">Guardar consultorio</Button>
            </div>
          </form>
        )}
      </section>

      <section className="config-section surface-raised">
        <h3>Configuracion general de turnos</h3>
        <div className="config-grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="duracion">Duracion turno estandar</label>
            <select id="duracion" className="form-select" value={duracion} onChange={(e) => setDuracion(e.target.value)}>
              <option value="15">15 minutos</option>
              <option value="20">20 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">60 minutos</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="recordatorio">Recordatorio</label>
            <select id="recordatorio" className="form-select" value={recordatorio} onChange={(e) => setRecordatorio(e.target.value)}>
              <option value="10">10 minutos antes</option>
              <option value="30">30 minutos antes</option>
              <option value="60">1 hora antes</option>
              <option value="1440">1 dia antes</option>
            </select>
          </div>
        </div>
        <Button size="sm" disabled>Guardar configuracion</Button>
      </section>

      <section className="config-section surface-raised">
        <h3>Terminos y condiciones</h3>
        <p className="config-section-sub">Estos terminos se mostraran al paciente antes de solicitar receta o turno.</p>
        <div className="form-group">
          <label className="form-label" htmlFor="terminos">Texto de terminos</label>
          <textarea
            id="terminos"
            className="form-textarea"
            rows={6}
            value={terminos}
            onChange={(e) => setTerminos(e.target.value)}
            placeholder={TERMINOS_PREDETERMINADOS}
          />
        </div>
        <div className="config-terms-actions">
          <Button variant="ghost" size="sm" onClick={restaurarPredeterminados}>Usar predeterminados</Button>
          <Button size="sm" onClick={guardarTerminos}>Guardar terminos</Button>
        </div>
        {terminosEstado && <p className="config-terms-msg">{terminosEstado}</p>}
      </section>

      <section className="config-section surface-raised">
        <h3>Bloquear fechas / vacaciones</h3>
        <form onSubmit={submitBloqueo}>
          <div className="form-group">
            <label className="form-label" htmlFor="consultorioAfectado">Consultorio afectado</label>
            <select
              id="consultorioAfectado"
              className="form-select"
              value={bloqueoForm.id_clinica}
              onChange={(e) => setBloqueoForm((p) => ({ ...p, id_clinica: Number(e.target.value) }))}
            >
              <option value="">Seleccionar consultorio</option>
              {consultorios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="config-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="desde">Desde</label>
              <SmartDateInput id="desde" name="desde" value={bloqueoForm.fecha_desde} onChange={(e) => setBloqueoForm((p) => ({ ...p, fecha_desde: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="hasta">Hasta</label>
              <SmartDateInput id="hasta" name="hasta" value={bloqueoForm.fecha_hasta} onChange={(e) => setBloqueoForm((p) => ({ ...p, fecha_hasta: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="motivo">Motivo (opcional)</label>
            <input id="motivo" type="text" className="form-input" placeholder="Vacaciones, congreso..." value={bloqueoForm.motivo} onChange={(e) => setBloqueoForm((p) => ({ ...p, motivo: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" size="sm" type="submit">
              <Plus size={14} /> {bloqueoForm.id ? 'Actualizar bloqueo' : 'Agregar bloqueo'}
            </Button>
            {bloqueoForm.id && (
              <Button type="button" variant="ghost" size="sm" onClick={resetBloqueoForm}>Cancelar edicion</Button>
            )}
          </div>
        </form>

        {bloqueos.length === 0 && <p className="config-bloqueos-vacio">No hay bloqueos vigentes.</p>}
        {bloqueos.length > 0 && (
          <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
            {bloqueos.map((b) => (
              <div key={b.id_excepcion} className="surface" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <strong>{consultorioNombreById[String(b.id_clinica)] || b.clinica_nombre || `Consultorio ${b.id_clinica}`}</strong>
                  <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {b.fecha} · {b.motivo || 'Sin motivo'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <Button variant="ghost" size="sm" onClick={() => startEditBloqueo(b)}><Edit2 size={13} /> Editar</Button>
                  <Button variant="danger" size="sm" onClick={() => deleteBloqueo(b.id_excepcion)}><Trash2 size={13} /> Eliminar</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="config-section surface-raised">
        <h3>Gestion de asistentes</h3>
        <p className="config-section-sub">Permisos y estado gestionados en base de datos.</p>
        {asistentes.map((a) => (
          <div key={a.id} className="config-asistente-row">
            <div>
              <strong>{a.nombre}</strong>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Usuario: {a.usuario} · Estado:{' '}
                <span style={{ color: a.estado === 'activa' ? 'var(--success)' : 'var(--error)' }}>
                  {a.estado === 'activa' ? 'Activa' : 'Bloqueada'}
                </span>
              </p>
              <div className="config-asistente-permisos">
                <label>
                  <input type="checkbox" checked={Boolean(a.permisos?.agenda)} onChange={() => togglePermisoAsistente(a.id, 'agenda')} />
                  Agenda
                </label>
                <label>
                  <input type="checkbox" checked={Boolean(a.permisos?.pacientes)} onChange={() => togglePermisoAsistente(a.id, 'pacientes')} />
                  Pacientes
                </label>
              </div>
            </div>
            <Button variant={a.estado === 'activa' ? 'danger' : 'secondary'} size="sm" onClick={() => toggleAsistente(a.id)}>
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

      {estadoCrud && <p className="config-terms-msg">{estadoCrud}</p>}
    </div>
  )
}
