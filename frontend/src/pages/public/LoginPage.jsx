import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ApiError, STORAGE_KEYS } from '../../services/apiClient'
import Button from '../../components/ui/Button'
import PasswordInput from '../../components/ui/PasswordInput'
import './AuthPages.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Completá todos los campos.'); return }
    setLoading(true)
    try {
      const ok = await login(form.email, form.password)
      if (!ok) {
        setError('Email o contraseña incorrectos.')
        return
      }
    } catch (err) {
      console.error('[LoginPage] login falló', err)
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Credenciales incorrectas.')
        } else {
          setError(err.message || 'No se pudo iniciar sesión.')
        }
      } else {
        setError('No se pudo iniciar sesión.')
      }
      return
    } finally {
      setLoading(false)
    }

    // Redirigir según rol
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}')
    console.info('[LoginPage] usuario almacenado', stored)
    if (stored.rol === 'admin') navigate('/admin')
    else if (stored.rol === 'medico') navigate('/medico')
    else if (stored.rol === 'asistente') navigate('/asistente')
    else if (stored.rol === 'gerente') navigate('/gerente')
    else navigate('/paciente')
  }

  return (
    <div className="auth-page">
      <div className="auth-card surface-raised">
        <div className="auth-logo">Agisad</div>
        <h2>Iniciar sesión</h2>
        <p className="auth-sub">Ingresá con tu cuenta para continuar.</p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-input"
              placeholder="tu@email.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <PasswordInput
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="auth-forgot-wrap">
            <button type="button" className="auth-forgot-btn" onClick={() => navigate('/recuperar-password')}>
              Olvidé contraseña
            </button>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>

        <p className="auth-footer">
          ¿No tenés cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>

        <div className="auth-demo">
          <p className="auth-demo-title">Acceso</p>
          <p className="auth-demo-hint">Usá tus credenciales registradas en la base de datos.</p>
        </div>
      </div>
    </div>
  )
}
