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
  solicitarReceta: (idMedico, payload) => api.post(`/pacientes/medicos/${idMedico}/recetas`, payload),
  enviarMensaje: (idMedico, payload) => api.post(`/pacientes/medicos/${idMedico}/mensajes`, payload),
  getTycMedico: (idMedico) => api.get(`/pacientes/medicos/${idMedico}/tyc`),
  aceptarTycMedico: (idMedico, idTyc) =>
    api.post(`/pacientes/medicos/${idMedico}/tyc/aceptar`, { id_tyc: idTyc }),
}
