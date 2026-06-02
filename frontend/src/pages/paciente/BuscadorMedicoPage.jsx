import { useState } from 'react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Stethoscope } from 'lucide-react'
import { getDemoDoctors } from '../../mock/demoData'
import './BuscadorMedicoPage.css'

export default function BuscadorMedicoPage() {
  const [query, setQuery] = useState('')
  const [tick, setTick] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    const refresh = () => setTick(t => t + 1)
    window.addEventListener('agisad-demo-data-changed', refresh)
    return () => window.removeEventListener('agisad-demo-data-changed', refresh)
  }, [])

  const medicos = getDemoDoctors(tick)

  const resultados = medicos.filter(m =>
    m.nombre.toLowerCase().includes(query.toLowerCase()) ||
    m.especialidad.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="buscador-page">
      <div className="buscador-header">
        <h1>Buscá tu médico</h1>
        <p>Encontrá al profesional y realizá tu gestión: turno, receta o consulta.</p>
      </div>

      <div className="buscador-search surface-raised">
        <Search size={18} className="buscador-search-icon" />
        <input
          type="text"
          className="buscador-input"
          placeholder="Nombre del médico, especialidad o centro..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="buscador-resultados">
        {resultados.length === 0 && (
          <p className="buscador-empty">No se encontraron médicos con suscripción activa para tu búsqueda.</p>
        )}
        {resultados.map(medico => (
          <div key={medico.id} className="medico-card surface-raised">
            <div className="medico-card-info">
              <div className="medico-avatar"><Stethoscope size={24} /></div>
              <div>
                <h3>{medico.nombre}</h3>
                <p>{medico.especialidad} &middot; {medico.matricula}</p>
                <div className="medico-card-consultorios">
                  <MapPin size={13} />
                  {medico.consultorios.length ? medico.consultorios.join(' · ') : 'Sin consultorios cargados'}
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-md"
              onClick={() => navigate(`/paciente/medico/${medico.id}`)}
            >
              Seleccionar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
