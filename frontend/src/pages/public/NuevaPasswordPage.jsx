import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import PasswordInput from '../../components/ui/PasswordInput'
import { authApi } from '../../services/auth.api'
import { ApiError } from '../../services/apiClient'
import './AuthPages.css'
import { PASSWORD_HINT, validarPassword } from '../../utils/password'

export default function NuevaPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [form, setForm] = useState({ password: '', confirmar: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!token) {
      setError('Token inválido.')
      return
    }

    const errorPassword = validarPassword(form.password)
    if (errorPassword) {
      setError(errorPassword)
      return
    }

    if (form.password !== form.confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword(token, form.password)
      navigate('/login')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'No se pudo actualizar la contraseña.')
      } else {
        setError('No se pudo actualizar la contraseña.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card surface-raised">
        <div className="auth-logo">Agisad</div>
        <h2>Nueva contraseña</h2>
        <p className="auth-sub">Elegí una nueva clave para ingresar a tu cuenta.</p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Nueva contraseña</label>
            <PasswordInput
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder={PASSWORD_HINT}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmar">Confirmar contraseña</label>
            <PasswordInput
              id="confirmar"
              name="confirmar"
              value={form.confirmar}
              onChange={handleChange}
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Guardando...' : 'Actualizar contraseña'}
          </Button>
        </form>

        <p className="auth-footer">
          <Link to="/login">Volver al login</Link>
        </p>
      </div>
    </div>
  )
}
