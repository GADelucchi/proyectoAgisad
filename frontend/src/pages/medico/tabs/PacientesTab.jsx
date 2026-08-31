import { useEffect, useState } from 'react'
import { Search, RefreshCw, CalendarPlus, UserPlus, History, Pencil } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../../context/AuthContext'
import { medicosApi } from '../../../services/medicos.api'
import { pacientesApi } from '../../../services/pacientes.api'
import { turnosApi } from '../../../services/turnos.api'
import { formatTime24h } from '../../../utils/dateFormat'
import './PacientesTab.css'

const RECETA_TIPO_LABEL = { urgente: 'Urgente', estandar: 'Estándar' }

const TURNO_ESTADO_LABEL = {
  pendiente: 'Pendiente', confirmado: 'Confirmado', en_curso: 'En curso',
  completado: 'Paciente asistió', ausente: 'Paciente no asistió',
  cancelado: 'Cancelado', cancelado_paciente: 'Cancelado por paciente',
  cancelado_clinica: 'Cancelado por el profesional', realizado: 'Paciente asistió',
}
const RECETA_ESTADO_LABEL = { enviada: 'Enviada', leida: 'Leída', resuelta: 'Resuelta', rechazada: 'Rechazada' }
const MENSAJE_ESTADO_LABEL = { enviada: 'Enviado', leida: 'Leído', respondida: 'Respondido', cerrada: 'Cerrado' }

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function nombreCompleto(paciente) {
  return `${paciente?.apellido || ''} ${paciente?.nombre || ''}`.trim() || 'Paciente'
}

const FORM_ALTA_VACIO = {
  dni: '',
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  fecha_nac: '',
  id_obra_social: '',
  obra_social: '',
  nro_obra_social: '',
}

const OBRA_SOCIAL_OTRA = '__otra'

export default function PacientesTab() {
  const { usuario } = useAuth()
  const [query, setQuery] = useState('')
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(false)
  const isMedico = usuario?.rol === 'medico'

  const [agendarPara, setAgendarPara] = useState(null)
  const [clinicas, setClinicas] = useState([])
  const [duracionEstandar, setDuracionEstandar] = useState(30)
  const [formTurno, setFormTurno] = useState({ id_clinica: '', fecha: toIsoDate(new Date()), hora: '', motivo: '' })
  const [slots, setSlots] = useState([])
  const [cargandoSlots, setCargandoSlots] = useState(false)
  const [guardandoTurno, setGuardandoTurno] = useState(false)
  const [mensajeTurno, setMensajeTurno] = useState('')

  const [mostrarAlta, setMostrarAlta] = useState(false)
  const [formAlta, setFormAlta] = useState(FORM_ALTA_VACIO)
  const [obrasSociales, setObrasSociales] = useState([])
  const [guardandoAlta, setGuardandoAlta] = useState(false)
  const [mensajeAlta, setMensajeAlta] = useState('')
  const [buscandoDni, setBuscandoDni] = useState(false)
  const [pacienteExistente, setPacienteExistente] = useState(false)

  const [editarPara, setEditarPara] = useState(null)
  const [formEditar, setFormEditar] = useState({ telefono: '', fecha_nac: '', id_obra_social: '', nro_obra_social: '' })
  const [guardandoEditar, setGuardandoEditar] = useState(false)
  const [mensajeEditar, setMensajeEditar] = useState('')

  const [historialPara, setHistorialPara] = useState(null)
  const [historial, setHistorial] = useState(null)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  async function load() {
    if (!isMedico) return
    setLoading(true)
    try {
      const rows = await pacientesApi.list()
      setPacientes(Array.isArray(rows) ? rows : [])
    } catch {
      setPacientes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [isMedico, usuario?.idUsuario])

  useEffect(() => {
    if (!isMedico) return

    let cancelled = false
    Promise.all([
      medicosApi.listMyClinicas().catch(() => []),
      medicosApi.getMyTurnosConfig().catch(() => null),
      pacientesApi.listarObrasSociales().catch(() => []),
    ]).then(([clinicasRows, config, obrasRows]) => {
      if (cancelled) return
      setClinicas(Array.isArray(clinicasRows) ? clinicasRows : [])
      setObrasSociales(Array.isArray(obrasRows) ? obrasRows : [])
      const valor = Number(config?.duracion_turno_estandar)
      if (Number.isFinite(valor) && valor > 0) setDuracionEstandar(valor)
    })

    return () => {
      cancelled = true
    }
  }, [isMedico])

  useEffect(() => {
    if (!agendarPara || !formTurno.id_clinica || !formTurno.fecha) return undefined

    let cancelled = false
    setCargandoSlots(true)
    medicosApi.getMyDisponibilidad({ idClinica: formTurno.id_clinica, fecha: formTurno.fecha })
      .then((data) => {
        if (!cancelled) setSlots(Array.isArray(data?.slots) ? data.slots.filter((s) => s.libre) : [])
      })
      .catch(() => {
        if (!cancelled) setSlots([])
      })
      .finally(() => {
        if (!cancelled) setCargandoSlots(false)
      })

    return () => {
      cancelled = true
    }
  }, [agendarPara, formTurno.id_clinica, formTurno.fecha])

  function abrirAgendar(paciente) {
    setMensajeTurno('')
    setMostrarAlta(false)
    setEditarPara(null)
    setHistorialPara(null)
    setAgendarPara(paciente)
    setSlots([])
    setFormTurno({
      id_clinica: clinicas.length === 1 ? String(clinicas[0].id) : '',
      fecha: toIsoDate(new Date()),
      hora: '',
      motivo: '',
    })
  }

  function abrirAlta() {
    setMensajeAlta('')
    setFormAlta(FORM_ALTA_VACIO)
    setPacienteExistente(false)
    setAgendarPara(null)
    setEditarPara(null)
    setHistorialPara(null)
    setMostrarAlta(true)
  }

  async function buscarPorDni() {
    const dni = formAlta.dni.trim()
    if (!/^\d{7,8}$/.test(dni)) { setPacienteExistente(false); return }

    setBuscandoDni(true)
    try {
      const encontrado = await pacientesApi.buscarPorDni(dni)
      setPacienteExistente(true)
      setFormAlta((prev) => ({
        ...prev,
        nombre: encontrado.nombre || '',
        apellido: encontrado.apellido || '',
        email: (encontrado.email || '').includes('@sin-email.local') ? '' : (encontrado.email || ''),
        telefono: encontrado.telefono || '',
        fecha_nac: encontrado.fecha_nac_iso || '',
        id_obra_social: encontrado.id_obra_social ? String(encontrado.id_obra_social) : '',
        nro_obra_social: encontrado.nro_obra_social || '',
      }))
    } catch {
      // No existe (404) o falló la búsqueda: el médico completa los datos a mano.
      setPacienteExistente(false)
    } finally {
      setBuscandoDni(false)
    }
  }

  function abrirEditar(paciente) {
    setMensajeEditar('')
    setMostrarAlta(false)
    setAgendarPara(null)
    setHistorialPara(null)
    setEditarPara(paciente)
    setFormEditar({
      telefono: paciente.telefono || '',
      fecha_nac: paciente.fecha_nac_iso || '',
      id_obra_social: paciente.id_obra_social ? String(paciente.id_obra_social) : '',
      nro_obra_social: paciente.nro_obra_social || '',
    })
  }

  async function guardarEdicion(event) {
    event.preventDefault()
    if (!editarPara) return

    setGuardandoEditar(true)
    setMensajeEditar('')
    try {
      await pacientesApi.actualizar(editarPara.id_paciente, {
        telefono: formEditar.telefono.trim() || null,
        fecha_nac: formEditar.fecha_nac || null,
        id_obra_social: formEditar.id_obra_social || null,
        nro_obra_social: formEditar.nro_obra_social.trim() || null,
      })
      setEditarPara(null)
      setMensajeAlta(`${nombreCompleto(editarPara)} se actualizó correctamente.`)
      await load()
    } catch (err) {
      setMensajeEditar(err?.message || 'No se pudieron guardar los cambios.')
    } finally {
      setGuardandoEditar(false)
    }
  }

  async function abrirHistorial(paciente) {
    setMostrarAlta(false)
    setAgendarPara(null)
    setEditarPara(null)
    setHistorialPara(paciente)
    setHistorial(null)
    setCargandoHistorial(true)
    try {
      const data = await pacientesApi.getHistorial(paciente.id_paciente)
      setHistorial(data)
    } catch {
      setHistorial({ turnos: [], recetas: [], mensajes: [] })
    } finally {
      setCargandoHistorial(false)
    }
  }

  async function guardarPaciente(event) {
    event.preventDefault()
    const otraObraSocial = formAlta.id_obra_social === OBRA_SOCIAL_OTRA

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
        id_obra_social: otraObraSocial ? null : formAlta.id_obra_social || null,
        obra_social: otraObraSocial ? formAlta.obra_social.trim() : null,
        nro_obra_social: formAlta.nro_obra_social.trim() || null,
      })
      setMostrarAlta(false)
      setFormAlta(FORM_ALTA_VACIO)
      setPacienteExistente(false)
      setMensajeAlta(
        creado?.ya_existia
          ? `${nombreCompleto(creado)} ya estaba registrado en el sistema y se agregó a tu listado.`
          : `${nombreCompleto(creado)} se agregó a tu listado.`
      )
      await Promise.all([
        load(),
        otraObraSocial
          ? pacientesApi.listarObrasSociales()
            .then((rows) => setObrasSociales(Array.isArray(rows) ? rows : []))
            .catch(() => {})
          : null,
      ])
    } catch (err) {
      setMensajeAlta(err?.message || 'No se pudo agregar el paciente.')
    } finally {
      setGuardandoAlta(false)
    }
  }

  async function confirmarTurno(event) {
    event.preventDefault()
    if (!agendarPara || !formTurno.id_clinica || !formTurno.hora) return

    setGuardandoTurno(true)
    setMensajeTurno('')
    try {
      await turnosApi.crear({
        id_paciente: agendarPara.id_paciente,
        id_clinica: Number(formTurno.id_clinica),
        fecha: formTurno.fecha,
        hora: formTurno.hora,
        duracion_minutos: duracionEstandar,
        motivo_consulta: formTurno.motivo || null,
      })
      setMensajeTurno(`Turno agendado para ${nombreCompleto(agendarPara)}.`)
      setAgendarPara(null)
    } catch (err) {
      setMensajeTurno(err?.message || 'No se pudo agendar el turno.')
    } finally {
      setGuardandoTurno(false)
    }
  }

  const filtrados = pacientes.filter((p) => {
    const texto = `${nombreCompleto(p)} ${p.dni || ''}`.toLowerCase()
    return texto.includes(query.toLowerCase())
  })

  return (
    <div className="pacientes-tab">
      <div className="pacientes-header">
        <div>
          <h3>Base de pacientes</h3>
          <p>Pacientes con turnos registrados y los que agregaste manualmente.</p>
        </div>
        <div className="pacientes-header-acciones">
          <Button size="sm" onClick={abrirAlta}>
            <UserPlus size={14} /> Nuevo paciente
          </Button>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> {loading ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </div>

      <div className="pacientes-search surface-raised">
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          className="buscador-input"
          placeholder="Buscar por nombre o DNI..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {mostrarAlta && (
        <form className="paciente-alta-form surface-raised" onSubmit={guardarPaciente}>
          <h4>Nuevo paciente</h4>

          <div className="paciente-agendar-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="alta-dni">DNI</label>
              <input
                id="alta-dni"
                className="form-input"
                inputMode="numeric"
                value={formAlta.dni}
                onChange={(e) => {
                  setFormAlta({ ...formAlta, dni: e.target.value })
                  if (pacienteExistente) setPacienteExistente(false)
                }}
                onBlur={buscarPorDni}
                required
              />
              {buscandoDni && <small className="auth-help">Buscando...</small>}
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="alta-apellido">Apellido</label>
              <input
                id="alta-apellido"
                className="form-input"
                value={formAlta.apellido}
                onChange={(e) => setFormAlta({ ...formAlta, apellido: e.target.value })}
                readOnly={pacienteExistente}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="alta-nombre">Nombre</label>
              <input
                id="alta-nombre"
                className="form-input"
                value={formAlta.nombre}
                onChange={(e) => setFormAlta({ ...formAlta, nombre: e.target.value })}
                readOnly={pacienteExistente}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="alta-email">Email (opcional)</label>
              <input
                id="alta-email"
                type="email"
                className="form-input"
                value={formAlta.email}
                onChange={(e) => setFormAlta({ ...formAlta, email: e.target.value })}
                readOnly={pacienteExistente}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="alta-telefono">Teléfono (opcional)</label>
              <input
                id="alta-telefono"
                className="form-input"
                value={formAlta.telefono}
                onChange={(e) => setFormAlta({ ...formAlta, telefono: e.target.value })}
                readOnly={pacienteExistente}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="alta-nacimiento">Fecha de nacimiento (opcional)</label>
              <input
                id="alta-nacimiento"
                type="date"
                className="form-input"
                max={toIsoDate(new Date())}
                value={formAlta.fecha_nac}
                onChange={(e) => setFormAlta({ ...formAlta, fecha_nac: e.target.value })}
                readOnly={pacienteExistente}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="alta-obra-social">Obra social</label>
              <select
                id="alta-obra-social"
                className="form-select"
                value={formAlta.id_obra_social}
                onChange={(e) => setFormAlta({
                  ...formAlta,
                  id_obra_social: e.target.value,
                  obra_social: '',
                  nro_obra_social: e.target.value ? formAlta.nro_obra_social : '',
                })}
                disabled={pacienteExistente}
              >
                <option value="">Particular / Sin cobertura</option>
                {obrasSociales.map((os) => (
                  <option key={os.id_obra_social} value={String(os.id_obra_social)}>{os.nombre}</option>
                ))}
                <option value={OBRA_SOCIAL_OTRA}>Otra (escribirla)</option>
              </select>
            </div>

            {formAlta.id_obra_social === OBRA_SOCIAL_OTRA && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="alta-obra-social-nombre">Nombre de la obra social</label>
                <input
                  id="alta-obra-social-nombre"
                  className="form-input"
                  maxLength={120}
                  placeholder="Se agrega a la lista para el próximo paciente"
                  value={formAlta.obra_social}
                  onChange={(e) => setFormAlta({ ...formAlta, obra_social: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="alta-afiliado">N° de afiliado</label>
              <input
                id="alta-afiliado"
                className="form-input"
                value={formAlta.nro_obra_social}
                disabled={!formAlta.id_obra_social}
                onChange={(e) => setFormAlta({ ...formAlta, nro_obra_social: e.target.value })}
                readOnly={pacienteExistente}
              />
            </div>
          </div>

          {pacienteExistente ? (
            <p className="paciente-help">
              Este DNI ya está registrado en el sistema — se muestran sus datos y solo se va a vincular a tu listado, no se pueden editar acá.
            </p>
          ) : (
            <p className="paciente-help">
              Si cargás el email, el paciente puede activar su cuenta desde &quot;Olvidé mi contraseña&quot; y ver sus turnos.
              Si al salir del campo DNI detectamos que ya está registrado, autocompletamos el resto.
            </p>
          )}

          <div className="paciente-alta-actions">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMostrarAlta(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={guardandoAlta}>
              {guardandoAlta ? 'Guardando...' : 'Guardar paciente'}
            </Button>
          </div>
        </form>
      )}

      {mensajeAlta && <p className="paciente-turno-msg">{mensajeAlta}</p>}

      {agendarPara && (
        <form className="paciente-agendar surface-raised" onSubmit={confirmarTurno}>
          <h4>{`Nuevo turno para ${nombreCompleto(agendarPara)}`}</h4>

          <div className="paciente-agendar-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="turno-clinica">Consultorio</label>
              <select
                id="turno-clinica"
                className="form-select"
                value={formTurno.id_clinica}
                onChange={(e) => {
                  setSlots([])
                  setFormTurno({ ...formTurno, id_clinica: e.target.value, hora: '' })
                }}
                required
              >
                <option value="">Elegí un consultorio...</option>
                {clinicas.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="turno-fecha">Fecha</label>
              <input
                id="turno-fecha"
                type="date"
                className="form-input"
                value={formTurno.fecha}
                min={toIsoDate(new Date())}
                onChange={(e) => {
                  setSlots([])
                  setFormTurno({ ...formTurno, fecha: e.target.value, hora: '' })
                }}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="turno-hora">Horario</label>
              <select
                id="turno-hora"
                className="form-select"
                value={formTurno.hora}
                onChange={(e) => setFormTurno({ ...formTurno, hora: e.target.value })}
                disabled={cargandoSlots || slots.length === 0}
                required
              >
                <option value="">
                  {cargandoSlots
                    ? 'Buscando horarios...'
                    : slots.length === 0 ? 'Sin horarios disponibles' : 'Elegí un horario...'}
                </option>
                {slots.map((s) => (
                  <option key={s.hora} value={s.hora}>{formatTime24h(s.hora)}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="turno-motivo">Motivo (opcional)</label>
              <input
                id="turno-motivo"
                className="form-input"
                value={formTurno.motivo}
                onChange={(e) => setFormTurno({ ...formTurno, motivo: e.target.value })}
              />
            </div>
          </div>

          <p className="paciente-help">
            Solo se ofrecen horarios libres de tu agenda, contemplando turnos en otros consultorios y bloqueos.
          </p>

          <div className="paciente-alta-actions">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAgendarPara(null)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={guardandoTurno || !formTurno.hora}>
              {guardandoTurno ? 'Agendando...' : 'Confirmar turno'}
            </Button>
          </div>
        </form>
      )}

      {mensajeTurno && <p className="paciente-turno-msg">{mensajeTurno}</p>}

      {editarPara && (
        <form className="paciente-agendar surface-raised" onSubmit={guardarEdicion}>
          <h4>{`Editar ${nombreCompleto(editarPara)}`}</h4>

          <div className="paciente-agendar-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="editar-telefono">Teléfono</label>
              <input
                id="editar-telefono"
                className="form-input"
                value={formEditar.telefono}
                onChange={(e) => setFormEditar({ ...formEditar, telefono: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="editar-nacimiento">Fecha de nacimiento</label>
              <input
                id="editar-nacimiento"
                type="date"
                className="form-input"
                max={toIsoDate(new Date())}
                value={formEditar.fecha_nac}
                onChange={(e) => setFormEditar({ ...formEditar, fecha_nac: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="editar-obra-social">Obra social</label>
              <select
                id="editar-obra-social"
                className="form-select"
                value={formEditar.id_obra_social}
                onChange={(e) => setFormEditar({ ...formEditar, id_obra_social: e.target.value })}
              >
                <option value="">Particular / Sin cobertura</option>
                {obrasSociales.map((os) => (
                  <option key={os.id_obra_social} value={String(os.id_obra_social)}>{os.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="editar-afiliado">N° de afiliado</label>
              <input
                id="editar-afiliado"
                className="form-input"
                value={formEditar.nro_obra_social}
                disabled={!formEditar.id_obra_social}
                onChange={(e) => setFormEditar({ ...formEditar, nro_obra_social: e.target.value })}
              />
            </div>
          </div>

          {mensajeEditar && <p className="paciente-turno-msg">{mensajeEditar}</p>}

          <div className="paciente-alta-actions">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditarPara(null)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={guardandoEditar}>
              {guardandoEditar ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      )}

      {historialPara && (
        <div className="paciente-agendar surface-raised">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>{`Historial de ${nombreCompleto(historialPara)}`}</h4>
            <Button variant="ghost" size="sm" type="button" onClick={() => setHistorialPara(null)}>Cerrar</Button>
          </div>

          {cargandoHistorial ? (
            <p className="paciente-help">Cargando...</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', marginTop: '0.75rem' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Turnos</p>
                {historial?.turnos?.length ? (
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    {historial.turnos.map((t) => (
                      <div key={t.id_turno} className="surface" style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}>
                        {t.fecha_iso} {t.hora} · {t.clinica_nombre} · {TURNO_ESTADO_LABEL[t.estado] || t.estado}
                        {t.motivo && <> · {t.motivo}</>}
                      </div>
                    ))}
                  </div>
                ) : <p className="paciente-help">Sin turnos registrados.</p>}
              </div>

              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Recetas solicitadas</p>
                {historial?.recetas?.length ? (
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    {historial.recetas.map((r) => {
                      let items
                      try { items = JSON.parse(r.items_json) } catch { items = [] }
                      return (
                        <div key={r.id_solicitud} className="surface" style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}>
                          {new Date(r.creado_en).toLocaleDateString('es-AR')} · {RECETA_TIPO_LABEL[r.tipo] || r.tipo} · {RECETA_ESTADO_LABEL[r.estado] || r.estado}
                          <br />
                          {items.map((it, idx) => (
                            <span key={idx}>{idx > 0 && ', '}{it.medicamento}{it.dosis ? ` (${it.dosis})` : ''}</span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ) : <p className="paciente-help">Sin recetas solicitadas.</p>}
              </div>

              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Mensajes</p>
                {historial?.mensajes?.length ? (
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    {historial.mensajes.map((m) => (
                      <div key={m.id_solicitud} className="surface" style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}>
                        {new Date(m.creado_en).toLocaleDateString('es-AR')} · {m.asunto} · {MENSAJE_ESTADO_LABEL[m.estado] || m.estado}
                        <br />
                        {m.mensaje}
                      </div>
                    ))}
                  </div>
                ) : <p className="paciente-help">Sin mensajes.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="surface-raised">
        <p style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          Mostrando {filtrados.length} de {pacientes.length} pacientes
        </p>
        <div className="pacientes-tabla-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Telefono</th>
                <th>Obra social</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id_paciente}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nombreCompleto(p)}</td>
                  <td>{p.dni || '-'}</td>
                  <td>{p.telefono || '-'}</td>
                  <td>{p.obra_social || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Button variant="secondary" size="sm" onClick={() => abrirAgendar(p)}>
                        <CalendarPlus size={14} /> Agendar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => abrirHistorial(p)}>
                        <History size={14} /> Historial
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)}>
                        <Pencil size={14} /> Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length === 0 && !loading && (
          <p style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            No hay pacientes para mostrar.
          </p>
        )}
      </div>
    </div>
  )
}
