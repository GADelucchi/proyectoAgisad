import { api } from './apiClient'

export const medicosApi = {
  list: async (q = '') => {
    const query = q ? `?q=${encodeURIComponent(q)}` : ''
    const rows = await api.get(`/medicos${query}`)
    return Array.isArray(rows)
      ? rows.map((row) => ({
        id: row.id_medico,
        nombre: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
        especialidad: row.especialidad || 'Especialidad general',
        matricula: row.matricula || '-',
        consultorios: [],
        permiteTurnos: row.permite_turnos !== 0 && row.permite_turnos !== false,
      }))
      : []
  },
  listClinicasByMedico: (idMedico) => api.get(`/medicos/${idMedico}/clinicas`),
  getDisponibilidad: ({ idMedico, idClinica, fecha, duracionMinutos }) => {
    const qs = new URLSearchParams({
      id_clinica: String(idClinica),
      fecha: String(fecha),
    })
    if (duracionMinutos !== undefined && duracionMinutos !== null) {
      qs.set('duracion_minutos', String(duracionMinutos))
    }
    return api.get(`/medicos/${idMedico}/disponibilidad?${qs.toString()}`)
  },
  getTurnosConfigByMedico: (idMedico) => api.get(`/medicos/${idMedico}/turnos-config`),
  getMyDisponibilidad: ({ idClinica, fecha }) => {
    const qs = new URLSearchParams({
      id_clinica: String(idClinica),
      fecha: String(fecha),
    })
    return api.get(`/medicos/me/disponibilidad?${qs.toString()}`)
  },
  listMyClinicas: () => api.get('/medicos/me/clinicas'),
  createMyClinica: (payload) => api.post('/medicos/me/clinicas', payload),
  updateMyClinica: (idClinica, payload) => api.patch(`/medicos/me/clinicas/${idClinica}`, payload),
  deleteMyClinica: (idClinica) => api.delete(`/medicos/me/clinicas/${idClinica}`),
  getMyTurnosConfig: () => api.get('/medicos/me/turnos-config'),
  saveMyTurnosConfig: (payload) => api.put('/medicos/me/turnos-config', payload),
  listMyBloqueos: (idClinica = null) => {
    const q = idClinica ? `?id_clinica=${encodeURIComponent(idClinica)}` : ''
    return api.get(`/medicos/me/bloqueos${q}`)
  },
  createMyBloqueo: (payload) => api.post('/medicos/me/bloqueos', payload),
  updateMyBloqueo: (idExcepcion, payload) => api.patch(`/medicos/me/bloqueos/${idExcepcion}`, payload),
  deleteMyBloqueo: (idExcepcion) => api.delete(`/medicos/me/bloqueos/${idExcepcion}`),
  getMyTyc: () => api.get('/medicos/me/tyc'),
  saveMyTyc: (texto) => api.post('/medicos/me/tyc', { texto }),
  listMyRecetasSolicitudes: () => api.get('/medicos/me/recetas-solicitudes'),
  updateMyRecetaSolicitudEstado: (idSolicitud, estado) =>
    api.patch(`/medicos/me/recetas-solicitudes/${idSolicitud}/estado`, { estado }),
  getMyMailConfig: () => api.get('/medicos/me/mail-config'),
  saveMyMailConfig: (payload) => api.put('/medicos/me/mail-config', payload),
}
