import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="container" style={{ padding: '4rem 1.25rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>Página no encontrada</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        El enlace que seguiste no existe o dejó de estar disponible.
      </p>
      <Link to="/"><Button>Volver al inicio</Button></Link>
    </div>
  )
}
