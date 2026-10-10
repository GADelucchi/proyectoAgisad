import { api } from './apiClient'

// Un médico opera siempre sobre sus propios asistentes: el backend usa su
// id_medico. Solo el admin necesita indicarlo.
function queryMedico(idMedico) {
  return idMedico ? `?id_medico=${encodeURIComponent(idMedico)}` : ''
}

export const asistentesApi = {
  listByMedico: (idMedico) => api.get(`/asistentes${queryMedico(idMedico)}`),
  patchPermisos: (idAsistente, permisos, idMedico) =>
    api.patch(`/asistentes/${idAsistente}/permisos${queryMedico(idMedico)}`, permisos),
  meAccess: () => api.get('/asistentes/me/access'),
}
