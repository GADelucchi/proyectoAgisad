import { api } from './apiClient'

export const consultoriosApi = {
  listPublicos: () => api.get('/consultorios/publicos'),
  getDisponibilidadPublica: ({ idClinica, fecha, duracionMinutos }) => {
    const qs = new URLSearchParams({ fecha })
    if (duracionMinutos) qs.set('duracion_minutos', String(duracionMinutos))
    return api.get(`/consultorios/${idClinica}/disponibilidad-publica?${qs.toString()}`)
  },

  listMios: () => api.get('/consultorios/mios'),
  crear: (payload) => api.post('/consultorios', payload),
  publicar: (idClinica, publicar) => api.patch(`/consultorios/${idClinica}/publicar`, { publicar }),

  getDisponibilidad: (idClinica) => api.get(`/consultorios/${idClinica}/disponibilidad`),
  saveDisponibilidad: (idClinica, payload) => api.put(`/consultorios/${idClinica}/disponibilidad`, payload),

  listSolicitudesRecibidas: () => api.get('/consultorios/solicitudes/recibidas'),
  aprobarSolicitud: (idSolicitud) => api.patch(`/consultorios/solicitudes/${idSolicitud}/aprobar`),
  rechazarSolicitud: (idSolicitud, motivo) => api.patch(`/consultorios/solicitudes/${idSolicitud}/rechazar`, { motivo }),

  listMedicosVinculados: (idClinica) => api.get(`/consultorios/${idClinica}/medicos`),
  desvincularMedico: (idClinica, idMedico) => api.delete(`/consultorios/${idClinica}/medicos/${idMedico}`),

  reporteUso: (idClinica, { desde, hasta }) => {
    const qs = new URLSearchParams({ desde, hasta })
    return api.get(`/consultorios/${idClinica}/reporte-uso?${qs.toString()}`)
  },

  listMisSolicitudes: () => api.get('/consultorios/solicitudes/mias'),
  solicitar: (idClinica, mensaje) => api.post(`/consultorios/${idClinica}/solicitudes`, { mensaje }),
}
