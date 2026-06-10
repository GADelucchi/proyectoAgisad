import { api } from './apiClient'

export const asistentesApi = {
  listByMedico: (idMedico) => api.get(`/asistentes?id_medico=${encodeURIComponent(idMedico)}`),
  patchPermisos: (idAsistente, idMedico, permisos) =>
    api.patch(`/asistentes/${idAsistente}/permisos?id_medico=${encodeURIComponent(idMedico)}`, permisos),
  meAccess: () => api.get('/asistentes/me/access'),
}
