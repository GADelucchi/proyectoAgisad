import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import PasswordInput from '../../components/ui/PasswordInput'
import SmartDateInput from '../../components/ui/SmartDateInput'
import { authApi } from '../../services/auth.api'
import { ApiError } from '../../services/apiClient'
import './AuthPages.css'

export default function RegistroPacientePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    fechaNacimiento: '',
    codPais: '+549',
    telefono: '',
    email: '',
    obraSocial: '',
    nroAfiliado: '',
    password: '',
    confirmar: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  function validate() {
    if (!form.nombre || !form.apellido) return 'Completá nombre y apellido.'
    if (!form.dni || !/^\d{7,8}$/.test(form.dni)) return 'DNI inválido (7 u 8 dígitos).'
    if (!form.fechaNacimiento) return 'Ingresá fecha de nacimiento.'
    if (!form.telefono) return 'Ingresá un teléfono.'
    if (!form.email || !form.email.includes('@')) return 'Email inválido.'
    if (!form.password || form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    if (form.password !== form.confirmar) return 'Las contraseñas no coinciden.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true)
    try {
      const username = (form.email.split('@')[0] || 'paciente').toLowerCase()
      await authApi.registerPaciente({
        username,
        email: form.email,
        password: form.password,
        dni: form.dni,
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: `${form.codPais}${form.telefono}`,
        fecha_nac: form.fechaNacimiento || null,
        obra_social: form.obraSocial || null,
        nro_obra_social: form.nroAfiliado || null,
        acepta_tyc: true,
      })
      navigate('/verificar-email')
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
        <p className="auth-kicker">Registro de paciente</p>
        <h2>Crear cuenta de paciente</h2>
        <p className="auth-sub">Completá tus datos para registrarte y empezar a sacar turnos.</p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" className="form-input" placeholder="Ej: María" value={form.nombre} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="apellido">Apellido</label>
              <input id="apellido" name="apellido" type="text" className="form-input" placeholder="Ej: García" value={form.apellido} onChange={handleChange} />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="dni">DNI</label>
              <input id="dni" name="dni" type="text" className="form-input" placeholder="Ej: 40123456" value={form.dni} onChange={handleChange} inputMode="numeric" />
              <small className="auth-help">Sin puntos, barras ni guiones.</small>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="fechaNacimiento">Fecha de nacimiento</label>
              <SmartDateInput id="fechaNacimiento" name="fechaNacimiento" value={form.fechaNacimiento} onChange={handleChange} />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="codPais">Código de país</label>
              <select id="codPais" name="codPais" className="form-select" value={form.codPais} onChange={handleChange}>
                <option value="+549">Argentina (+549)</option>
                <option value="+598">Uruguay (+598)</option>
                <option value="+56">Chile (+56)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" type="tel" className="form-input" placeholder="1144445566" value={form.telefono} onChange={handleChange} inputMode="numeric" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="form-input" placeholder="tu@email.com" value={form.email} onChange={handleChange} />
          </div>

          <div className="auth-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="obraSocial">Obra social</label>
              <input id="obraSocial" name="obraSocial" type="text" className="form-input" placeholder="Ej: OSDE, IOMA" value={form.obraSocial} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="nroAfiliado">Nro. de afiliado</label>
              <input id="nroAfiliado" name="nroAfiliado" type="text" className="form-input" placeholder="Sin puntos ni guiones" value={form.nroAfiliado} onChange={handleChange} />
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
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
        </form>

        <p className="auth-footer">
          ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}