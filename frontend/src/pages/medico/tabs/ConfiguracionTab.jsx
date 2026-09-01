import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../../context/AuthContext'
import AltaAsistenteForm from '../../../components/forms/AltaAsistenteForm'
import { authApi } from '../../../services/auth.api'
import { medicosApi } from '../../../services/medicos.api'
import { consultoriosApi } from '../../../services/consultorios.api'
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

function turnoTipoFormBase() {
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id_tipo_turno: null,
    nombre: '',
    duracion_minutos: '30',
    notificar_nuevo: false,
  }
}

function mapTipoTurno(row, index) {
  return {
    id: row?.id_tipo_turno || `tipo-${index}`,
    id_tipo_turno: row?.id_tipo_turno || null,
    nombre: row?.nombre || '',
    duracion_minutos: String(row?.duracion_minutos || 30),
    notificar_nuevo: Boolean(row?.notificar_nuevo),
  }
}

export default function ConfiguracionTab({ permiteTurnos = true, onConfigChange }) {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const doctorId = String(usuario?.idUsuario || usuario?.id || '')
  const permiteAsistentes = Boolean(usuario?.membresia?.permite_asistentes)
  const puedePublicar = Boolean(usuario?.membresia?.permite_publicar_consultorio)
  const planNombre = usuario?.membresia?.plan_nombre || usuario?.membresia?.plan_codigo || 'Sin plan'

  const [consultorios, setConsultorios] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [asistentes, setAsistentes] = useState([])
  const [duracion, setDuracion] = useState('30')
  const [tiposTurno, setTiposTurno] = useState([turnoTipoFormBase()])
  const [estadoTurnos, setEstadoTurnos] = useState('')
  const [turnosEnConflicto, setTurnosEnConflicto] = useState([])
  const [terminos, setTerminos] = useState('')
  const [terminosEstado, setTerminosEstado] = useState('')
  const [estadoCrud, setEstadoCrud] = useState('')
  const [guardandoClinica, setGuardandoClinica] = useState(false)
  const [enviarRecetasMail, setEnviarRecetasMail] = useState(true)
  const [notifTurnoNuevo, setNotifTurnoNuevo] = useState(true)
  const [notifCancelacion, setNotifCancelacion] = useState(true)
  const [estadoMailConfig, setEstadoMailConfig] = useState('')

  const [publicados, setPublicados] = useState({})
  const [showClinicForm, setShowClinicForm] = useState(false)
  const [clinicForm, setClinicForm] = useState(clinicFormFromRow())

  const [bloqueoForm, setBloqueoForm] = useState(bloqueoFormBase([]))

  async function loadData() {
    if (!doctorId) return

    const [clinicasRows, bloqueosRows, asistentesRows, tyc, turnosConfig] = await Promise.all([
      permiteTurnos ? medicosApi.listMyClinicas() : Promise.resolve([]),
      permiteTurnos ? medicosApi.listMyBloqueos() : Promise.resolve([]),
      permiteAsistentes ? asistentesApi.listByMedico(doctorId).catch(() => []) : Promise.resolve([]),
      medicosApi.getMyTyc().catch(() => null),
      permiteTurnos ? medicosApi.getMyTurnosConfig().catch(() => null) : Promise.resolve(null),
    ])

    const mailConfig = await medicosApi.getMyMailConfig().catch(() => null)
    const compartidos = permiteTurnos
      ? await consultoriosApi.listMios().catch(() => [])
      : []

    const clinics = Array.isArray(clinicasRows) ? clinicasRows : []
    const tipos = Array.isArray(turnosConfig?.tipos_turno) ? turnosConfig.tipos_turno.map(mapTipoTurno) : []

    setConsultorios(clinics)
    setPublicados(Object.fromEntries(
      (Array.isArray(compartidos) ? compartidos : []).map((c) => [c.id_clinica, Boolean(c.compartido)])
    ))
    setBloqueos(Array.isArray(bloqueosRows) ? bloqueosRows : [])
    setAsistentes(Array.isArray(asistentesRows) ? asistentesRows.map(mapAsistente) : [])
    setDuracion(String(turnosConfig?.duracion_turno_estandar || 30))
    setTiposTurno(tipos.length > 0 ? tipos : [turnoTipoFormBase()])
    setTerminos(tyc?.texto || '')
    setEnviarRecetasMail(mailConfig?.enviar_recetas_mail !== false)
    setNotifTurnoNuevo(mailConfig?.notif_turno_nuevo !== false)
    setNotifCancelacion(mailConfig?.notif_cancelacion !== false)
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
      setDuracion('30')
      setTiposTurno([turnoTipoFormBase()])
      setTerminos('')
      setEnviarRecetasMail(true)
      setNotifTurnoNuevo(true)
      setNotifCancelacion(true)
    })
  }, [doctorId, permiteAsistentes, permiteTurnos])

  function solicitarCambioMembresia() {
    setEstadoCrud('Pronto vas a poder cambiar tu membresia desde este panel. Contacta administracion para gestion inmediata.')
  }

  async function guardarMailConfig() {
    try {
      const saved = await medicosApi.saveMyMailConfig({
        enviar_recetas_mail: Boolean(enviarRecetasMail),
        notif_turno_nuevo: Boolean(notifTurnoNuevo),
        notif_cancelacion: Boolean(notifCancelacion),
      })
      setEnviarRecetasMail(saved?.enviar_recetas_mail !== false)
      setNotifTurnoNuevo(saved?.notif_turno_nuevo !== false)
      setNotifCancelacion(saved?.notif_cancelacion !== false)
      setEstadoMailConfig('Configuracion guardada correctamente.')
    } catch (err) {
      setEstadoMailConfig(err?.message || 'No se pudo guardar la configuracion.')
    }
  }

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
    setEstadoCrud('')

    if (guardandoClinica) return
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
      setGuardandoClinica(true)
      if (clinicForm.id) {
        await medicosApi.updateMyClinica(clinicForm.id, payload)
      } else {
        await medicosApi.createMyClinica(payload)
      }

      // Refrescamos solo clinicas para evitar que un fallo en otro modulo invalide el alta.
      const clinicasRows = await medicosApi.listMyClinicas()
      setConsultorios(Array.isArray(clinicasRows) ? clinicasRows : [])

      setShowClinicForm(false)
      setClinicForm(clinicFormFromRow())
      setEstadoCrud('Consultorio guardado correctamente.')
    } catch (err) {
      setEstadoCrud(err?.message || 'No se pudo guardar el consultorio.')
    } finally {
      setGuardandoClinica(false)
    }
  }

  async function togglePublicar(idClinica, publicar) {
    try {
      await consultoriosApi.publicar(idClinica, publicar)
      setPublicados((prev) => ({ ...prev, [idClinica]: publicar }))
      setEstadoCrud(publicar
        ? 'Consultorio publicado para alquiler.'
        : 'Consultorio despublicado.')
    } catch (err) {
      setEstadoCrud(err?.message || 'No se pudo cambiar la publicación.')
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

  function addTipoTurno() {
    setTiposTurno((prev) => [...prev, turnoTipoFormBase()])
  }

  function updateTipoTurno(id, field, value) {
    setTiposTurno((prev) => prev.map((tipo) => (tipo.id === id ? { ...tipo, [field]: value } : tipo)))
  }

  function removeTipoTurno(id) {
    setTiposTurno((prev) => {
      const next = prev.filter((tipo) => tipo.id !== id)
      return next.length > 0 ? next : [turnoTipoFormBase()]
    })
  }

  async function guardarTurnosConfig(confirmar = false) {
    const tiposLimpios = tiposTurno
      .map((tipo) => ({
        id_tipo_turno: tipo.id_tipo_turno || null,
        nombre: tipo.nombre.trim(),
        duracion_minutos: Number(tipo.duracion_minutos),
        notificar_nuevo: Boolean(tipo.notificar_nuevo),
      }))
      .filter((tipo) => tipo.nombre || tipo.duracion_minutos)

    if (!duracion || Number(duracion) <= 0) {
      setEstadoTurnos('Selecciona una duración estándar válida.')
      return
    }

    if (tiposLimpios.some((tipo) => !tipo.nombre || !Number.isInteger(tipo.duracion_minutos) || tipo.duracion_minutos <= 0)) {
      setEstadoTurnos('Cada tipo debe tener nombre y duración válida en minutos.')
      return
    }

    try {
      const saved = await medicosApi.saveMyTurnosConfig({
        duracion_turno_estandar: Number(duracion),
        tipos_turno: tiposLimpios,
        confirmar,
      })
      const nextTipos = Array.isArray(saved?.tipos_turno) ? saved.tipos_turno.map(mapTipoTurno) : []
      setDuracion(String(saved?.duracion_turno_estandar || duracion))
      setTiposTurno(nextTipos.length > 0 ? nextTipos : [turnoTipoFormBase()])
      setTurnosEnConflicto([])
      setEstadoTurnos('Configuración de turnos guardada correctamente.')
      onConfigChange?.()
    } catch (err) {
      if (err?.status === 409 && Array.isArray(err?.details?.turnos_afectados)) {
        setTurnosEnConflicto(err.details.turnos_afectados)
        setEstadoTurnos(err.message)
        return
      }
      setTurnosEnConflicto([])
      setEstadoTurnos(err?.message || 'No se pudo guardar la configuración de turnos.')
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
        <h3>Membresia</h3>
        <p className="config-section-sub">Plan seleccionado actualmente para tu cuenta.</p>
        <div className="config-asistente-row" style={{ marginBottom: 0 }}>
          <div>
            <strong>{planNombre}</strong>
          </div>
          <Button size="sm" variant="secondary" onClick={solicitarCambioMembresia}>Cambiar membresia</Button>
        </div>
      </section>

      <section className="config-section surface-raised">
        <h3>Notificaciones</h3>
        <p className="config-section-sub">Preferencias de notificaciones del profesional.</p>
        <div className="config-asistente-row" style={{ marginBottom: 0 }}>
          <div>
            <strong>Enviar recetas al mail</strong>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Cuando esta opcion esta activa, recibis por mail los datos del paciente y lo solicitado.
            </p>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem' }}>
            <input
              type="checkbox"
              checked={enviarRecetasMail}
              onChange={(e) => setEnviarRecetasMail(e.target.checked)}
            />
            {enviarRecetasMail ? 'Activado' : 'Desactivado'}
          </label>
        </div>
        <div className="config-asistente-row" style={{ marginBottom: 0, marginTop: '0.6rem' }}>
          <div>
            <strong>Notificación de turno nuevo</strong>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Te avisa por mail cuando se agenda un turno común (sin un tipo específico).
            </p>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem' }}>
            <input
              type="checkbox"
              checked={notifTurnoNuevo}
              onChange={(e) => setNotifTurnoNuevo(e.target.checked)}
            />
            {notifTurnoNuevo ? 'Activado' : 'Desactivado'}
          </label>
        </div>
        <div className="config-asistente-row" style={{ marginBottom: 0, marginTop: '0.6rem' }}>
          <div>
            <strong>Notificación de cancelación</strong>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Te avisa por mail cuando un turno se cancela, sin importar el tipo.
            </p>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem' }}>
            <input
              type="checkbox"
              checked={notifCancelacion}
              onChange={(e) => setNotifCancelacion(e.target.checked)}
            />
            {notifCancelacion ? 'Activado' : 'Desactivado'}
          </label>
        </div>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Para notificaciones por tipo de turno específico (ej: "Primera vez"), configuralas en
          cada tipo dentro de "Configuracion general de turnos" más abajo.
        </p>
        <div style={{ marginTop: '0.7rem' }}>
          <Button size="sm" onClick={guardarMailConfig}>Guardar configuración</Button>
        </div>
        {estadoMailConfig && <p className="config-terms-msg">{estadoMailConfig}</p>}
      </section>

      {permiteTurnos && (
      <section className="config-section surface-raised">
        <div className="config-section-header">
          <h3>Mis consultorios</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" onClick={() => navigate('/medico/consultorios')}>
              Buscar consultorios en alquiler
            </Button>
            <Button variant="accent" size="sm" onClick={openNewClinica}>
              <Plus size={14} /> Agregar consultorio
            </Button>
          </div>
        </div>
        <p className="config-section-sub">Alta, edicion y baja de consultorios del medico autenticado.</p>
        {estadoCrud && <p className="config-terms-msg">{estadoCrud}</p>}
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
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {puedePublicar && (
                <Button
                  variant={publicados[c.id] ? 'accent' : 'ghost'}
                  size="sm"
                  onClick={() => togglePublicar(c.id, !publicados[c.id])}
                >
                  {publicados[c.id] ? 'Publicado' : 'Publicar para alquiler'}
                </Button>
              )}
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
              <Button type="submit" disabled={guardandoClinica}>
                {guardandoClinica ? 'Guardando...' : 'Guardar consultorio'}
              </Button>
            </div>
          </form>
        )}
      </section>
      )}

      {permiteTurnos && (
      <section className="config-section surface-raised">
        <h3>Configuracion general de turnos</h3>
        <div className="config-turnos-header">
          <div className="form-group" style={{ minWidth: '280px', margin: 0 }}>
            <label className="form-label" htmlFor="duracion">Duracion turno estandar</label>
            <select id="duracion" className="form-select" value={duracion} onChange={(e) => setDuracion(e.target.value)}>
              <option value="15">15 minutos</option>
              <option value="20">20 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">60 minutos</option>
              <option value="90">90 minutos</option>
              <option value="120">120 minutos</option>
              <option value="160">160 minutos</option>
            </select>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addTipoTurno}>
            <Plus size={14} /> Agregar tipo
          </Button>
        </div>

        <div className="config-turnos-list">
          {tiposTurno.map((tipo) => (
            <div key={tipo.id} className="config-turno-tipo-row">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nombre del tipo</label>
                <input
                  className="form-input"
                  placeholder="Ej: Seguimiento, Entrevista inicial..."
                  value={tipo.nombre}
                  onChange={(e) => updateTipoTurno(tipo.id, 'nombre', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Duración (minutos)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-input"
                  value={tipo.duracion_minutos}
                  onChange={(e) => updateTipoTurno(tipo.id, 'duracion_minutos', e.target.value)}
                />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={Boolean(tipo.notificar_nuevo)}
                  onChange={(e) => updateTipoTurno(tipo.id, 'notificar_nuevo', e.target.checked)}
                />
                Notificarme
              </label>
              <Button type="button" variant="danger" size="sm" onClick={() => removeTipoTurno(tipo.id)}>
                <Trash2 size={12} /> Quitar
              </Button>
            </div>
          ))}
        </div>

        {tiposTurno.length === 0 && <p className="config-turnos-empty">No hay tipos de turno configurados.</p>}
        <Button size="sm" onClick={() => guardarTurnosConfig(false)}>Guardar configuracion</Button>
        {estadoTurnos && <p className="config-terms-msg">{estadoTurnos}</p>}

        {turnosEnConflicto.length > 0 && (
          <div className="config-conflicto">
            <p className="config-conflicto-titulo">
              Estos turnos ya agendados no caen en la grilla de {duracion} minutos. Si guardás igual,
              seguirán vigentes pero ocuparán horarios que no coinciden con los nuevos slots.
            </p>
            <ul className="config-conflicto-lista">
              {turnosEnConflicto.map((t) => (
                <li key={t.id_turno}>
                  {`${t.fecha} ${t.hora} - ${t.paciente_nombre} ${t.paciente_apellido}`}
                  {t.clinica_nombre ? ` (${t.clinica_nombre})` : ''}
                </li>
              ))}
            </ul>
            <div className="config-conflicto-acciones">
              <Button size="sm" onClick={() => guardarTurnosConfig(true)}>Guardar de todos modos</Button>
              <Button size="sm" variant="ghost" onClick={() => { setTurnosEnConflicto([]); setEstadoTurnos('') }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </section>
      )}

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

      {permiteTurnos && (
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
      )}

      <section className="config-section surface-raised">
        <h3>Gestion de asistentes</h3>
        <p className="config-section-sub">Permisos y estado gestionados en base de datos.</p>
        {!permiteAsistentes && (
          <p className="config-bloqueos-vacio">Tu plan actual no incluye gestión de asistentes.</p>
        )}

        {permiteAsistentes && asistentes.map((a) => (
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

        {permiteAsistentes && (
          <AltaAsistenteForm
            title="Alta de asistente"
            subtitle="Le damos acceso al sistema y lo vinculamos a este profesional."
            clinicOptions={consultorios.map((consultorio) => ({
              id: consultorio.id,
              label: consultorio.nombre,
            }))}
            onCreate={crearAsistente}
          />
        )}
      </section>
    </div>
  )
}
