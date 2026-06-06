import { useState } from 'react'
import Button from '../ui/Button'

const DEFAULT_PERMISOS = {
  agenda: true,
  pacientes: false,
  mensajes: false,
  recetas: false,
  configuracion: false,
  bloqueado: false,
}

function normalizeClinicIds(value) {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter(Boolean)
}

export default function AltaAsistenteForm({
  title = 'Alta de asistente',
  subtitle = 'Creá credenciales para que pueda iniciar sesión.',
  clinicOptions = [],
  allowManualClinicIds = false,
  onCreate,
}) {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    username: '',
    telefono: '',
    password: '',
    clinicIdsText: '',
    permisos: { ...DEFAULT_PERMISOS },
  })
  const [selectedClinicIds, setSelectedClinicIds] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    if (name.startsWith('permisos.')) {
      const key = name.split('.')[1]
      setForm((prev) => ({
        ...prev,
        permisos: { ...prev.permisos, [key]: checked },
      }))
      setError('')
      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setError('')
  }

  function toggleClinic(id) {
    setSelectedClinicIds((prev) => {
      const current = new Set(prev)
      if (current.has(Number(id))) current.delete(Number(id))
      else current.add(Number(id))
      return Array.from(current)
    })
  }

  function validate() {
    if (!form.nombre.trim() || !form.apellido.trim()) return 'Completá nombre y apellido.'
    if (!form.email.includes('@')) return 'Email inválido.'
    if (!form.password || form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    if (!allowManualClinicIds && clinicOptions.length > 0 && selectedClinicIds.length === 0) return 'Seleccioná al menos una clínica.'
    if (allowManualClinicIds && !normalizeClinicIds(form.clinicIdsText).length) return 'Ingresá al menos un ID de clínica.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) {
      setError(err)
      return
    }

    setLoading(true)
    try {
      await onCreate({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        telefono: form.telefono.trim(),
        password: form.password,
        clinic_ids: allowManualClinicIds ? normalizeClinicIds(form.clinicIdsText) : selectedClinicIds,
        permisos: form.permisos,
      })
      setForm({
        nombre: '',
        apellido: '',
        email: '',
        username: '',
        telefono: '',
        password: '',
        clinicIdsText: '',
        permisos: { ...DEFAULT_PERMISOS },
      })
      setSelectedClinicIds([])
    } catch (submitError) {
      setError(submitError?.message || 'No se pudo crear el asistente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="surface-raised" onSubmit={handleSubmit} style={{ padding: '1rem', marginTop: '1rem' }} noValidate>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>{subtitle}</p>

      <div className="auth-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="asistenteNombre">Nombre</label>
          <input id="asistenteNombre" name="nombre" className="form-input" value={form.nombre} onChange={handleChange} placeholder="Ej: Ana" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="asistenteApellido">Apellido</label>
          <input id="asistenteApellido" name="apellido" className="form-input" value={form.apellido} onChange={handleChange} placeholder="Ej: Pérez" />
        </div>
      </div>

      <div className="auth-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="asistenteEmail">Email</label>
          <input id="asistenteEmail" name="email" type="email" className="form-input" value={form.email} onChange={handleChange} placeholder="asistente@correo.com" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="asistenteUsername">Usuario</label>
          <input id="asistenteUsername" name="username" className="form-input" value={form.username} onChange={handleChange} placeholder="usuario opcional" />
        </div>
      </div>

      <div className="auth-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="asistenteTelefono">Teléfono</label>
          <input id="asistenteTelefono" name="telefono" className="form-input" value={form.telefono} onChange={handleChange} placeholder="2214445566" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="asistentePassword">Contraseña</label>
          <input id="asistentePassword" name="password" type="password" className="form-input" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" />
        </div>
      </div>

      {allowManualClinicIds ? (
        <div className="form-group">
          <label className="form-label" htmlFor="asistenteClinicIds">IDs de clínicas</label>
          <textarea
            id="asistenteClinicIds"
            name="clinicIdsText"
            className="form-textarea"
            value={form.clinicIdsText}
            onChange={handleChange}
            placeholder="Ej: 1, 2, 5"
            rows={3}
          />
          <small className="auth-help">Separalos con coma. Más adelante lo cambiaremos por un selector.</small>
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label">Clínicas / consultorios</label>
          <div className="config-perm-grid" style={{ marginTop: '0.5rem' }}>
            {clinicOptions.map((clinic) => {
              const selected = selectedClinicIds.includes(Number(clinic.id))
              return (
                <button
                  key={clinic.id}
                  type="button"
                  className={`panel-tab-btn ${selected ? 'active' : ''}`}
                  onClick={() => toggleClinic(clinic.id)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '999px',
                    marginRight: '0.5rem',
                    marginBottom: '0.5rem',
                    padding: '0.45rem 0.8rem',
                  }}
                >
                  {clinic.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="auth-grid-2">
        <label className="config-asistente-perm-label">
          <input type="checkbox" name="permisos.agenda" checked={form.permisos.agenda} onChange={handleChange} /> Agenda
        </label>
        <label className="config-asistente-perm-label">
          <input type="checkbox" name="permisos.pacientes" checked={form.permisos.pacientes} onChange={handleChange} /> Pacientes
        </label>
        <label className="config-asistente-perm-label">
          <input type="checkbox" name="permisos.mensajes" checked={form.permisos.mensajes} onChange={handleChange} /> Mensajes
        </label>
        <label className="config-asistente-perm-label">
          <input type="checkbox" name="permisos.recetas" checked={form.permisos.recetas} onChange={handleChange} /> Recetas
        </label>
        <label className="config-asistente-perm-label">
          <input type="checkbox" name="permisos.configuracion" checked={form.permisos.configuracion} onChange={handleChange} /> Configuración
        </label>
        <label className="config-asistente-perm-label">
          <input type="checkbox" name="permisos.bloqueado" checked={form.permisos.bloqueado} onChange={handleChange} /> Bloqueado
        </label>
      </div>

      {error && <p className="auth-error" style={{ marginTop: '1rem' }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear asistente'}</Button>
      </div>
    </form>
  )
}
