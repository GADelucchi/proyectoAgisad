import { api } from './apiClient'

function mapTurno(row) {
  return {
    id: row.id_turno,
    doctorId: row.id_medico,
    clinicId: row.id_clinica,
    dateIso: row.fecha_iso,
    time: row.hora,
    status: row.estado,
    type: row.motivo || '',
    clinicName: row.clinica_nombre,
    doctorName: `${row.medico_nombre || ''} ${row.medico_apellido || ''}`.trim(),
  }
}

export const turnosApi = {
  crear: (data) => api.post('/turnos', data),
  listarPorMedico: async ({ idMedico, desde, hasta }) => {
    const qs = new URLSearchParams({
      desde: String(desde),
      hasta: String(hasta),
    })
    if (idMedico !== undefined && idMedico !== null && String(idMedico).trim() !== '') {
      qs.set('id_medico', String(idMedico))
    }
    return api.get(`/turnos?${qs.toString()}`)
  },
  listarHistorialPorMedico: async ({ idMedico, desde, hasta }) => {
    const qs = new URLSearchParams({
      desde: String(desde),
      hasta: String(hasta),
    })
    if (idMedico !== undefined && idMedico !== null && String(idMedico).trim() !== '') {
      qs.set('id_medico', String(idMedico))
    }
    return api.get(`/turnos/historial?${qs.toString()}`)
  },
  listarMisTurnos: async ({ idMedico } = {}) => {
    const q = idMedico ? `?id_medico=${encodeURIComponent(idMedico)}` : ''
    const rows = await api.get(`/turnos/mis${q}`)
    return Array.isArray(rows) ? rows.map(mapTurno) : []
  },
  cambiarEstado: (idTurno, estado, motivo) =>
    api.patch(`/turnos/${idTurno}/estado`, { estado, motivo }),
  cancelarPropio: (idTurno, motivo) => api.patch(`/turnos/${idTurno}/cancelar`, { motivo }),
}
