import { useEffect, useState } from 'react'
import { Search, RefreshCw, CalendarPlus } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../../context/AuthContext'
import { medicosApi } from '../../../services/medicos.api'
import { pacientesApi } from '../../../services/pacientes.api'
import { turnosApi } from '../../../services/turnos.api'
import { formatTime24h } from '../../../utils/dateFormat'
import './PacientesTab.css'

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function nombreCompleto(paciente) {
  return `${paciente?.apellido || ''} ${paciente?.nombre || ''}`.trim() || 'Paciente'
}

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
    ]).then(([clinicasRows, config]) => {
      if (cancelled) return
      setClinicas(Array.isArray(clinicasRows) ? clinicasRows : [])
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
    setAgendarPara(paciente)
    setSlots([])
    setFormTurno({
      id_clinica: clinicas.length === 1 ? String(clinicas[0].id) : '',
      fecha: toIsoDate(new Date()),
      hora: '',
      motivo: '',
    })
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
          <p>Listado obtenido desde turnos registrados en la base de datos.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Actualizando...' : 'Actualizar'}
        </Button>
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

      <div className="surface-raised">
        <p style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          Mostrando {filtrados.length} de {pacientes.length} pacientes
        </p>
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
                    <Button variant="ghost" size="sm" disabled>Historial</Button>
                    <Button variant="ghost" size="sm" disabled>Editar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && !loading && (
          <p style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            No hay pacientes para mostrar.
          </p>
        )}
      </div>
    </div>
  )
}
