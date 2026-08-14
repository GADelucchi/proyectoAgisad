import { api } from './apiClient'

export const pacientesApi = {
  list: ({ idMedico, q } = {}) => {
    const qs = new URLSearchParams()
    if (idMedico !== undefined && idMedico !== null && String(idMedico).trim() !== '') {
      qs.set('id_medico', String(idMedico))
    }
    if (q !== undefined && q !== null && String(q).trim() !== '') {
      qs.set('q', String(q).trim())
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api.get(`/pacientes${suffix}`)
  },
  crear: (payload) => api.post('/pacientes', payload),
  solicitarReceta: (idMedico, payload) => api.post(`/pacientes/medicos/${idMedico}/recetas`, payload),
  enviarMensaje: (idMedico, payload) => api.post(`/pacientes/medicos/${idMedico}/mensajes`, payload),
  getMiPerfil: () => api.get('/pacientes/me'),
  actualizarMiPerfil: (payload) => api.patch('/pacientes/me', payload),
  listarObrasSociales: () => api.get('/pacientes/obras-sociales'),
  listarMisRecetas: () => api.get('/pacientes/me/recetas'),
  listarMisMensajes: () => api.get('/pacientes/me/mensajes'),
  getTycMedico: (idMedico) => api.get(`/pacientes/medicos/${idMedico}/tyc`),
  aceptarTycMedico: (idMedico, idTyc) =>
    api.post(`/pacientes/medicos/${idMedico}/tyc/aceptar`, { id_tyc: idTyc }),
}
