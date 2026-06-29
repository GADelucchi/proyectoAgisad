import { api } from './apiClient'

export const adminApi = {
  listUsuarios: (params = {}) => {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.rol) query.set('rol', params.rol)
    if (params.suscripcion) query.set('suscripcion', params.suscripcion)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return api.get(`/admin/usuarios${suffix}`)
  },
  getUsuarioDetalle: (idUsuario) => api.get(`/admin/usuarios/${idUsuario}`),
  getFinanzas: () => api.get('/admin/finanzas'),
  reactivateMembership: (payload) => api.post('/admin/membresias/reactivar', payload),
}
