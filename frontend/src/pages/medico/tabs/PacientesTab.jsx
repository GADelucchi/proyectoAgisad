import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import Button from '../../../components/ui/Button'
import SmartDateInput from '../../../components/ui/SmartDateInput'
import './PacientesTab.css'

const PACIENTES_MOCK = [
  {
    id: 1,
    nombre: 'Melina Jazmín Beguiristain Colman',
    apellido: '',
    dni: '41705571',
    fechaNacimiento: '',
    codPais: '+549',
    telefono: '92345562449',
    email: '',
    obraSocial: 'OSPE',
    nroAfiliado: '',
  },
  {
    id: 2,
    nombre: 'Gastón Alejo Delucchi',
    apellido: '',
    dni: '40568729',
    fechaNacimiento: '',
    codPais: '+549',
    telefono: '92216079500',
    email: '',
    obraSocial: 'OSPE',
    nroAfiliado: '',
  },
  {
    id: 3,
    nombre: 'Gustavo Alfredo Delucchi',
    apellido: '',
    dni: '14463853',
    fechaNacimiento: '',
    codPais: '+549',
    telefono: '92214389500',
    email: '',
    obraSocial: '—',
    nroAfiliado: '',
  },
]

export default function PacientesTab() {
  const [pacientes, setPacientes] = useState(PACIENTES_MOCK)
  const [query, setQuery] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nuevoPaciente, setNuevoPaciente] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    fechaNacimiento: '',
    codPais: '+549',
    telefono: '',
    email: '',
    obraSocial: '',
    nroAfiliado: '',
  })
  const [error, setError] = useState('')

  const filtrados = pacientes.filter(p =>
    p.nombre.toLowerCase().includes(query.toLowerCase()) ||
    p.dni.includes(query) ||
    p.obraSocial.toLowerCase().includes(query.toLowerCase())
  )

  function handleNuevoPacienteChange(e) {
    setNuevoPaciente(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  function validarNuevoPaciente() {
    if (!nuevoPaciente.nombre || !nuevoPaciente.apellido) return 'Completá nombre y apellido.'
    if (!/^\d{7,8}$/.test(nuevoPaciente.dni)) return 'DNI inválido (7 u 8 dígitos).'
    if (!nuevoPaciente.fechaNacimiento) return 'Ingresá fecha de nacimiento.'
    if (!nuevoPaciente.telefono) return 'Ingresá teléfono.'
    if (!nuevoPaciente.email || !nuevoPaciente.email.includes('@')) return 'Email inválido.'
    if (!nuevoPaciente.obraSocial) return 'Ingresá obra social.'
    if (!nuevoPaciente.nroAfiliado) return 'Ingresá número de afiliado.'
    return null
  }

  function cancelarAlta() {
    setMostrarForm(false)
    setError('')
    setNuevoPaciente({
      nombre: '',
      apellido: '',
      dni: '',
      fechaNacimiento: '',
      codPais: '+549',
      telefono: '',
      email: '',
      obraSocial: '',
      nroAfiliado: '',
    })
  }

  function guardarPaciente(e) {
    e.preventDefault()
    const err = validarNuevoPaciente()
    if (err) {
      setError(err)
      return
    }

    setPacientes(prev => [
      {
        id: Date.now(),
        nombre: `${nuevoPaciente.nombre} ${nuevoPaciente.apellido}`.trim(),
        apellido: nuevoPaciente.apellido,
        dni: nuevoPaciente.dni,
        fechaNacimiento: nuevoPaciente.fechaNacimiento,
        codPais: nuevoPaciente.codPais,
        telefono: nuevoPaciente.telefono,
        email: nuevoPaciente.email,
        obraSocial: nuevoPaciente.obraSocial,
        nroAfiliado: nuevoPaciente.nroAfiliado,
      },
      ...prev,
    ])

    cancelarAlta()
  }

  return (
    <div className="pacientes-tab">
      <div className="pacientes-header">
        <div>
          <h3>Base de pacientes</h3>
          <p>Podés cargar pacientes manualmente desde este panel.</p>
        </div>
        <Button variant={mostrarForm ? 'secondary' : 'accent'} size="sm" onClick={() => (mostrarForm ? cancelarAlta() : setMostrarForm(true))}>
          <Plus size={14} /> {mostrarForm ? 'Cancelar alta' : 'Agregar paciente'}
        </Button>
      </div>

      {mostrarForm && (
        <form className="paciente-alta-form surface-raised" onSubmit={guardarPaciente} noValidate>
          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="nuevoNombre">Nombre</label>
              <input id="nuevoNombre" name="nombre" className="form-input" value={nuevoPaciente.nombre} onChange={handleNuevoPacienteChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="nuevoApellido">Apellido</label>
              <input id="nuevoApellido" name="apellido" className="form-input" value={nuevoPaciente.apellido} onChange={handleNuevoPacienteChange} />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="nuevoDni">DNI</label>
              <input id="nuevoDni" name="dni" className="form-input" placeholder="Ej: 32500123" value={nuevoPaciente.dni} onChange={handleNuevoPacienteChange} inputMode="numeric" />
              <small className="paciente-help">No agregar puntos ni guiones.</small>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="nuevoFechaNacimiento">Fecha de nacimiento</label>
              <SmartDateInput id="nuevoFechaNacimiento" name="fechaNacimiento" value={nuevoPaciente.fechaNacimiento} onChange={handleNuevoPacienteChange} />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="nuevoCodPais">Telefono (whatsapp)</label>
              <select id="nuevoCodPais" name="codPais" className="form-select" value={nuevoPaciente.codPais} onChange={handleNuevoPacienteChange}>
                <option value="+549">Argentina (+549)</option>
                <option value="+598">Uruguay (+598)</option>
                <option value="+56">Chile (+56)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="nuevoTelefono">Numero</label>
              <input id="nuevoTelefono" name="telefono" className="form-input" value={nuevoPaciente.telefono} onChange={handleNuevoPacienteChange} inputMode="numeric" />
              <small className="paciente-help">Sin el 0 y sin el 15.</small>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="nuevoEmail">Email</label>
            <input id="nuevoEmail" name="email" type="email" className="form-input" placeholder="ejemplo@mail.com" value={nuevoPaciente.email} onChange={handleNuevoPacienteChange} />
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="nuevoObraSocial">Obra social</label>
              <input id="nuevoObraSocial" name="obraSocial" className="form-input" value={nuevoPaciente.obraSocial} onChange={handleNuevoPacienteChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="nuevoNroAfiliado">N de afiliado</label>
              <input id="nuevoNroAfiliado" name="nroAfiliado" className="form-input" placeholder="Sin puntos ni guiones" value={nuevoPaciente.nroAfiliado} onChange={handleNuevoPacienteChange} />
              <small className="paciente-help">No agregar puntos ni guiones.</small>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <div className="paciente-alta-actions">
            <Button variant="secondary" type="button" onClick={cancelarAlta}>Cerrar</Button>
            <Button variant="primary" type="submit">Guardar paciente</Button>
          </div>
        </form>
      )}

      <div className="pacientes-search surface-raised">
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          className="buscador-input"
          placeholder="Buscar por DNI, apellido, nombre u obra social..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="surface-raised">
        <p style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          Mostrando {filtrados.length} de {pacientes.length} pacientes
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Teléfono</th>
              <th>Obra social</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.nombre}</td>
                <td>{p.dni}</td>
                <td>{p.tel}</td>
                <td>{p.obraSocial}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <Button variant="ghost" size="sm">Historial</Button>
                    <Button variant="ghost" size="sm">Editar</Button>
                    <Button variant="danger" size="sm">Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
