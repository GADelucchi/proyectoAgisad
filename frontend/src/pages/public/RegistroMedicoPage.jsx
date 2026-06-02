import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import PasswordInput from '../../components/ui/PasswordInput'
import { authApi } from '../../services/auth.api'
import { ApiError } from '../../services/apiClient'
import './AuthPages.css'

const ESPECIALIDADES = [
  'Clínica Médica',
  'Pediatría',
  'Cardiología',
  'Dermatología',
  'Ginecología',
  'Traumatología',
  'Neurología',
  'Oftalmología',
  'Psiquiatría',
  'Psicología',
  'Kinesiología',
  'Nutrición',
]

const PLANES = [
  { value: 'esencial', label: 'Esencial', description: 'Perfil profesional y agenda básica.' },
  { value: 'profesional', label: 'Profesional', description: 'Mayor visibilidad y herramientas extendidas.' },
  { value: 'premium', label: 'Premium', description: 'Prioridad comercial y soporte avanzado.' },
]

export default function RegistroMedicoPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    matricula: '',
    especialidad: ESPECIALIDADES[0],
    provincia: 'Buenos Aires',
    ciudad: 'La Plata',
    telefono: '',
    email: '',
    bio: '',
    foto_url: '',
    password: '',
    confirmar: '',
    plan: 'profesional',
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
    if (!form.dni || !/^\d{7,8}$/.test(form.dni)) return 'DNI inválido (7 u 8 dígitos).'
    if (!form.matricula) return 'Ingresá la matrícula.'
    if (!form.especialidad) return 'Seleccioná una especialidad.'
    if (!form.provincia || !form.ciudad) return 'Ingresá provincia y ciudad.'
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
      const username = (form.email.split('@')[0] || 'medico').toLowerCase()
      await authApi.registerMedico({
        username,
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        telefono: form.telefono || null,
        matricula: form.matricula,
        especialidad: form.especialidad,
        provincia: form.provincia,
        ciudad: form.ciudad,
        bio: form.bio || null,
        foto_url: form.foto_url || null,
        plan: form.plan,
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
        <p className="auth-kicker">Registro de médico</p>
        <h2>Crear cuenta profesional</h2>
        <p className="auth-sub">Completá tus datos profesionales y elegí la membresía con la que querés empezar.</p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" className="form-input" placeholder="Ej: Juan" value={form.nombre} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="apellido">Apellido</label>
              <input id="apellido" name="apellido" type="text" className="form-input" placeholder="Ej: Pérez" value={form.apellido} onChange={handleChange} />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="dni">DNI</label>
              <input id="dni" name="dni" type="text" className="form-input" placeholder="Ej: 30123456" value={form.dni} onChange={handleChange} inputMode="numeric" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="matricula">Matrícula</label>
              <input id="matricula" name="matricula" type="text" className="form-input" placeholder="Ej: MP-12345" value={form.matricula} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="especialidad">Especialidad</label>
            <select id="especialidad" name="especialidad" className="form-select" value={form.especialidad} onChange={handleChange}>
              {ESPECIALIDADES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
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
              <label className="form-label" htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" type="tel" className="form-input" placeholder="2214445566" value={form.telefono} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="form-input" placeholder="matricula@email.com" value={form.email} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bio">Bio profesional</label>
            <textarea id="bio" name="bio" className="form-textarea" placeholder="Especialidades, experiencia, enfoques de atención..." value={form.bio} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="foto_url">Foto URL</label>
            <input id="foto_url" name="foto_url" type="url" className="form-input" placeholder="https://..." value={form.foto_url} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="plan">Membresía</label>
            <select id="plan" name="plan" className="form-select" value={form.plan} onChange={handleChange}>
              {PLANES.map(item => <option key={item.value} value={item.value}>{item.label} - {item.description}</option>)}
            </select>
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
            {loading ? 'Creando cuenta...' : 'Crear cuenta de médico'}
          </Button>
        </form>

        <p className="auth-footer">
          ¿Querés elegir otro tipo de cuenta? <Link to="/registro">Volver al selector</Link>
        </p>
      </div>
    </div>
  )
}