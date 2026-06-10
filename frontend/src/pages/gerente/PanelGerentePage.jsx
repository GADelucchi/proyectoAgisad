import { Link } from 'react-router-dom'
import { useState } from 'react'
import AltaAsistenteForm from '../../components/forms/AltaAsistenteForm'
import { authApi } from '../../services/auth.api'

export default function PanelGerentePage() {
  const [asistentesCreados, setAsistentesCreados] = useState([])

  async function crearAsistente(payload) {
    const response = await authApi.registerAsistente(payload)
    const nuevo = {
      id: response?.id_asistente || Date.now(),
      nombre: `${payload.nombre} ${payload.apellido}`,
      usuario: response?.username || payload.username || payload.email.split('@')[0],
      estado: payload.permisos?.bloqueado ? 'bloqueada' : 'activa',
    }
    setAsistentesCreados((prev) => [nuevo, ...prev])
    return response
  }

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

        <AltaAsistenteForm
          title="Alta de asistente"
          subtitle="Vinculalo a una o varias clínicas usando sus IDs por ahora."
          allowManualClinicIds
          onCreate={crearAsistente}
        />

        {asistentesCreados.length > 0 && (
          <div className="surface-raised" style={{ padding: '1.5rem', marginTop: '1rem' }}>
            <h2 style={{ marginTop: 0 }}>Asistentes creados recientemente</h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {asistentesCreados.map((asistente) => (
                <div key={asistente.id} className="surface" style={{ padding: '0.9rem 1rem' }}>
                  <strong>{asistente.nombre}</strong>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
                    Usuario: {asistente.usuario} · Estado: {asistente.estado}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}