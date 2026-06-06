import { api } from './apiClient'

function mapTurno(row) {
  return {
    id: row.id_turno,
    doctorId: row.id_medico,
    clinicId: row.id_clinica,
    dateIso: row.fecha_iso,
    time: row.hora,
    status: row.estado,
    clinicName: row.clinica_nombre,
    doctorName: `${row.medico_nombre || ''} ${row.medico_apellido || ''}`.trim(),
  }
}

export const turnosApi = {
  crear: (data) => api.post('/turnos', data),
  listarMisTurnos: async ({ idMedico } = {}) => {
    const q = idMedico ? `?id_medico=${encodeURIComponent(idMedico)}` : ''
    const rows = await api.get(`/turnos/mis${q}`)
    return Array.isArray(rows) ? rows.map(mapTurno) : []
  },
  cancelarPropio: (idTurno, motivo) => api.patch(`/turnos/${idTurno}/cancelar`, { motivo }),
}
