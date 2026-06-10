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
      }))
      : []
  },
  listClinicasByMedico: (idMedico) => api.get(`/medicos/${idMedico}/clinicas`),
  getDisponibilidad: ({ idMedico, idClinica, fecha }) => {
    const qs = new URLSearchParams({
      id_clinica: String(idClinica),
      fecha: String(fecha),
    })
    return api.get(`/medicos/${idMedico}/disponibilidad?${qs.toString()}`)
  },
  listMyClinicas: () => api.get('/medicos/me/clinicas'),
  createMyClinica: (payload) => api.post('/medicos/me/clinicas', payload),
  updateMyClinica: (idClinica, payload) => api.patch(`/medicos/me/clinicas/${idClinica}`, payload),
  deleteMyClinica: (idClinica) => api.delete(`/medicos/me/clinicas/${idClinica}`),
  listMyBloqueos: (idClinica = null) => {
    const q = idClinica ? `?id_clinica=${encodeURIComponent(idClinica)}` : ''
    return api.get(`/medicos/me/bloqueos${q}`)
  },
  createMyBloqueo: (payload) => api.post('/medicos/me/bloqueos', payload),
  updateMyBloqueo: (idExcepcion, payload) => api.patch(`/medicos/me/bloqueos/${idExcepcion}`, payload),
  deleteMyBloqueo: (idExcepcion) => api.delete(`/medicos/me/bloqueos/${idExcepcion}`),
  getMyTyc: () => api.get('/medicos/me/tyc'),
  saveMyTyc: (texto) => api.post('/medicos/me/tyc', { texto }),
}
