import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import PasswordInput from '../../components/ui/PasswordInput'
import { authApi } from '../../services/auth.api'
import { ApiError } from '../../services/apiClient'
import './AuthPages.css'

export default function RegistroPropietarioPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    password: '',
    confirmar: '',
  })
  const [aceptaTyc, setAceptaTyc] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  function validate() {
    if (!form.nombre || !form.apellido) return 'Completá nombre y apellido.'
    if (!form.email || !form.email.includes('@')) return 'Email inválido.'
    if (!form.password || form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    if (form.password !== form.confirmar) return 'Las contraseñas no coinciden.'
    if (!aceptaTyc) return 'Tenés que aceptar los términos y condiciones y la política de privacidad.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    try {
      const username = (form.email.split('@')[0] || 'propietario').toLowerCase()
      await authApi.registerPropietario({
        username,
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono || null,
        acepta_tyc: aceptaTyc,
      })
      navigate('/verificar-email', { state: { email: form.email } })
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
        <p className="auth-kicker">Registro de propietario</p>
        <h2>Publicá tus consultorios</h2>
        <p className="auth-sub">
          Para quienes alquilan consultorios a profesionales sin atender pacientes.
          Cargá tus espacios, definí horarios y llevá el registro de horas usadas.
        </p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" className="form-input" placeholder="Ej: Andrea" value={form.nombre} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="apellido">Apellido</label>
              <input id="apellido" name="apellido" type="text" className="form-input" placeholder="Ej: Gómez" value={form.apellido} onChange={handleChange} />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" type="tel" className="form-input" placeholder="2214445566" value={form.telefono} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="form-input" placeholder="tu@email.com" value={form.email} onChange={handleChange} />
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

          <label className="auth-checkbox-row">
            <input
              type="checkbox"
              checked={aceptaTyc}
              onChange={e => { setAceptaTyc(e.target.checked); setError('') }}
            />
            <span>
              Acepto los <Link to="/terminos" target="_blank" rel="noopener noreferrer">términos y condiciones</Link> y la{' '}
              <Link to="/privacidad" target="_blank" rel="noopener noreferrer">política de privacidad</Link>.
            </span>
          </label>

          {error && <p className="auth-error">{error}</p>}

          <Button type="submit" fullWidth disabled={loading || !aceptaTyc}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta de propietario'}
          </Button>
        </form>

        <p className="auth-footer">
          ¿Querés elegir otro tipo de cuenta? <Link to="/registro">Volver al selector</Link>
        </p>
      </div>
    </div>
  )
}
