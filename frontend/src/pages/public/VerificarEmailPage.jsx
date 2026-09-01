import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../services/auth.api'
import { ApiError, STORAGE_KEYS } from '../../services/apiClient'
import Button from '../../components/ui/Button'
import './AuthPages.css'

const REENVIO_COOLDOWN_SEG = 45

export default function VerificarEmailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { completarSesion } = useAuth()

  const [email, setEmail] = useState(location.state?.email || '')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(location.state?.email ? REENVIO_COOLDOWN_SEG : 0)
  const [reenviando, setReenviando] = useState(false)
  const [avisoReenvio, setAvisoReenvio] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown((prev) => Math.max(prev - 1, 0)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  function redirigirPorRol() {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}')
    if (stored.rol === 'admin') navigate('/admin')
    else if (stored.rol === 'medico') navigate('/medico')
    else if (stored.rol === 'asistente') navigate('/asistente')
    else if (stored.rol === 'gerente') navigate('/gerente')
    else navigate('/paciente')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) { setError('Ingresá tu email.'); return }
    if (!/^\d{6}$/.test(codigo)) { setError('El código tiene 6 dígitos.'); return }

    setError('')
    setLoading(true)
    try {
      const data = await authApi.verificarEmail(email.trim(), codigo.trim())
      completarSesion(data.token, data.user)
      redirigirPorRol()
    } catch (err) {
      setError(err instanceof ApiError ? (err.message || 'No se pudo verificar el código.') : 'No se pudo verificar el código.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReenviar() {
    if (!email || !email.includes('@')) { setError('Ingresá tu email para poder reenviar el código.'); return }

    setError('')
    setAvisoReenvio('')
    setReenviando(true)
    try {
      await authApi.reenviarCodigo(email.trim())
      setAvisoReenvio('Te mandamos un código nuevo.')
      setCooldown(REENVIO_COOLDOWN_SEG)
    } catch (err) {
      setError(err instanceof ApiError ? (err.message || 'No se pudo reenviar el código.') : 'No se pudo reenviar el código.')
    } finally {
      setReenviando(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card surface-raised" style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}>
          <MailCheck size={52} />
        </div>
        <h2>Verificá tu email</h2>
        <p>
          Te enviamos un código de 6 dígitos a tu casilla de correo.<br />
          Completalo acá para activar tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate style={{ textAlign: 'left', marginTop: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="verificar-email">Email</label>
            <input
              id="verificar-email"
              type="email"
              className="form-input"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              disabled={Boolean(location.state?.email)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="verificar-codigo">Código de 6 dígitos</label>
            <input
              id="verificar-codigo"
              className="form-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.4em' }}
              value={codigo}
              onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}
          {avisoReenvio && !error && <p style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{avisoReenvio}</p>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Verificando...' : 'Verificar'}
          </Button>
        </form>

        <p style={{ fontSize: '0.85rem', marginTop: '1.5rem' }}>
          ¿No llegó? Revisá la carpeta de spam o{' '}
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: cooldown > 0 ? 'default' : 'pointer', textDecoration: 'underline', opacity: cooldown > 0 ? 0.6 : 1 }}
            onClick={handleReenviar}
            disabled={reenviando || cooldown > 0}
          >
            {cooldown > 0 ? `reenviá el código (${cooldown}s)` : 'reenviá el código'}
          </button>
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/login">Volver al inicio de sesión</Link>
        </p>
      </div>
    </div>
  )
}
