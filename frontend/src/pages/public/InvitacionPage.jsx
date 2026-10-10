import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { gerentesApi } from '../../services/gerentes.api'
import { ApiError, STORAGE_KEYS } from '../../services/apiClient'
import Button from '../../components/ui/Button'
import PasswordInput from '../../components/ui/PasswordInput'
import './AuthPages.css'
import { PASSWORD_HINT, validarPassword } from '../../utils/password'

const ESPECIALIDADES = [
  'Clínica Médica', 'Pediatría', 'Cardiología', 'Dermatología', 'Ginecología',
  'Traumatología', 'Neurología', 'Oftalmología', 'Psiquiatría', 'Psicología', 'Kinesiología', 'Nutrición',
]

function InvitacionLoginForm({ invitacion, token, onAceptada }) {
  const { login } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password) { setError('Ingresá tu contraseña.'); return }
    setLoading(true)
    try {
      await login(invitacion.email_invitado, password)
      const data = await gerentesApi.aceptarInvitacion(token)
      onAceptada(data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Contraseña incorrecta.' : (err.message || 'No se pudo aceptar la invitación.'))
      } else {
        setError('No se pudo aceptar la invitación.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="form-group">
        <label className="form-label">Email</label>
        <input className="form-input" type="email" value={invitacion.email_invitado} disabled />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="password">Contraseña</label>
        <PasswordInput id="password" name="password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} placeholder="••••••••" autoComplete="current-password" />
      </div>
      {error && <p className="auth-error">{error}</p>}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Aceptando...' : 'Iniciar sesión y aceptar'}
      </Button>
    </form>
  )
}

function InvitacionRegistroForm({ invitacion, token, onAceptada }) {
  const [form, setForm] = useState({
    nombre: '', apellido: '', dni: '', matricula: '',
    especialidad: ESPECIALIDADES[0], provincia: 'Buenos Aires', ciudad: 'La Plata',
    telefono: '', bio: '', password: '', confirmar: '',
  })
  const [aceptaTyc, setAceptaTyc] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  function validate() {
    if (!form.nombre || !form.apellido) return 'Completá nombre y apellido.'
    if (!form.dni || !/^\d{7,8}$/.test(form.dni)) return 'DNI inválido (7 u 8 dígitos).'
    if (!form.matricula) return 'Ingresá la matrícula.'
    if (!form.provincia || !form.ciudad) return 'Ingresá provincia y ciudad.'
    const errorPassword = validarPassword(form.password)
    if (errorPassword) return errorPassword
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
      const username = (invitacion.email_invitado.split('@')[0] || 'medico').toLowerCase()
      const data = await gerentesApi.registrarViaInvitacion(token, {
        username,
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
        acepta_tyc: aceptaTyc,
      })
      onAceptada(data)
    } catch (apiErr) {
      setError(apiErr instanceof ApiError ? (apiErr.message || 'No se pudo crear la cuenta.') : 'No se pudo crear la cuenta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="form-group">
        <label className="form-label">Email</label>
        <input className="form-input" type="email" value={invitacion.email_invitado} disabled />
      </div>
      <div className="auth-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" type="text" className="form-input" value={form.nombre} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="apellido">Apellido</label>
          <input id="apellido" name="apellido" type="text" className="form-input" value={form.apellido} onChange={handleChange} />
        </div>
      </div>
      <div className="auth-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="dni">DNI</label>
          <input id="dni" name="dni" type="text" className="form-input" value={form.dni} onChange={handleChange} inputMode="numeric" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="matricula">Matrícula</label>
          <input id="matricula" name="matricula" type="text" className="form-input" placeholder="Ej: MP-12345" value={form.matricula} onChange={handleChange} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="especialidad">Especialidad</label>
        <select id="especialidad" name="especialidad" className="form-select" value={form.especialidad} onChange={handleChange}>
          {ESPECIALIDADES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="auth-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="provincia">Provincia</label>
          <input id="provincia" name="provincia" type="text" className="form-input" value={form.provincia} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ciudad">Ciudad</label>
          <input id="ciudad" name="ciudad" type="text" className="form-input" value={form.ciudad} onChange={handleChange} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="telefono">Teléfono</label>
        <input id="telefono" name="telefono" type="tel" className="form-input" value={form.telefono} onChange={handleChange} />
      </div>
      <div className="auth-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="password">Contraseña</label>
          <PasswordInput id="password" name="password" value={form.password} onChange={handleChange} placeholder={PASSWORD_HINT} autoComplete="new-password" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="confirmar">Confirmar contraseña</label>
          <PasswordInput id="confirmar" name="confirmar" value={form.confirmar} onChange={handleChange} placeholder="Repetí la contraseña" autoComplete="new-password" />
        </div>
      </div>

      <label className="auth-checkbox-row">
        <input type="checkbox" checked={aceptaTyc} onChange={(e) => { setAceptaTyc(e.target.checked); setError('') }} />
        <span>
          Acepto los <Link to="/terminos" target="_blank" rel="noopener noreferrer">términos y condiciones</Link> y la{' '}
          <Link to="/privacidad" target="_blank" rel="noopener noreferrer">política de privacidad</Link>.
        </span>
      </label>

      {error && <p className="auth-error">{error}</p>}

      <Button type="submit" fullWidth disabled={loading || !aceptaTyc}>
        {loading ? 'Creando cuenta...' : 'Crear cuenta y aceptar invitación'}
      </Button>
    </form>
  )
}

export default function InvitacionPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [invitacion, setInvitacion] = useState(null)
  const [error, setError] = useState('')
  const [modo, setModo] = useState('nuevo') // 'nuevo' | 'existente'
  const [aceptada, setAceptada] = useState(null)

  useEffect(() => {
    let cancelled = false
    gerentesApi.getInvitacionPorToken(token)
      .then((data) => { if (!cancelled) setInvitacion(data) })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la invitación.')
      })
    return () => { cancelled = true }
  }, [token])

  function handleAceptada(data) {
    setAceptada(data)
    setTimeout(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}')
      navigate(stored.rol === 'medico' ? '/medico' : '/login')
    }, 1800)
  }

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card surface-raised">
          <div className="auth-logo">Agisad</div>
          <h2>Invitación no disponible</h2>
          <p className="auth-error">{error}</p>
          <p className="auth-footer"><Link to="/">Ir al inicio</Link></p>
        </div>
      </div>
    )
  }

  if (aceptada) {
    return (
      <div className="auth-page">
        <div className="auth-card surface-raised">
          <div className="auth-logo">Agisad</div>
          <h2>¡Listo!</h2>
          <p>Quedaste vinculado a <strong>{aceptada.clinica}</strong>. Te llevamos a tu panel...</p>
        </div>
      </div>
    )
  }

  if (!invitacion) {
    return (
      <div className="auth-page">
        <div className="auth-card surface-raised">
          <div className="auth-logo">Agisad</div>
          <p className="auth-sub">Cargando invitación...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide surface-raised">
        <div className="auth-logo">Agisad</div>
        <p className="auth-kicker">Invitación</p>
        <h2>{invitacion.gerente.nombre} {invitacion.gerente.apellido} te invitó a "{invitacion.clinica.nombre}"</h2>
        <p className="auth-sub">
          Vas a poder atender en esta clínica sin pagar membresía propia — la cubre {invitacion.gerente.nombre}.
        </p>

        <div className="auth-grid-2" style={{ marginBottom: '0.5rem' }}>
          <Button variant={modo === 'nuevo' ? 'primary' : 'secondary'} type="button" onClick={() => setModo('nuevo')}>
            Soy médico nuevo
          </Button>
          <Button variant={modo === 'existente' ? 'primary' : 'secondary'} type="button" onClick={() => setModo('existente')}>
            Ya tengo cuenta
          </Button>
        </div>

        {modo === 'nuevo'
          ? <InvitacionRegistroForm invitacion={invitacion} token={token} onAceptada={handleAceptada} />
          : <InvitacionLoginForm invitacion={invitacion} token={token} onAceptada={handleAceptada} />}
      </div>
    </div>
  )
}
