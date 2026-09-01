import { useEffect, useState } from 'react'
import Button from '../../../components/ui/Button'
import { consultoriosApi } from '../../../services/consultorios.api'
import '../../medico/tabs/ConfiguracionTab.css'

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}

export default function SolicitudesTab({ onChange }) {
  const [solicitudes, setSolicitudes] = useState([])
  const [estado, setEstado] = useState('')

  async function cargar() {
    const rows = await consultoriosApi.listSolicitudesRecibidas().catch(() => [])
    setSolicitudes(Array.isArray(rows) ? rows : [])
  }

  useEffect(() => {
    cargar()
  }, [])

  async function resolver(idSolicitud, aprobar) {
    try {
      if (aprobar) {
        await consultoriosApi.aprobarSolicitud(idSolicitud)
        setEstado('Solicitud aprobada. El médico ya puede agendar en tu consultorio.')
      } else {
        const motivo = window.prompt('Motivo del rechazo (opcional):') || ''
        await consultoriosApi.rechazarSolicitud(idSolicitud, motivo)
        setEstado('Solicitud rechazada.')
      }
      await cargar()
      onChange?.()
    } catch (err) {
      setEstado(err?.message || 'No se pudo resolver la solicitud.')
    }
  }

  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente')
  const resueltas = solicitudes.filter((s) => s.estado !== 'pendiente')

  return (
    <div className="config-tab">
      <section className="config-section surface-raised">
        <h3>Solicitudes pendientes</h3>
        <p className="config-section-sub">
          Médicos que quieren alquilar alguno de tus consultorios. Al aprobar, quedan habilitados a reservar horarios.
        </p>

        {pendientes.length === 0 && <p className="config-turnos-empty">No hay solicitudes pendientes.</p>}

        {pendientes.map((s) => (
          <div key={s.id_solicitud} className="config-asistente-row">
            <div>
              <strong>{s.medico_nombre} {s.medico_apellido}</strong>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {s.especialidad || 'Sin especialidad'} · {s.matricula} · {s.medico_email}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Consultorio: {s.clinica_nombre} · {s.creado_en}
              </p>
              {s.mensaje && (
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>“{s.mensaje}”</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <Button size="sm" onClick={() => resolver(s.id_solicitud, true)}>Aprobar</Button>
              <Button size="sm" variant="danger" onClick={() => resolver(s.id_solicitud, false)}>Rechazar</Button>
            </div>
          </div>
        ))}
      </section>

      {resueltas.length > 0 && (
        <section className="config-section surface-raised">
          <h3>Historial de solicitudes</h3>
          {resueltas.map((s) => (
            <div key={s.id_solicitud} className="config-asistente-row">
              <div>
                <strong>{s.medico_nombre} {s.medico_apellido}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {s.clinica_nombre} · {ESTADO_LABEL[s.estado] || s.estado}
                  {s.motivo_rechazo ? ` · ${s.motivo_rechazo}` : ''}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {estado && <p className="config-terms-msg">{estado}</p>}
    </div>
  )
}
