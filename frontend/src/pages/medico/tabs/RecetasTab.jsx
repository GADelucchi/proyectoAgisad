import { useEffect, useState } from 'react'
import { medicosApi } from '../../../services/medicos.api'
import './RecetasTab.css'

function mapTipo(tipo) {
  return tipo === 'urgente' ? 'Urgente (24 h)' : 'Estandar (7 dias)'
}

export default function RecetasTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadRecetas() {
      setLoading(true)
      setError('')
      try {
        const data = await medicosApi.listMyRecetasSolicitudes()
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!cancelled) {
          setRows([])
          setError(err?.message || 'No se pudieron cargar las recetas solicitadas.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRecetas()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="recetas-tab surface-raised">
        <p className="recetas-empty">Cargando solicitudes de recetas...</p>
      </div>
    )
  }

  async function toggleEnviada(row) {
    const checked = row.estado === 'resuelta'
    const nextEstado = checked ? 'enviada' : 'resuelta'

    setSavingId(row.id_solicitud)
    try {
      await medicosApi.updateMyRecetaSolicitudEstado(row.id_solicitud, nextEstado)
      setRows((prev) => prev.map((r) => (
        r.id_solicitud === row.id_solicitud
          ? { ...r, estado: nextEstado }
          : r
      )))
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar el estado de la receta.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="recetas-tab">
      {error && <p className="auth-error">{error}</p>}

      {!error && rows.length === 0 && (
        <div className="surface-raised recetas-empty-wrap">
          <p className="recetas-empty">Todavia no hay solicitudes de recetas.</p>
        </div>
      )}

      {rows.map((row) => (
        <article
          key={row.id_solicitud}
          className={`surface-raised recetas-card ${row.estado === 'resuelta' ? 'recetas-card-resuelta' : 'recetas-card-pendiente'} ${row.tipo === 'urgente' ? 'recetas-card-urgente' : ''}`}
        >
          <div className="recetas-card-head">
            <div>
              <h3>
                {row.paciente_nombre} {row.paciente_apellido}
              </h3>
              <p>{mapTipo(row.tipo)} · {row.creado_en_iso || '-'}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.45rem' }}>
              <span className={`badge ${row.tipo === 'urgente' ? 'badge-error' : 'badge-muted'}`}>
                {row.tipo === 'urgente' ? 'Urgente' : 'Estandar'}
              </span>
              <label className="recetas-check-row">
                <input
                  type="checkbox"
                  checked={row.estado === 'resuelta'}
                  onChange={() => toggleEnviada(row)}
                  disabled={savingId === row.id_solicitud}
                />
                <span>{row.estado === 'resuelta' ? 'Receta enviada' : 'Marcar como enviada'}</span>
              </label>
            </div>
          </div>

          <div className="recetas-card-meta">
            <span>DNI: {row.paciente_dni || '-'}</span>
            <span>Telefono: {row.paciente_telefono || '-'}</span>
            <span>Email: {row.paciente_email || '-'}</span>
          </div>

          <div className="recetas-items">
            <strong>Medicamentos solicitados</strong>
            <ul>
              {(Array.isArray(row.items) ? row.items : []).map((item, idx) => (
                <li key={`${row.id_solicitud}-${idx}`}>
                  {item.medicamento}
                  {item.dosis ? <span> - {item.dosis}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  )
}
