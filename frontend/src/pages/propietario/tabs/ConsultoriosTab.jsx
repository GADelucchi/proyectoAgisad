import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { consultoriosApi } from '../../../services/consultorios.api'
import '../../medico/tabs/ConfiguracionTab.css'

const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

function rangoBase() {
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dias: [],
    inicio: '09:00',
    fin: '18:00',
    duracion: '60',
  }
}

export default function ConsultoriosTab({ onChange }) {
  const [consultorios, setConsultorios] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [rangos, setRangos] = useState([rangoBase()])
  const [medicos, setMedicos] = useState([])
  const [estado, setEstado] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '', id_ciudad: '1' })

  async function cargar() {
    const rows = await consultoriosApi.listMios().catch(() => [])
    setConsultorios(Array.isArray(rows) ? rows : [])
  }

  useEffect(() => {
    cargar()
  }, [])

  async function abrirConsultorio(consultorio) {
    setSeleccionado(consultorio)
    setEstado('')
    try {
      const [config, vinculados] = await Promise.all([
        consultoriosApi.getDisponibilidad(consultorio.id_clinica),
        consultoriosApi.listMedicosVinculados(consultorio.id_clinica).catch(() => []),
      ])

      const agrupados = new Map()
      for (const r of config?.rangos || []) {
        const clave = `${r.hora_inicio}-${r.hora_fin}-${r.duracion_turno}`
        if (!agrupados.has(clave)) {
          agrupados.set(clave, {
            id: clave,
            dias: [],
            inicio: r.hora_inicio,
            fin: r.hora_fin,
            duracion: String(r.duracion_turno),
          })
        }
        agrupados.get(clave).dias.push(DIAS[(Number(r.dia_semana) + 6) % 7])
      }

      const lista = [...agrupados.values()]
      setRangos(lista.length > 0 ? lista : [rangoBase()])
      setMedicos(Array.isArray(vinculados) ? vinculados : [])
    } catch (err) {
      setEstado(err?.message || 'No se pudo cargar el consultorio.')
    }
  }

  async function crearConsultorio(e) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.direccion.trim()) {
      setEstado('Completá nombre y dirección.')
      return
    }
    try {
      await consultoriosApi.crear({
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim(),
        telefono: form.telefono || null,
        id_ciudad: Number(form.id_ciudad),
      })
      setForm({ nombre: '', direccion: '', telefono: '', id_ciudad: '1' })
      setShowForm(false)
      setEstado('Consultorio creado correctamente.')
      await cargar()
      onChange?.()
    } catch (err) {
      setEstado(err?.message || 'No se pudo crear el consultorio.')
    }
  }

  function toggleDia(idRango, dia) {
    setRangos((prev) => prev.map((r) => {
      if (r.id !== idRango) return r
      const dias = r.dias.includes(dia) ? r.dias.filter((d) => d !== dia) : [...r.dias, dia]
      return { ...r, dias }
    }))
  }

  function updateRango(idRango, campo, valor) {
    setRangos((prev) => prev.map((r) => (r.id === idRango ? { ...r, [campo]: valor } : r)))
  }

  async function guardarDisponibilidad() {
    if (!seleccionado) return
    const limpios = rangos.filter((r) => r.dias.length > 0 && r.inicio && r.fin)
    if (limpios.length === 0) {
      setEstado('Elegí al menos un día con su horario.')
      return
    }
    try {
      await consultoriosApi.saveDisponibilidad(seleccionado.id_clinica, {
        rangos: limpios.map((r) => ({
          dias: r.dias,
          inicio: r.inicio,
          fin: r.fin,
          duracion: Number(r.duracion) || 60,
        })),
        excepciones: [],
      })
      setEstado('Disponibilidad guardada correctamente.')
    } catch (err) {
      setEstado(err?.message || 'No se pudo guardar la disponibilidad.')
    }
  }

  async function desvincular(idMedico) {
    if (!seleccionado) return
    try {
      await consultoriosApi.desvincularMedico(seleccionado.id_clinica, idMedico)
      setMedicos((prev) => prev.filter((m) => m.id_medico !== idMedico))
      setEstado('Médico desvinculado.')
    } catch (err) {
      setEstado(err?.message || 'No se pudo desvincular al médico.')
    }
  }

  return (
    <div className="config-tab">
      <section className="config-section surface-raised">
        <div className="config-section-header">
          <h3>Mis consultorios</h3>
          <Button variant="accent" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={14} /> Agregar consultorio
          </Button>
        </div>
        <p className="config-section-sub">
          Los consultorios que publicás quedan visibles para que los médicos soliciten alquilarlos.
        </p>

        {showForm && (
          <form onSubmit={crearConsultorio} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="c-nombre">Nombre</label>
              <input
                id="c-nombre"
                className="form-input"
                placeholder="Ej: Consultorio A"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-direccion">Dirección</label>
              <input
                id="c-direccion"
                className="form-input"
                placeholder="Ej: Calle 50 N 500"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-telefono">Teléfono</label>
              <input
                id="c-telefono"
                className="form-input"
                placeholder="2214445566"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit">Guardar consultorio</Button>
            </div>
          </form>
        )}

        {consultorios.length === 0 && <p className="config-turnos-empty">Todavía no cargaste consultorios.</p>}

        {consultorios.map((c) => (
          <div key={c.id_clinica} className="config-asistente-row">
            <div>
              <strong>{c.nombre}</strong>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {c.direccion}{c.ciudad ? `, ${c.ciudad}` : ''} · {c.compartido ? 'Publicado' : 'No publicado'}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => abrirConsultorio(c)}>
              Configurar horarios
            </Button>
          </div>
        ))}
      </section>

      {seleccionado && (
        <section className="config-section surface-raised">
          <h3>Horarios de {seleccionado.nombre}</h3>
          <p className="config-section-sub">
            Definí en qué franjas se puede alquilar. Los médicos vinculados solo pueden agendar dentro de estas franjas.
          </p>

          {rangos.map((rango) => (
            <div key={rango.id} className="config-turno-tipo-row" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0, minWidth: '100%' }}>
                <label className="form-label">Días</label>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {DIAS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`panel-tab-btn ${rango.dias.includes(d) ? 'active' : ''}`}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      onClick={() => toggleDia(rango.id, d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Desde</label>
                <input
                  type="time"
                  className="form-input"
                  value={rango.inicio}
                  onChange={(e) => updateRango(rango.id, 'inicio', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Hasta</label>
                <input
                  type="time"
                  className="form-input"
                  value={rango.fin}
                  onChange={(e) => updateRango(rango.id, 'fin', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Bloque (min)</label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  className="form-input"
                  value={rango.duracion}
                  onChange={(e) => updateRango(rango.id, 'duracion', e.target.value)}
                />
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button size="sm" variant="secondary" onClick={() => setRangos((prev) => [...prev, rangoBase()])}>
              <Plus size={14} /> Agregar franja
            </Button>
            <Button size="sm" onClick={guardarDisponibilidad}>Guardar horarios</Button>
          </div>

          <h3 style={{ marginTop: '0.8rem' }}>Médicos vinculados</h3>
          {medicos.length === 0 && <p className="config-turnos-empty">Todavía no hay médicos usando este consultorio.</p>}
          {medicos.map((m) => (
            <div key={m.id_medico} className="config-asistente-row">
              <div>
                <strong>{m.nombre} {m.apellido}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {m.matricula} · {m.email}
                </p>
              </div>
              <Button size="sm" variant="danger" onClick={() => desvincular(m.id_medico)}>
                <Trash2 size={12} /> Desvincular
              </Button>
            </div>
          ))}
        </section>
      )}

      {estado && <p className="config-terms-msg">{estado}</p>}
    </div>
  )
}
