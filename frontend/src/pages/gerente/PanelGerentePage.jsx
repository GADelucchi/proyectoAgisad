import { Link } from 'react-router-dom'

export default function PanelGerentePage() {
  return (
    <div className="page-shell">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        <div className="surface-raised" style={{ padding: '2rem' }}>
          <p className="auth-kicker">Panel gerente</p>
          <h1>Tu panel de gestión está listo para completarse</h1>
          <p>
            Ya podés registrar la cuenta de gerente y crear la primera clínica. El próximo paso es sumar
            gestión de clínicas, médicos y asistentes desde este panel.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            <Link to="/" className="btn btn-secondary btn-md">Ir al inicio</Link>
            <Link to="/login" className="btn btn-primary btn-md">Cerrar / volver a login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}