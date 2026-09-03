import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Users, Building2, CalendarDays, Activity } from 'lucide-react'
import { adminApi } from '../../services/admin.api'
import './PanelAdminPage.css'

const ROLES = ['', 'admin', 'paciente', 'medico', 'asistente', 'gerente']
const SUSCRIPCIONES = ['', 'activa', 'cancelada', 'vencida', 'inexistente']
const PLAN_OPTIONS = ['', 'inicial', 'medio', 'profesional', 'empresarial']
const PAYMENT_METHODS = ['manual', 'transferencia', 'tarjeta', 'mercadopago', 'otro']

function formatMoney(value) {
  const num = Number(value || 0)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(num)
}

function EstadoBadge({ estado }) {
  const css = estado === 'activa'
    ? 'badge-success'
    : estado === 'cancelada' || estado === 'vencida'
      ? 'badge-warning'
      : 'badge-muted'

  return <span className={`badge ${css}`}>{estado || 'inexistente'}</span>
}

function KeyValue({ label, value }) {
  return (
    <div className="admin-kv">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )
}

export default function PanelAdminPage() {
  const [tab, setTab] = useState('usuarios')
  const [filters, setFilters] = useState({ q: '', rol: '', suscripcion: '' })
  const [usuarios, setUsuarios] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [finanzas, setFinanzas] = useState({ resumen: null, mensual: [], movimientos: [] })
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [loadingFinanzas, setLoadingFinanzas] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const [reactivateForm, setReactivateForm] = useState({
    plan: '',
    metodo: 'manual',
    monto: '',
    referencia_externa: '',
  })
  const [error, setError] = useState('')

  async function loadUsuarios() {
    setLoadingUsuarios(true)
    setError('')
    try {
      const rows = await adminApi.listUsuarios(filters)
      setUsuarios(rows)

      if (!selectedId && rows[0]?.id_usuario) {
        setSelectedId(rows[0].id_usuario)
      }

      if (selectedId && !rows.find(r => r.id_usuario === selectedId)) {
        setSelectedId(rows[0]?.id_usuario || null)
      }
    } catch (err) {
      setError(err?.message || 'No se pudo cargar usuarios admin.')
    } finally {
      setLoadingUsuarios(false)
    }
  }

  async function loadDetalle(idUsuario) {
    if (!idUsuario) {
      setDetalle(null)
      return
    }
    setLoadingDetalle(true)
    setError('')
    try {
      const data = await adminApi.getUsuarioDetalle(idUsuario)
      setDetalle(data)
    } catch (err) {
      setError(err?.message || 'No se pudo cargar detalle de usuario.')
    } finally {
      setLoadingDetalle(false)
    }
  }

  async function loadFinanzas() {
    setLoadingFinanzas(true)
    setError('')
    try {
      const data = await adminApi.getFinanzas()
      setFinanzas(data)
    } catch (err) {
      setError(err?.message || 'No se pudo cargar finanzas.')
    } finally {
      setLoadingFinanzas(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsuarios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.rol, filters.suscripcion])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDetalle(selectedId)
  }, [selectedId])

  useEffect(() => {
    // Precarga el monto con plan + adicionales para que no haya que sumarlo a mano.
    const total = Number(detalle?.suscripcion?.total_a_cobrar || 0)
    setReactivateForm((prev) => ({
      ...prev,
      plan: String(detalle?.suscripcion?.plan || '').toLowerCase(),
      monto: total > 0 ? String(total) : '',
    }))
  }, [detalle?.suscripcion?.plan, detalle?.suscripcion?.total_a_cobrar])

  useEffect(() => {
    if (tab === 'finanzas') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadFinanzas()
    }
  }, [tab])

  const kpis = useMemo(() => {
    const total = usuarios.length
    const activos = usuarios.filter(u => Number(u.activo) === 1).length
    const conSuscripcion = usuarios.filter(u => u.suscripcion_estado && u.suscripcion_estado !== 'inexistente').length
    const clinicas = detalle?.relaciones?.clinicas?.length || 0

    return [
      { label: 'Usuarios visibles', value: String(total), icon: Users, hint: 'Según filtros actuales' },
      { label: 'Activos', value: String(activos), icon: Activity, hint: 'Cuenta habilitada' },
      { label: 'Con suscripción', value: String(conSuscripcion), icon: CalendarDays, hint: 'Activa / cancelada / vencida' },
      { label: 'Clínicas vinculadas', value: String(clinicas), icon: Building2, hint: 'Del usuario seleccionado' },
    ]
  }, [usuarios, detalle])

  async function handleReactivateMembership() {
    if (!detalle?.usuario?.id_usuario) return

    setReactivating(true)
    setError('')
    try {
      await adminApi.reactivateMembership({
        id_usuario: detalle.usuario.id_usuario,
        plan: reactivateForm.plan || null,
        metodo: reactivateForm.metodo,
        monto: reactivateForm.monto === '' ? null : Number(reactivateForm.monto),
        referencia_externa: reactivateForm.referencia_externa || null,
      })

      await Promise.all([loadDetalle(detalle.usuario.id_usuario), loadUsuarios()])
    } catch (err) {
      setError(err?.message || 'No se pudo reactivar la membresía.')
    } finally {
      setReactivating(false)
    }
  }

  return (
    <div className="admin-dashboard">
      <section className="admin-hero surface-raised">
        <div>
          <span className="admin-kicker"><ShieldCheck size={16} /> Administración general</span>
          <h1>Panel global de Agisad</h1>
          <p>
            Gestión central de usuarios, membresías y finanzas de toda la app.
          </p>
        </div>
        <div className="admin-tabs">
          <button className={`btn btn-md ${tab === 'usuarios' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('usuarios')}>
            Usuarios
          </button>
          <button className={`btn btn-md ${tab === 'finanzas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('finanzas')}>
            Finanzas
          </button>
        </div>
      </section>

      <section className="admin-kpis">
        {kpis.map(card => {
          const Icon = card.icon
          return (
            <article key={card.label} className="admin-kpi surface-raised">
              <div className="admin-kpi-icon"><Icon size={18} /></div>
              <span className="admin-kpi-value">{card.value}</span>
              <span className="admin-kpi-label">{card.label}</span>
              <p>{card.hint}</p>
            </article>
          )
        })}
      </section>

      {error && <p className="auth-error">{error}</p>}

      {tab === 'usuarios' && (
        <section className="admin-users-layout">
          <article className="surface-raised admin-card admin-users-list">
            <div className="admin-filters">
              <input
                className="form-input"
                placeholder="Buscar por email, username o nombre..."
                value={filters.q}
                onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
              />
              <select className="form-select" value={filters.rol} onChange={(e) => setFilters(prev => ({ ...prev, rol: e.target.value }))}>
                {ROLES.map(r => <option key={r || 'all'} value={r}>{r || 'Todos los roles'}</option>)}
              </select>
              <select className="form-select" value={filters.suscripcion} onChange={(e) => setFilters(prev => ({ ...prev, suscripcion: e.target.value }))}>
                {SUSCRIPCIONES.map(s => <option key={s || 'all'} value={s}>{s || 'Todas las suscripciones'}</option>)}
              </select>
            </div>

            {loadingUsuarios ? <p>Cargando usuarios...</p> : (
              <div className="admin-users-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Rol</th>
                      <th>Suscripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr
                        key={u.id_usuario}
                        className={selectedId === u.id_usuario ? 'admin-row-selected' : ''}
                        onClick={() => setSelectedId(u.id_usuario)}
                      >
                        <td>
                          <strong>{u.nombre}</strong>
                          <div className="admin-row-sub">{u.email}</div>
                        </td>
                        <td>{u.rol}</td>
                        <td><EstadoBadge estado={u.suscripcion_estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="surface-raised admin-card admin-users-detail">
            {loadingDetalle && <p>Cargando detalle...</p>}
            {!loadingDetalle && !detalle && <p>Seleccioná un usuario para ver su detalle.</p>}
            {!loadingDetalle && detalle && (
              <>
                <h2>Detalle completo del usuario</h2>
                <div className="admin-kv-grid">
                  <KeyValue label="ID" value={detalle.usuario.id_usuario} />
                  <KeyValue label="Rol" value={detalle.usuario.rol} />
                  <KeyValue label="Email" value={detalle.usuario.email} />
                  <KeyValue label="Username" value={detalle.usuario.username} />
                  <KeyValue label="Activo" value={Number(detalle.usuario.activo) ? 'Sí' : 'No'} />
                  <KeyValue label="Email verificado" value={Number(detalle.usuario.email_verificado) ? 'Sí' : 'No'} />
                </div>

                <h3>Suscripción</h3>
                <div className="admin-kv-grid">
                  <KeyValue label="Estado" value={detalle.suscripcion.estado} />
                  <KeyValue label="Plan" value={detalle.suscripcion.plan} />
                  <KeyValue label="Inicio" value={detalle.suscripcion.fecha_inicio} />
                  <KeyValue label="Fin" value={detalle.suscripcion.fecha_fin} />
                  <KeyValue label="Pagado hasta" value={detalle.suscripcion.pagado_hasta} />
                  <KeyValue label="Monto mensual" value={detalle.suscripcion.monto_mensual ? formatMoney(detalle.suscripcion.monto_mensual) : '—'} />
                </div>

                {(detalle.suscripcion.adicionales?.length > 0) && (
                  <div className="surface" style={{ padding: '0.85rem', marginTop: '0.6rem' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Adicionales contratados</h4>
                    {detalle.suscripcion.adicionales.map((a, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.3rem' }}>
                        <span>{a.concepto} <span style={{ color: 'var(--text-muted)' }}>· desde {a.activado_en}</span></span>
                        <strong>{formatMoney(a.monto_mensual)}</strong>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                      <strong>Total a cobrar por mes</strong>
                      <strong>{formatMoney(detalle.suscripcion.total_a_cobrar)}</strong>
                    </div>
                  </div>
                )}

                {['medico', 'gerente'].includes(detalle.usuario.rol) && (
                  <div className="surface" style={{ padding: '1rem', marginTop: '0.75rem' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '0.65rem' }}>Validar pago y reactivar membresía</h4>
                    <div className="admin-kv-grid" style={{ marginBottom: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="reactivarPlan">Plan</label>
                        <select
                          id="reactivarPlan"
                          className="form-select"
                          value={reactivateForm.plan}
                          onChange={(e) => setReactivateForm((prev) => ({ ...prev, plan: e.target.value }))}
                        >
                          {PLAN_OPTIONS.map((plan) => (
                            <option key={plan || 'actual'} value={plan}>{plan || 'Mantener plan actual'}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="reactivarMetodo">Método</label>
                        <select
                          id="reactivarMetodo"
                          className="form-select"
                          value={reactivateForm.metodo}
                          onChange={(e) => setReactivateForm((prev) => ({ ...prev, metodo: e.target.value }))}
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="reactivarMonto">Monto a cobrar (plan + adicionales)</label>
                        <input
                          id="reactivarMonto"
                          className="form-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={reactivateForm.monto}
                          onChange={(e) => setReactivateForm((prev) => ({ ...prev, monto: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="reactivarRef">Referencia (opcional)</label>
                        <input
                          id="reactivarRef"
                          className="form-input"
                          type="text"
                          value={reactivateForm.referencia_externa}
                          onChange={(e) => setReactivateForm((prev) => ({ ...prev, referencia_externa: e.target.value }))}
                        />
                      </div>
                    </div>

                    <button
                      className="btn btn-md btn-primary"
                      type="button"
                      disabled={reactivating}
                      onClick={handleReactivateMembership}
                    >
                      {reactivating ? 'Procesando...' : 'Validar pago y reactivar (30 días)'}
                    </button>
                  </div>
                )}

                <h3>Perfil</h3>
                <div className="admin-kv-grid">
                  {Object.entries(detalle.perfil || {}).map(([key, value]) => (
                    <KeyValue key={key} label={key.replaceAll('_', ' ')} value={value} />
                  ))}
                </div>

                <h3>Relaciones</h3>
                {Object.keys(detalle.relaciones || {}).length === 0 && <p>Sin relaciones adicionales para este rol.</p>}
                {Object.entries(detalle.relaciones || {}).map(([nombre, rows]) => (
                  <div key={nombre} className="admin-relation-block">
                    <h4>{nombre.replaceAll('_', ' ')}</h4>
                    {!rows?.length && <p>Sin datos.</p>}
                    {!!rows?.length && (
                      <div className="admin-users-scroll">
                        <table className="table">
                          <thead>
                            <tr>
                              {Object.keys(rows[0]).map(col => <th key={col}>{col.replaceAll('_', ' ')}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, idx) => (
                              <tr key={`${nombre}-${idx}`}>
                                {Object.keys(rows[0]).map(col => <td key={col}>{String(row[col] ?? '')}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}

                {!!detalle.pagos?.length && (
                  <>
                    <h3>Pagos</h3>
                    <div className="admin-users-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Plan</th>
                            <th>Estado</th>
                            <th>Monto</th>
                            <th>Método</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.pagos.map((p) => (
                            <tr key={p.id_pago}>
                              <td>{p.fecha_pago}</td>
                              <td>{p.plan || '—'}</td>
                              <td>{p.estado}</td>
                              <td>{formatMoney(p.monto)}</td>
                              <td>{p.metodo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </article>
        </section>
      )}

      {tab === 'finanzas' && (
        <section className="admin-finance-layout">
          {loadingFinanzas && <p>Cargando finanzas...</p>}
          {!loadingFinanzas && (
            <>
              <article className="surface-raised admin-card">
                <h2>Resumen financiero</h2>
                <div className="admin-kv-grid">
                  <KeyValue label="Total ingresado" value={formatMoney(finanzas.resumen?.total_ingresado)} />
                  <KeyValue label="Total pendiente" value={formatMoney(finanzas.resumen?.total_pendiente)} />
                  <KeyValue label="Total reintegrado" value={formatMoney(finanzas.resumen?.total_reintegrado)} />
                  <KeyValue label="Pagos aprobados" value={finanzas.resumen?.pagos_aprobados} />
                </div>
              </article>

              <article className="surface-raised admin-card">
                <h2>Evolución mensual</h2>
                <div className="admin-users-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Período</th>
                        <th>Aprobado</th>
                        <th>Pendiente</th>
                        <th>Movimientos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(finanzas.mensual || []).map((m) => (
                        <tr key={m.periodo}>
                          <td>{m.periodo}</td>
                          <td>{formatMoney(m.total_aprobado)}</td>
                          <td>{formatMoney(m.total_pendiente)}</td>
                          <td>{m.cantidad_movimientos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="surface-raised admin-card">
                <h2>Movimientos de suscripciones</h2>
                <div className="admin-users-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Plan</th>
                        <th>Estado</th>
                        <th>Monto</th>
                        <th>Método</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(finanzas.movimientos || []).map((m) => (
                        <tr key={m.id_pago}>
                          <td>{m.fecha_pago}</td>
                          <td>{m.email}</td>
                          <td>{m.rol}</td>
                          <td>{m.plan}</td>
                          <td>{m.estado}</td>
                          <td>{formatMoney(m.monto)}</td>
                          <td>{m.metodo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </>
          )}
        </section>
      )}
    </div>
  )
}