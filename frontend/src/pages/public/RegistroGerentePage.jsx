import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import PasswordInput from '../../components/ui/PasswordInput'
import { authApi } from '../../services/auth.api'
import { ApiError } from '../../services/apiClient'
import './AuthPages.css'

const PLANES = [
  { value: 'gestion', label: 'Gestión', description: 'Pensado para administrar clínicas.' },
  { value: 'pro', label: 'Pro', description: 'Más clínicas, más usuarios, más capacidad.' },
  { value: 'enterprise', label: 'Enterprise', description: 'Operación multi-clínica y soporte prioritario.' },
]

export default function RegistroGerentePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    password: '',
    confirmar: '',
    plan: 'gestion',
    clinica_nombre: '',
    clinica_telefono: '',
    provincia: 'Buenos Aires',
    ciudad: 'La Plata',
    direccion: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  function validate() {
    if (!form.nombre || !form.apellido) return 'Completá nombre y apellido.'
    if (!form.email || !form.email.includes('@')) return 'Email inválido.'
    if (!form.clinica_nombre) return 'Ingresá el nombre de la clínica.'
    if (!form.provincia || !form.ciudad || !form.direccion) return 'Completá ubicación de la clínica.'
    if (!form.password || form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    if (form.password !== form.confirmar) return 'Las contraseñas no coinciden.'
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
      const username = (form.email.split('@')[0] || 'gerente').toLowerCase()
      await authApi.registerGerente({
        username,
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono || null,
        plan: form.plan,
        clinica_nombre: form.clinica_nombre,
        clinica_telefono: form.clinica_telefono || null,
        provincia: form.provincia,
        ciudad: form.ciudad,
        direccion: form.direccion,
        acepta_tyc: true,
      })
      navigate('/login')
    } catch (apiErr) {
      if (apiErr instanceof ApiError) {
        setError(apiErr.message || 'No se pudo crear la cuenta.')
      } else {
        setError('No se pudo crear la cuenta.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide surface-raised">
        <div className="auth-logo">Agisad</div>
        <p className="auth-kicker">Registro de gerente</p>
        <h2>Crear cuenta de gestión</h2>
        <p className="auth-sub">Abrí tu cuenta y dejá lista la primera clínica para empezar a sumar médicos y asistentes.</p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" className="form-input" placeholder="Ej: Laura" value={form.nombre} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="apellido">Apellido</label>
              <input id="apellido" name="apellido" type="text" className="form-input" placeholder="Ej: Martínez" value={form.apellido} onChange={handleChange} />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" type="tel" className="form-input" placeholder="2214445566" value={form.telefono} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="form-input" placeholder="gerencia@tuclinica.com" value={form.email} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="plan">Membresía</label>
            <select id="plan" name="plan" className="form-select" value={form.plan} onChange={handleChange}>
              {PLANES.map(item => <option key={item.value} value={item.value}>{item.label} - {item.description}</option>)}
            </select>
          </div>

          <div className="auth-section-title">Primera clínica</div>
          <div className="form-group">
            <label className="form-label" htmlFor="clinica_nombre">Nombre de la clínica</label>
            <input id="clinica_nombre" name="clinica_nombre" type="text" className="form-input" placeholder="Ej: Clínica Centro" value={form.clinica_nombre} onChange={handleChange} />
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="provincia">Provincia</label>
              <input id="provincia" name="provincia" type="text" className="form-input" placeholder="Ej: Buenos Aires" value={form.provincia} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ciudad">Ciudad</label>
              <input id="ciudad" name="ciudad" type="text" className="form-input" placeholder="Ej: La Plata" value={form.ciudad} onChange={handleChange} />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="direccion">Dirección</label>
              <input id="direccion" name="direccion" type="text" className="form-input" placeholder="Ej: Av. 7 1234" value={form.direccion} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="clinica_telefono">Teléfono clínica</label>
              <input id="clinica_telefono" name="clinica_telefono" type="tel" className="form-input" placeholder="2214445566" value={form.clinica_telefono} onChange={handleChange} />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="password">Contraseña</label>
              <PasswordInput id="password" name="password" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirmar">Confirmar contraseña</label>
              <PasswordInput id="confirmar" name="confirmar" value={form.confirmar} onChange={handleChange} placeholder="Repetí la contraseña" autoComplete="new-password" />
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta de gerente'}
          </Button>
        </form>

        <p className="auth-footer">
          ¿Querés elegir otro tipo de cuenta? <Link to="/registro">Volver al selector</Link>
        </p>
      </div>
    </div>
  )
}