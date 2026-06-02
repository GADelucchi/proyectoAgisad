import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { authApi } from '../../services/auth.api'
import './AuthPages.css'

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Ingresá un email válido.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
    } catch {
      // No exponemos errores para no filtrar existencia de cuentas.
    } finally {
      setLoading(false)
      setEnviado(true)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card surface-raised">
        <div className="auth-logo">Agisad</div>
        <h2>Recuperar contraseña</h2>
        <p className="auth-sub">Te enviamos un enlace para restablecer tu clave.</p>

        {!enviado ? (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="emailRecuperacion">Email</label>
              <input
                id="emailRecuperacion"
                type="email"
                className="form-input"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </Button>
          </form>
        ) : (
          <div className="auth-recovery-ok">
            <p>
              Si el email existe en Agisad, te enviamos un enlace de recuperación.
              Revisá tu bandeja principal y spam.
            </p>
            <Link to="/login">Volver al login</Link>
          </div>
        )}
      </div>
    </div>
  )
}
