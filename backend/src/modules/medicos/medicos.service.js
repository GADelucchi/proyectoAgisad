const HttpError = require('../../utils/httpError')
const medicosRepo = require('./medicos.repository')

function toMinutes(value) {
  const [h, m] = String(value).split(':').map(Number)
  return h * 60 + m
}

function toTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}:00`
}

function getDayOfWeek(dateIso) {
  const date = new Date(`${dateIso}T00:00:00`)
  const jsDay = date.getDay()
  return jsDay
}

async function listMedicos(filters) {
  return medicosRepo.listMedicos(filters)
}

async function getDisponibilidad({ idMedico, idClinica, fecha }) {
  if (!idMedico || !idClinica || !fecha) {
    throw new HttpError(400, 'id_medico, id_clinica y fecha son obligatorios')
  }

  const diaSemana = getDayOfWeek(fecha)
  const franjas = await medicosRepo.findDisponibilidadByMedicoClinicaDia({
    idMedico,
    idClinica,
    diaSemana,
  })

  if (franjas.length === 0) {
    return {
      fecha,
      dia_semana: diaSemana,
      slots: [],
    }
  }

  const tomadosRows = await medicosRepo.findTurnosTomados({ idMedico, fecha })
  const tomados = new Set(tomadosRows.map(r => String(r.hora).slice(0, 8)))

  const slots = []
  for (const franja of franjas) {
    const inicio = toMinutes(String(franja.hora_inicio).slice(0, 5))
    const fin = toMinutes(String(franja.hora_fin).slice(0, 5))
    const duracion = Number(franja.duracion_turno) || 30

    for (let t = inicio; t + duracion <= fin; t += duracion) {
      const hora = toTime(t)
      slots.push({
        hora,
        id_disponibilidad: franja.id_disponibilidad,
        libre: !tomados.has(hora),
      })
    }
  }

  return {
    fecha,
    dia_semana: diaSemana,
    slots,
  }
}

module.exports = {
  listMedicos,
  getDisponibilidad,
}
