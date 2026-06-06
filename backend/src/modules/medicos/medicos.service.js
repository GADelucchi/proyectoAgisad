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

const INDEX_TO_DAY = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

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

async function getMyTyc({ requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo médicos pueden consultar sus TyC')
  }

  const idMedico = await medicosRepo.findMedicoIdByUserId(requesterIdUsuario)
  if (!idMedico) {
    throw new HttpError(404, 'Médico no encontrado')
  }

  const tyc = await medicosRepo.findActiveTycByMedico(idMedico)
  return tyc || null
}

async function saveMyTyc({ texto, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo médicos pueden guardar TyC')
  }

  const cleanText = String(texto || '').trim()
  if (!cleanText) {
    throw new HttpError(400, 'El texto de términos es obligatorio')
  }

  const idMedico = await medicosRepo.findMedicoIdByUserId(requesterIdUsuario)
  if (!idMedico) {
    throw new HttpError(404, 'Médico no encontrado')
  }

  const current = await medicosRepo.findActiveTycByMedico(idMedico)
  if (current && String(current.texto || '').trim() === cleanText) {
    return current
  }

  const nextVersion = current ? Number(current.version) + 1 : 1

  await medicosRepo.deactivateTycByMedico(idMedico)
  return medicosRepo.insertMedicoTyc({
    idMedico,
    version: nextVersion,
    texto: cleanText,
  })
}

async function listClinicasByMedico({ idMedico }) {
  if (!idMedico) {
    throw new HttpError(400, 'id_medico es obligatorio')
  }

  const { clinics, disponibilidad } = await medicosRepo.listClinicasByMedico(Number(idMedico))

  return clinics.map((clinic) => {
    const rangos = disponibilidad
      .filter((d) => Number(d.id_clinica) === Number(clinic.id_clinica))
      .map((d, idx) => ({
        id: Number(`${clinic.id_clinica}${idx + 1}`),
        frecuencia: 'semanal',
        dia: INDEX_TO_DAY[Number(d.dia_semana)] || 'Lun',
        fecha: '',
        desde: '',
        hasta: '',
        dias: [INDEX_TO_DAY[Number(d.dia_semana)] || 'Lun'],
        inicio: d.hora_inicio,
        fin: d.hora_fin,
      }))

    return {
      id: clinic.id_clinica,
      nombre: clinic.nombre,
      tipo: String(clinic.nombre || '').toLowerCase().includes('virtual') ? 'virtual' : 'presencial',
      ciudad: clinic.ciudad || '',
      direccion: clinic.direccion || '',
      rangos,
    }
  })
}

module.exports = {
  listMedicos,
  getDisponibilidad,
  getMyTyc,
  saveMyTyc,
  listClinicasByMedico,
}
