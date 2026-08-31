import { api } from './apiClient'

export const gerentesApi = {
  listMisClinicas: () => api.get('/gerentes/me/clinicas'),
  crearInvitacion: ({ id_clinica, email }) => api.post('/gerentes/invitaciones', { id_clinica, email }),
  listInvitaciones: () => api.get('/gerentes/invitaciones'),
  revocarInvitacion: (idInvitacion) => api.delete(`/gerentes/invitaciones/${idInvitacion}`),
  listMedicosEquipo: () => api.get('/gerentes/medicos'),
  desvincularMedico: (idMedico, idClinica) =>
    api.delete(`/gerentes/medicos/${idMedico}?id_clinica=${encodeURIComponent(idClinica)}`),

  getInvitacionPorToken: (token) => api.get(`/gerentes/invitaciones/${token}`),
  aceptarInvitacion: (token) => api.post(`/gerentes/invitaciones/${token}/aceptar`),
  registrarViaInvitacion: (token, datos) => api.post(`/gerentes/invitaciones/${token}/registrar`, datos),
}
