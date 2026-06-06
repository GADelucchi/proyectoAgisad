import { api } from './apiClient'

export const pacientesApi = {
  getTycMedico: (idMedico) => api.get(`/pacientes/medicos/${idMedico}/tyc`),
  aceptarTycMedico: (idMedico, idTyc) =>
    api.post(`/pacientes/medicos/${idMedico}/tyc/aceptar`, { id_tyc: idTyc }),
}
