import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, User, CalendarDays, Pill, MessageSquare } from 'lucide-react'
import Button from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { pacientesApi } from '../../services/pacientes.api'
import { turnosApi } from '../../services/turnos.api'
import { formatDateDdMmYyyy, formatTime24h } from '../../utils/dateFormat'
import './PanelPacientePage.css'

const TABS = [
  { id: 'datos', label: 'Mis datos', icon: User },
  { id: 'turnos', label: 'Mis turnos', icon: CalendarDays },
  { id: 'recetas', label: 'Mis recetas', icon: Pill },
  { id: 'mensajes', label: 'Mis mensajes', icon: MessageSquare },
]

const ESTADOS_ACTIVOS = ['pendiente', 'confirmado', 'en_curso']

const ESTADO_TURNO_LABEL = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_curso: 'En curso',
  completado: 'Completado',
  realizado: 'Completado',
  ausente: 'Ausente',
  cancelado: 'Cancelado',
  cancelado_paciente: 'Cancelado por vos',
  cancelado_clinica: 'Cancelado por el consultorio',
}

const ESTADO_SOLICITUD_LABEL = {
  enviada: 'Enviada',
  leida: 'Leída',
  resuelta: 'Resuelta',
  rechazada: 'Rechazada',
  respondida: 'Respondida',
  cerrada: 'Cerrada',
}

function badgeClass(estado) {
  if (['confirmado', 'completado', 'realizado', 'resuelta', 'respondida'].includes(estado)) return 'badge-success'
  if (['cancelado', 'cancelado_paciente', 'cancelado_clinica', 'rechazada', 'ausente'].includes(estado)) return 'badge-error'
  if (['pendiente', 'enviada'].includes(estado)) return 'badge-warning'
  return 'badge-muted'
}

function formatFechaHora(iso) {
  if (!iso) return ''
  const fecha = formatDateDdMmYyyy(String(iso).slice(0, 10))
  const hora = String(iso).slice(11, 16)
  return hora ? `${fecha} · ${hora}` : fecha
}

export default function PanelPacientePage() {
  const navigate = useNavigate()
  const { usuario } = useAuth()

  const [tab, setTab] = useState('datos')
  const [perfil, setPerfil] = useState(null)
  const [obrasSociales, setObrasSociales] = useState([])
  const [turnos, setTurnos] = useState([])
  const [recetas, setRecetas] = useState([])
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    telefono: '',
    fecha_nac: '',
    id_obra_social: '',
    nro_obra_social: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [okPerfil, setOkPerfil] = useState('')
  const [errorPerfil, setErrorPerfil] = useState('')
  const [cancelandoId, setCancelandoId] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const [perfilRow, obrasRows, turnosRows, recetasRows, mensajesRows] = await Promise.all([
          pacientesApi.getMiPerfil(),
          pacientesApi.listarObrasSociales(),
          turnosApi.listarMisTurnos(),
          pacientesApi.listarMisRecetas(),
          pacientesApi.listarMisMensajes(),
        ])

        if (cancelled) return

        setPerfil(perfilRow)
        setObrasSociales(Array.isArray(obrasRows) ? obrasRows : [])
        setForm({
          telefono: perfilRow?.telefono || '',
          fecha_nac: perfilRow?.fecha_nac_iso || '',
          id_obra_social: perfilRow?.id_obra_social ? String(perfilRow.id_obra_social) : '',
          nro_obra_social: perfilRow?.nro_obra_social || '',
        })
        setTurnos(Array.isArray(turnosRows) ? turnosRows : [])
        setRecetas(Array.isArray(recetasRows) ? recetasRows : [])
        setMensajes(Array.isArray(mensajesRows) ? mensajesRows : [])
      } catch (err) {
        if (!cancelled) setError(err?.message || 'No se pudo cargar tu panel.')
      } finally {
        if (!cancelled) setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelled = true
    }
  }, [])

  const { proximos, pasados } = useMemo(() => {
    const activos = turnos.filter((t) => ESTADOS_ACTIVOS.includes(t.status))
    const resto = turnos.filter((t) => !ESTADOS_ACTIVOS.includes(t.status))
    return {
      proximos: activos,
      pasados: [...resto].reverse(),
    }
  }, [turnos])

  async function guardarPerfil(event) {
    event.preventDefault()
    setOkPerfil('')
    setErrorPerfil('')
    setGuardando(true)
    try {
      const actualizado = await pacientesApi.actualizarMiPerfil({
        telefono: form.telefono || null,
        fecha_nac: form.fecha_nac || null,
        id_obra_social: form.id_obra_social ? Number(form.id_obra_social) : null,
        nro_obra_social: form.nro_obra_social || null,
      })
      setPerfil(actualizado)
      setForm({
        telefono: actualizado?.telefono || '',
        fecha_nac: actualizado?.fecha_nac_iso || '',
        id_obra_social: actualizado?.id_obra_social ? String(actualizado.id_obra_social) : '',
        nro_obra_social: actualizado?.nro_obra_social || '',
      })
      setOkPerfil('Datos actualizados.')
    } catch (err) {
      setErrorPerfil(err?.message || 'No se pudieron guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  async function cancelarTurno(turno) {
    setError('')
    setCancelandoId(turno.id)
    try {
      await turnosApi.cancelarPropio(turno.id, '')
      const rows = await turnosApi.listarMisTurnos()
      setTurnos(Array.isArray(rows) ? rows : [])
    } catch (err) {
      setError(err?.message || 'No se pudo cancelar el turno.')
    } finally {
      setCancelandoId(null)
    }
  }

  return (
    <div className="panel-paciente">
      <button className="panel-paciente-volver" onClick={() => navigate('/paciente')}>
        <ChevronLeft size={16} /> Volver a buscar médico
      </button>

      <header className="panel-paciente-header">
        <h1>Mi panel</h1>
        <p>
          {perfil ? `${perfil.nombre} ${perfil.apellido}` : usuario?.nombre} · {perfil?.email || usuario?.email}
        </p>
      </header>

      <nav className="panel-paciente-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`panel-paciente-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      {error && <p className="auth-error">{error}</p>}
      {cargando && <p className="panel-paciente-loading">Cargando tu información...</p>}

      {!cargando && tab === 'datos' && (
        <form className="panel-paciente-card surface-raised" onSubmit={guardarPerfil}>
          <h2>Datos personales</h2>

          <div className="panel-paciente-grid">
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-input" value={perfil?.nombre || ''} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido</label>
              <input className="form-input" value={perfil?.apellido || ''} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">DNI</label>
              <input className="form-input" value={perfil?.dni || ''} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={perfil?.email || ''} disabled />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                className="form-input"
                value={form.telefono}
                placeholder="Ej: 2611234567"
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="fecha_nac">Fecha de nacimiento</label>
              <input
                id="fecha_nac"
                type="date"
                className="form-input"
                value={form.fecha_nac}
                onChange={(e) => setForm({ ...form, fecha_nac: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="id_obra_social">Obra social</label>
              <select
                id="id_obra_social"
                className="form-select"
                value={form.id_obra_social}
                onChange={(e) =>
                  setForm({
                    ...form,
                    id_obra_social: e.target.value,
                    nro_obra_social: e.target.value ? form.nro_obra_social : '',
                  })
                }
              >
                <option value="">Particular / Sin cobertura</option>
                {obrasSociales.map((os) => (
                  <option key={os.id_obra_social} value={String(os.id_obra_social)}>
                    {os.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="nro_obra_social">Número de afiliado</label>
              <input
                id="nro_obra_social"
                className="form-input"
                value={form.nro_obra_social}
                disabled={!form.id_obra_social}
                placeholder={form.id_obra_social ? '' : 'Elegí una obra social primero'}
                onChange={(e) => setForm({ ...form, nro_obra_social: e.target.value })}
              />
            </div>
          </div>

          <p className="panel-paciente-nota">
            Nombre, apellido, DNI y email no se pueden modificar desde acá. Escribinos si necesitás corregirlos.
          </p>

          {errorPerfil && <p className="auth-error">{errorPerfil}</p>}
          {okPerfil && <p className="panel-paciente-ok">{okPerfil}</p>}

          <div>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      )}

      {!cargando && tab === 'turnos' && (
        <section className="panel-paciente-seccion">
          <div className="panel-paciente-card surface-raised">
            <h2>Turnos pendientes</h2>
            {proximos.length === 0 ? (
              <p className="panel-paciente-empty">No tenés turnos pendientes.</p>
            ) : (
              <ul className="panel-paciente-lista">
                {proximos.map((turno) => (
                  <li key={turno.id} className="panel-paciente-item">
                    <div>
                      <strong>{formatDateDdMmYyyy(turno.dateIso)} · {formatTime24h(turno.time)}</strong>
                      <p>{turno.doctorName} · {turno.clinicName}</p>
                      {turno.type && <p className="panel-paciente-item-extra">{turno.type}</p>}
                    </div>
                    <div className="panel-paciente-item-acciones">
                      <span className={`badge ${badgeClass(turno.status)}`}>
                        {ESTADO_TURNO_LABEL[turno.status] || turno.status}
                      </span>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={cancelandoId === turno.id}
                        onClick={() => cancelarTurno(turno)}
                      >
                        {cancelandoId === turno.id ? 'Cancelando...' : 'Cancelar'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel-paciente-card surface-raised">
            <h2>Historial de turnos</h2>
            {pasados.length === 0 ? (
              <p className="panel-paciente-empty">Todavía no tenés turnos en tu historial.</p>
            ) : (
              <ul className="panel-paciente-lista">
                {pasados.map((turno) => (
                  <li key={turno.id} className="panel-paciente-item">
                    <div>
                      <strong>{formatDateDdMmYyyy(turno.dateIso)} · {formatTime24h(turno.time)}</strong>
                      <p>{turno.doctorName} · {turno.clinicName}</p>
                    </div>
                    <span className={`badge ${badgeClass(turno.status)}`}>
                      {ESTADO_TURNO_LABEL[turno.status] || turno.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {!cargando && tab === 'recetas' && (
        <div className="panel-paciente-card surface-raised">
          <h2>Solicitudes de receta</h2>
          {recetas.length === 0 ? (
            <p className="panel-paciente-empty">Todavía no solicitaste recetas.</p>
          ) : (
            <ul className="panel-paciente-lista">
              {recetas.map((receta) => (
                <li key={receta.id_solicitud} className="panel-paciente-item panel-paciente-item-col">
                  <div className="panel-paciente-item-head">
                    <div>
                      <strong>
                        Dr/a. {receta.medico_nombre} {receta.medico_apellido}
                      </strong>
                      <p>{formatFechaHora(receta.creado_en)}</p>
                    </div>
                    <div className="panel-paciente-item-acciones">
                      {receta.tipo === 'urgente' && <span className="badge badge-warning">Urgente</span>}
                      <span className={`badge ${badgeClass(receta.estado)}`}>
                        {ESTADO_SOLICITUD_LABEL[receta.estado] || receta.estado}
                      </span>
                    </div>
                  </div>
                  <ul className="panel-paciente-medicamentos">
                    {(receta.items || []).map((item, idx) => (
                      <li key={idx}>
                        {item.medicamento}
                        {item.dosis ? ` · ${item.dosis}` : ''}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!cargando && tab === 'mensajes' && (
        <div className="panel-paciente-card surface-raised">
          <h2>Mensajes enviados</h2>
          {mensajes.length === 0 ? (
            <p className="panel-paciente-empty">Todavía no enviaste mensajes.</p>
          ) : (
            <ul className="panel-paciente-lista">
              {mensajes.map((mensaje) => (
                <li key={mensaje.id_solicitud} className="panel-paciente-item panel-paciente-item-col">
                  <div className="panel-paciente-item-head">
                    <div>
                      <strong>{mensaje.asunto}</strong>
                      <p>
                        Dr/a. {mensaje.medico_nombre} {mensaje.medico_apellido} · {formatFechaHora(mensaje.creado_en)}
                      </p>
                    </div>
                    <span className={`badge ${badgeClass(mensaje.estado)}`}>
                      {ESTADO_SOLICITUD_LABEL[mensaje.estado] || mensaje.estado}
                    </span>
                  </div>
                  <p className="panel-paciente-mensaje">{mensaje.mensaje}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
