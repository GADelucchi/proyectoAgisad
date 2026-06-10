import { api } from './apiClient'

export const pacientesApi = {
  solicitarReceta: (idMedico, payload) => api.post(`/pacientes/medicos/${idMedico}/recetas`, payload),
  enviarMensaje: (idMedico, payload) => api.post(`/pacientes/medicos/${idMedico}/mensajes`, payload),
  getTycMedico: (idMedico) => api.get(`/pacientes/medicos/${idMedico}/tyc`),
  aceptarTycMedico: (idMedico, idTyc) =>
    api.post(`/pacientes/medicos/${idMedico}/tyc/aceptar`, { id_tyc: idTyc }),
}
