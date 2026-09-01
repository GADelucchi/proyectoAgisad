import { useEffect, useState } from 'react'
import Button from '../../../components/ui/Button'
import { consultoriosApi } from '../../../services/consultorios.api'
import '../../medico/tabs/ConfiguracionTab.css'

function primerDiaDelMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function hoyIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ReporteUsoTab() {
  const [consultorios, setConsultorios] = useState([])
  const [idClinica, setIdClinica] = useState('')
  const [desde, setDesde] = useState(primerDiaDelMes())
  const [hasta, setHasta] = useState(hoyIso())
  const [reporte, setReporte] = useState(null)
  const [estado, setEstado] = useState('')

  useEffect(() => {
    consultoriosApi.listMios()
      .then((rows) => {
        const lista = Array.isArray(rows) ? rows : []
        setConsultorios(lista)
        if (lista.length > 0) setIdClinica(String(lista[0].id_clinica))
      })
      .catch(() => setConsultorios([]))
  }, [])

  async function generar() {
    if (!idClinica) {
      setEstado('Elegí un consultorio.')
      return
    }
    setEstado('')
    try {
      const data = await consultoriosApi.reporteUso(idClinica, { desde, hasta })
      setReporte(data)
    } catch (err) {
      setReporte(null)
      setEstado(err?.message || 'No se pudo generar el reporte.')
    }
  }

  return (
    <div className="config-tab">
      <section className="config-section surface-raised">
        <h3>Reporte de uso</h3>
        <p className="config-section-sub">
          Horas reservadas por cada médico en el período, para calcular el alquiler a cobrar.
          No incluye turnos cancelados.
        </p>

        <div className="config-turnos-header">
          <div className="form-group" style={{ margin: 0, minWidth: '220px' }}>
            <label className="form-label" htmlFor="rep-consultorio">Consultorio</label>
            <select
              id="rep-consultorio"
              className="form-select"
              value={idClinica}
              onChange={(e) => setIdClinica(e.target.value)}
            >
              {consultorios.map((c) => (
                <option key={c.id_clinica} value={c.id_clinica}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="rep-desde">Desde</label>
            <input id="rep-desde" type="date" className="form-input" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="rep-hasta">Hasta</label>
            <input id="rep-hasta" type="date" className="form-input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button size="sm" onClick={generar}>Generar</Button>
        </div>

        {reporte && (
          <>
            <div className="config-asistente-row">
              <div>
                <strong>Total del período</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {reporte.desde} al {reporte.hasta}
                </p>
              </div>
              <strong>{Number(reporte.total_horas || 0).toFixed(2)} h</strong>
            </div>

            {reporte.medicos.length === 0 && (
              <p className="config-turnos-empty">No hubo reservas en ese período.</p>
            )}

            {reporte.medicos.map((m) => (
              <div key={m.id_medico} className="config-asistente-row">
                <div>
                  <strong>{m.medico_nombre} {m.medico_apellido}</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {m.turnos} turno{Number(m.turnos) === 1 ? '' : 's'}
                  </p>
                </div>
                <strong>{Number(m.horas).toFixed(2)} h</strong>
              </div>
            ))}
          </>
        )}

        {estado && <p className="config-terms-msg">{estado}</p>}
      </section>
    </div>
  )
}
