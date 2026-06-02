import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import './AuthPages.css'

export default function VerificarEmailPage() {
  return (
    <div className="auth-page">
      <div className="auth-card surface-raised" style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}>
          <MailCheck size={52} />
        </div>
        <h2>Verificá tu email</h2>
        <p>
          Te enviamos un link de confirmación a tu casilla de correo.<br />
          Hacé clic en el link para activar tu cuenta.
        </p>
        <p style={{ fontSize: '0.85rem', marginTop: '1.5rem' }}>
          ¿No llegó? Revisá la carpeta de spam o{' '}
          <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}>
            reenviá el email
          </button>
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/login">Volver al inicio de sesión</Link>
        </p>
      </div>
    </div>
  )
}
