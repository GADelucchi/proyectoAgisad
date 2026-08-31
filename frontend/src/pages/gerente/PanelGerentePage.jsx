import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AltaAsistenteForm from '../../components/forms/AltaAsistenteForm'
import Button from '../../components/ui/Button'
import { authApi } from '../../services/auth.api'
import { gerentesApi } from '../../services/gerentes.api'
import { ApiError } from '../../services/apiClient'

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  revocada: 'Revocada',
  expirada: 'Expirada',
}

export default function PanelGerentePage() {
  const [asistentesCreados, setAsistentesCreados] = useState([])
  const [clinicas, setClinicas] = useState([])
  const [invitaciones, setInvitaciones] = useState([])
  const [medicosEquipo, setMedicosEquipo] = useState([])
  const [emailInvitar, setEmailInvitar] = useState('')
  const [clinicaInvitar, setClinicaInvitar] = useState('')
  const [invitarError, setInvitarError] = useState('')
  const [invitarLoading, setInvitarLoading] = useState(false)
  const [ultimoLink, setUltimoLink] = useState('')

  // Refresco reusable, disparado por acciones del usuario (no por el efecto de montaje).
  async function cargarTodo() {
    try {
      const [misClinicas, misInvitaciones, miEquipo] = await Promise.all([
        gerentesApi.listMisClinicas(),
        gerentesApi.listInvitaciones(),
        gerentesApi.listMedicosEquipo(),
      ])
      setClinicas(Array.isArray(misClinicas) ? misClinicas : [])
      setInvitaciones(Array.isArray(misInvitaciones) ? misInvitaciones : [])
      setMedicosEquipo(Array.isArray(miEquipo) ? miEquipo : [])
      setClinicaInvitar((prev) => prev || misClinicas?.[0]?.id_clinica || '')
    } catch {
      // el panel sigue usable aunque falle el refresco
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const [misClinicas, misInvitaciones, miEquipo] = await Promise.all([
          gerentesApi.listMisClinicas(),
          gerentesApi.listInvitaciones(),
          gerentesApi.listMedicosEquipo(),
        ])
        if (!cancelled) {
          setClinicas(Array.isArray(misClinicas) ? misClinicas : [])
          setInvitaciones(Array.isArray(misInvitaciones) ? misInvitaciones : [])
          setMedicosEquipo(Array.isArray(miEquipo) ? miEquipo : [])
          setClinicaInvitar((prev) => prev || misClinicas?.[0]?.id_clinica || '')
        }
      } catch {
        // el panel sigue usable aunque falle la carga inicial
      }
    }

    loadData()

    return () => { cancelled = true }
  }, [])

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

  async function handleInvitar(e) {
    e.preventDefault()
    setInvitarError('')
    if (!clinicaInvitar) { setInvitarError('Elegí una clínica.'); return }
    if (!emailInvitar || !emailInvitar.includes('@')) { setInvitarError('Ingresá un email válido.'); return }

    setInvitarLoading(true)
    try {
      const data = await gerentesApi.crearInvitacion({ id_clinica: clinicaInvitar, email: emailInvitar })
      setUltimoLink(data.link)
      setEmailInvitar('')
      await cargarTodo()
    } catch (err) {
      setInvitarError(err instanceof ApiError ? err.message : 'No se pudo crear la invitación.')
    } finally {
      setInvitarLoading(false)
    }
  }

  async function handleRevocar(idInvitacion) {
    try {
      await gerentesApi.revocarInvitacion(idInvitacion)
      await cargarTodo()
    } catch {
      // sin feedback bloqueante: la lista se refresca igual en el próximo intento
    }
  }

  async function handleDesvincular(idMedico, idClinica) {
    try {
      await gerentesApi.desvincularMedico(idMedico, idClinica)
      await cargarTodo()
    } catch {
      // idem
    }
  }

  return (
    <div className="page-shell">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem', display: 'grid', gap: '1rem' }}>

        <div className="surface-raised" style={{ padding: '2rem' }}>
          <p className="auth-kicker">Panel gerente</p>
          <h1>Mi clínica</h1>
          {clinicas.length === 0 ? (
            <p>No tenés clínicas cargadas todavía.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
              {clinicas.map((c) => (
                <div key={c.id_clinica} className="surface" style={{ padding: '0.9rem 1rem' }}>
                  <strong>{c.nombre}</strong>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>{c.direccion || 'Sin dirección cargada'}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            <Link to="/" className="btn btn-secondary btn-md">Ir al inicio</Link>
            <Link to="/login" className="btn btn-primary btn-md">Cerrar / volver a login</Link>
          </div>
        </div>

        <div className="surface-raised" style={{ padding: '2rem' }}>
          <h2 style={{ marginTop: 0 }}>Invitar médico</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            El médico invitado atiende en tu clínica sin pagar membresía propia — la cubre tu plan.
            Si ya tiene su propia membresía en otra clínica, no se toca.
          </p>
          <form onSubmit={handleInvitar} className="auth-grid-2" style={{ alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="clinicaInvitar">Clínica</label>
              <select id="clinicaInvitar" className="form-select" value={clinicaInvitar} onChange={(e) => setClinicaInvitar(e.target.value)}>
                {clinicas.map((c) => <option key={c.id_clinica} value={c.id_clinica}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="emailInvitar">Email del médico</label>
              <input
                id="emailInvitar"
                type="email"
                className="form-input"
                placeholder="medico@email.com"
                value={emailInvitar}
                onChange={(e) => { setEmailInvitar(e.target.value); setInvitarError('') }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {invitarError && <p className="auth-error" style={{ marginBottom: '0.75rem' }}>{invitarError}</p>}
              <Button type="submit" disabled={invitarLoading}>
                {invitarLoading ? 'Enviando...' : 'Enviar invitación'}
              </Button>
            </div>
          </form>
          {ultimoLink && (
            <p style={{ marginTop: '1rem', wordBreak: 'break-all' }}>
              Link generado (por si el mail no llega): <code>{ultimoLink}</code>
            </p>
          )}
        </div>

        <div className="surface-raised" style={{ padding: '2rem' }}>
          <h2 style={{ marginTop: 0 }}>Invitaciones enviadas</h2>
          {invitaciones.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Todavía no enviaste ninguna.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {invitaciones.map((inv) => (
                <div key={inv.id_invitacion} className="surface" style={{ padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong>{inv.email_invitado}</strong>
                    <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)' }}>{inv.clinica_nombre} · {ESTADO_LABEL[inv.estado] || inv.estado}</p>
                  </div>
                  {inv.estado === 'pendiente' && (
                    <Button variant="danger" size="sm" type="button" onClick={() => handleRevocar(inv.id_invitacion)}>
                      Revocar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="surface-raised" style={{ padding: '2rem' }}>
          <h2 style={{ marginTop: 0 }}>Médicos del equipo</h2>
          {medicosEquipo.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Todavía no hay médicos vinculados.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {medicosEquipo.map((m) => (
                <div key={`${m.id_medico}-${m.id_clinica}`} className="surface" style={{ padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong>{m.nombre} {m.apellido}</strong>
                    <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)' }}>{m.matricula} · {m.clinica_nombre}</p>
                  </div>
                  <Button variant="ghost" size="sm" type="button" onClick={() => handleDesvincular(m.id_medico, m.id_clinica)}>
                    Desvincular
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <AltaAsistenteForm
          title="Alta de asistente"
          subtitle="Vinculalo a una o varias clínicas usando sus IDs por ahora."
          allowManualClinicIds
          onCreate={crearAsistente}
        />

        {asistentesCreados.length > 0 && (
          <div className="surface-raised" style={{ padding: '1.5rem' }}>
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
