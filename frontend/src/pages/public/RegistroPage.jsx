import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import './AuthPages.css'

const CARDS = [
  {
    role: 'paciente',
    title: 'Paciente',
    description: 'Buscá médicos, sacá turnos y gestioná tu historial.',
    bullets: ['Alta rápida', 'Sin membresía', 'Email y datos básicos'],
    to: '/registro/paciente',
    cta: 'Crear cuenta de paciente',
  },
  {
    role: 'medico',
    title: 'Médico',
    description: 'Registrate con tu matrícula y elegí tu membresía profesional.',
    bullets: ['Matrícula y especialidad', 'Perfil profesional', 'Plan de membresía'],
    to: '/registro/medico',
    cta: 'Crear cuenta de médico',
  },
  {
    role: 'gerente',
    title: 'Gerente',
    description: 'Abrí tu cuenta para administrar una o más clínicas.',
    bullets: ['Datos del responsable', 'Alta de clínica', 'Plan de gestión'],
    to: '/registro/gerente',
    cta: 'Crear cuenta de gerente',
  },
]

export default function RegistroPage() {
  return (
    <div className="auth-page auth-page-selector">
      <div className="auth-card auth-card-wide surface-raised registro-selector-card">
        <div className="auth-logo">Agisad</div>
        <p className="auth-kicker">Registro</p>
        <h2>Elegí cómo querés crear tu cuenta</h2>
        <p className="auth-sub">
          Cada tipo de usuario tiene un onboarding distinto. Elegí el que corresponde y completá tus datos.
        </p>

        <div className="registro-selector-grid">
          {CARDS.map(card => (
            <article key={card.role} className="registro-option surface">
              <div className="registro-option-head">
                <span className={`badge badge-primary`}>{card.role}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
              <ul className="registro-option-list">
                {card.bullets.map(item => <li key={item}>{item}</li>)}
              </ul>
              <Link to={card.to} className="btn btn-primary btn-md registro-option-cta">
                {card.cta}
              </Link>
            </article>
          ))}
        </div>

        <div className="registro-selector-footer">
          <p className="auth-footer">
            ¿Ya tenés una cuenta? <Link to="/login">Iniciar sesión</Link>
          </p>
          <Button variant="secondary" type="button" onClick={() => window.location.assign('/') }>
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  )
}
