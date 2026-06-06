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
  getMyTyc: () => api.get('/medicos/me/tyc'),
  saveMyTyc: (texto) => api.post('/medicos/me/tyc', { texto }),
}
