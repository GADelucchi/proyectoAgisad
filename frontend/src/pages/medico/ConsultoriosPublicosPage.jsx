import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { consultoriosApi } from '../../services/consultorios.api'
import './tabs/ConfiguracionTab.css'

const ESTADO_LABEL = {
  pendiente: 'Solicitud pendiente',
  aprobada: 'Vinculado',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}

export default function ConsultoriosPublicosPage() {
  const navigate = useNavigate()
  const [consultorios, setConsultorios] = useState([])
  const [misSolicitudes, setMisSolicitudes] = useState([])
  const [estado, setEstado] = useState('')

  async function cargar() {
    const [publicos, propias] = await Promise.all([
      consultoriosApi.listPublicos().catch(() => []),
      consultoriosApi.listMisSolicitudes().catch(() => []),
    ])
    setConsultorios(Array.isArray(publicos) ? publicos : [])
    setMisSolicitudes(Array.isArray(propias) ? propias : [])
  }

  useEffect(() => {
    cargar()
  }, [])

  function estadoDe(idClinica) {
    const s = misSolicitudes.find((x) => Number(x.id_clinica) === Number(idClinica))
    return s?.estado || null
  }

  async function solicitar(idClinica) {
    const mensaje = window.prompt('Contale al dueño qué días/horarios necesitás (opcional):') || ''
    try {
      await consultoriosApi.solicitar(idClinica, mensaje)
      setEstado('Solicitud enviada. Te avisamos cuando el dueño la responda.')
      await cargar()
    } catch (err) {
      setEstado(err?.message || 'No se pudo enviar la solicitud.')
    }
  }

  return (
    <div className="config-tab" style={{ padding: '1.5rem 0' }}>
      <section className="config-section surface-raised">
        <div className="config-section-header">
          <h3>Consultorios en alquiler</h3>
          <Button size="sm" variant="secondary" onClick={() => navigate('/medico')}>Volver al panel</Button>
        </div>
        <p className="config-section-sub">
          Espacios publicados por sus dueños. Pedí vincularte y, cuando te aprueben,
          vas a poder agendar tus turnos ahí como en cualquier consultorio propio.
        </p>

        {consultorios.length === 0 && (
          <p className="config-turnos-empty">Por ahora no hay consultorios publicados.</p>
        )}

        {consultorios.map((c) => {
          const estadoSolicitud = estadoDe(c.id_clinica)
          return (
            <div key={c.id_clinica} className="config-asistente-row">
              <div>
                <strong>{c.nombre}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {c.direccion}{c.ciudad ? `, ${c.ciudad}` : ''}
                  {c.telefono ? ` · ${c.telefono}` : ''}
                </p>
              </div>
              {estadoSolicitud ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {ESTADO_LABEL[estadoSolicitud] || estadoSolicitud}
                </span>
              ) : (
                <Button size="sm" onClick={() => solicitar(c.id_clinica)}>Solicitar</Button>
              )}
            </div>
          )
        })}

        {estado && <p className="config-terms-msg">{estado}</p>}
      </section>
    </div>
  )
}
