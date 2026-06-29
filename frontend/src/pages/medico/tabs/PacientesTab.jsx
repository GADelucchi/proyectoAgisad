import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../../context/AuthContext'
import { turnosApi } from '../../../services/turnos.api'
import './PacientesTab.css'

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function PacientesTab() {
  const { usuario } = useAuth()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const isMedico = usuario?.rol === 'medico'

  async function load() {
    if (!isMedico || !usuario?.idUsuario) return
    setLoading(true)
    try {
      const today = new Date()
      const desde = toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1))
      const hasta = toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0))
      const turnos = await turnosApi.listarPorMedico({ desde, hasta })
      setRows(Array.isArray(turnos) ? turnos : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [isMedico, usuario?.idUsuario])

  const pacientes = useMemo(() => {
    const byName = new Map()
    for (const t of rows) {
      const nombre = `${t.paciente_nombre || ''} ${t.paciente_apellido || ''}`.trim() || 'Paciente'
      if (!byName.has(nombre)) {
        byName.set(nombre, {
          id: nombre,
          nombre,
          dni: '-',
          telefono: '-',
          obraSocial: '-',
        })
      }
    }
    return Array.from(byName.values())
  }, [rows])

  const filtrados = pacientes.filter((p) => p.nombre.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="pacientes-tab">
      <div className="pacientes-header">
        <div>
          <h3>Base de pacientes</h3>
          <p>Listado obtenido desde turnos registrados en la base de datos.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      <div className="pacientes-search surface-raised">
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          className="buscador-input"
          placeholder="Buscar por nombre..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="surface-raised">
        <p style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          Mostrando {filtrados.length} de {pacientes.length} pacientes
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Telefono</th>
              <th>Obra social</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.nombre}</td>
                <td>{p.dni}</td>
                <td>{p.telefono}</td>
                <td>{p.obraSocial}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <Button variant="ghost" size="sm" disabled>Historial</Button>
                    <Button variant="ghost" size="sm" disabled>Editar</Button>
                    <Button variant="danger" size="sm" disabled>Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
