const HttpError = require('../../utils/httpError')
const medicosRepo = require('./medicos.repository')
const { assertUserFeatureByUserId, assertOwnMembershipActive } = require('../membresias/membresias.service')

function toMinutes(value) {
  const [h, m] = String(value).split(':').map(Number)
  return h * 60 + m
}

function toTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}:00`
}

function normalizeHourKey(value) {
  return String(value || '').slice(0, 5)
}

function normalizeLabel(value) {
  return String(value || '').trim().toLowerCase()
}

function getDayOfWeek(dateIso) {
  const date = new Date(`${dateIso}T00:00:00`)
  const jsDay = date.getDay()
  return jsDay
}

const INDEX_TO_DAY = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const DAY_TO_INDEX = { Dom: 0, Lun: 1, Mar: 2, Mie: 3, Jue: 4, Vie: 5, Sab: 6 }

function asBool(value) {
  return value === true || value === 1 || value === '1'
}

function normalizeRangos(inputRangos) {
  if (!Array.isArray(inputRangos)) return []
  const rows = []

  for (const rango of inputRangos) {
    const inicio = String(rango?.inicio || '').slice(0, 5)
    const fin = String(rango?.fin || '').slice(0, 5)
    const duracion = Number(rango?.duracion || 30)
    if (!inicio || !fin) continue

    const dias = Array.isArray(rango?.dias) && rango.dias.length
      ? rango.dias
      : (rango?.dia ? [rango.dia] : [])

    for (const d of dias) {
      if (DAY_TO_INDEX[d] === undefined) continue
      rows.push({
        diaSemana: DAY_TO_INDEX[d],
        inicio: `${inicio}:00`,
        fin: `${fin}:00`,
        duracion: Number.isFinite(duracion) && duracion > 0 ? duracion : 30,
      })
    }
  }

  return rows
}

function normalizeRangosUnicos(inputRangos) {
  if (!Array.isArray(inputRangos)) return []
  return inputRangos
    .filter((r) => String(r?.frecuencia || '') === 'unica' || Boolean(r?.fecha))
    .map((r) => {
      const inicio = String(r?.inicio || '').slice(0, 5)
      const fin = String(r?.fin || '').slice(0, 5)
      return {
        fecha: String(r?.fecha || '').slice(0, 10),
        inicio: inicio ? `${inicio}:00` : '',
        fin: fin ? `${fin}:00` : '',
      }
    })
    .filter((r) => r.fecha && r.inicio && r.fin)
}

function isSlotBlocked({ slotHora, bloqueos }) {
  const slot = String(slotHora).slice(0, 5)
  for (const b of bloqueos) {
    const from = b.hora_inicio ? String(b.hora_inicio).slice(0, 5) : null
    const to = b.hora_fin ? String(b.hora_fin).slice(0, 5) : null
    if (!from || !to) return true
    if (slot >= from && slot < to) return true
  }
  return false
}

function formatLocalDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function resolveMedicoOrThrow({ requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo medicos pueden realizar esta accion')
  }

  const medico = await medicosRepo.findMedicoByUserId(requesterIdUsuario)
  if (!medico?.id_medico) {
    throw new HttpError(404, 'Medico no encontrado')
  }

  return medico
}

async function listMedicos(filters) {
  return medicosRepo.listMedicos(filters)
}

async function ensureTurnosFeatureForUser(idUsuario) {
  await assertUserFeatureByUserId({
    idUsuario,
    feature: 'permite_turnos',
    denyMessage: 'Tu plan actual no incluye el modulo de turnos',
  })
}

async function getDisponibilidad({ idMedico, idClinica, fecha, duracionMinutos = null }) {
  if (!idMedico || !idClinica || !fecha) {
    throw new HttpError(400, 'id_medico, id_clinica y fecha son obligatorios')
  }

  const turnosConfig = await medicosRepo.findTurnosConfigByMedico(Number(idMedico))
  const duracionGeneral = Number(turnosConfig?.config?.duracion_turno_estandar || 0)
  const duracionDefault = Number.isFinite(duracionGeneral) && duracionGeneral > 0
    ? duracionGeneral
    : 30
  const requestedDuration = Number.isInteger(Number(duracionMinutos)) && Number(duracionMinutos) > 0
    ? Number(duracionMinutos)
    : duracionDefault
  const durationByTypeName = new Map(
    (Array.isArray(turnosConfig?.tipos) ? turnosConfig.tipos : []).map((tipo) => [
      normalizeLabel(tipo?.nombre),
      Number(tipo?.duracion_minutos || 0),
    ])
  )

  const diaSemana = getDayOfWeek(fecha)
  const franjas = await medicosRepo.findDisponibilidadByMedicoClinicaDia({
    idMedico,
    idClinica,
    diaSemana,
  })

  const extrasDelDia = await medicosRepo.findExtraDisponibilidadByMedicoClinicaFecha({
    idMedico,
    idClinica,
    fecha,
  })

  const franjasTotales = [
    ...franjas,
    ...extrasDelDia.map((e) => ({
      id_disponibilidad: null,
      hora_inicio: e.hora_inicio,
      hora_fin: e.hora_fin,
      duracion_turno: duracionDefault,
    })),
  ]

  if (franjasTotales.length === 0) {
    return {
      fecha,
      dia_semana: diaSemana,
      slots: [],
    }
  }

  const tomadosRows = await medicosRepo.findTurnosTomados({ idMedico, fecha })
  const ocupados = tomadosRows.map((row) => {
    const start = toMinutes(normalizeHourKey(row.hora))
    if (row.hora_fin) {
      return { start, end: toMinutes(normalizeHourKey(row.hora_fin)) }
    }
    const fromType = durationByTypeName.get(normalizeLabel(row.motivo_consulta))
    const duration = Number.isInteger(fromType) && fromType > 0 ? fromType : duracionDefault
    return {
      start,
      end: start + duration,
    }
  })
  const bloqueosRows = await medicosRepo.listBloqueosByMedico({ idMedico, idClinica })
  const bloqueosDelDia = bloqueosRows.filter((b) => b.fecha === fecha)

  const slots = []
  for (const franja of franjasTotales) {
    const inicio = toMinutes(String(franja.hora_inicio).slice(0, 5))
    const fin = toMinutes(String(franja.hora_fin).slice(0, 5))
    const duracion = duracionDefault

    for (let t = inicio; t + duracion <= fin; t += duracion) {
      const hora = toTime(t)
      const bloqueado = isSlotBlocked({ slotHora: hora, bloqueos: bloqueosDelDia })
      const slotStart = t
      const slotEnd = t + requestedDuration
      const overlaps = ocupados.some((o) => slotStart < o.end && o.start < slotEnd)
      slots.push({
        hora,
        id_disponibilidad: franja.id_disponibilidad,
        bloqueado,
        libre: !overlaps && !bloqueado,
      })
    }
  }

  return {
    fecha,
    dia_semana: diaSemana,
    slots,
  }
}

async function getMyDisponibilidad({ idClinica, fecha, requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)

  if (!idClinica || !fecha) {
    throw new HttpError(400, 'id_clinica y fecha son obligatorios')
  }

  const allowed = await medicosRepo.ensureMedicoHasClinica({
    idMedico: Number(medico.id_medico),
    idClinica: Number(idClinica),
  })
  if (!allowed) throw new HttpError(403, 'El consultorio no pertenece al medico autenticado')

  return getDisponibilidad({
    idMedico: Number(medico.id_medico),
    idClinica: Number(idClinica),
    fecha,
    duracionMinutos: null,
  })
}

async function getTurnosConfigByMedico({ idMedico }) {
  if (!idMedico) {
    throw new HttpError(400, 'id_medico es obligatorio')
  }

  const result = await medicosRepo.findTurnosConfigByMedico(Number(idMedico))
  return {
    duracion_turno_estandar: Number(result?.config?.duracion_turno_estandar || 30),
    tipos_turno: Array.isArray(result?.tipos) ? result.tipos : [],
  }
}

async function getMyTurnosConfig({ requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)
  return getTurnosConfigByMedico({ idMedico: Number(medico.id_medico) })
}

/**
 * Turnos futuros cuyo horario dejaría de coincidir con la grilla si se aplica `duracion`.
 */
async function findTurnosDesalineados({ idMedico, duracion }) {
  const turnos = await medicosRepo.findTurnosFuturosByMedico(Number(idMedico))
  if (turnos.length === 0) return []

  const { disponibilidad, disponibilidadUnica } = await medicosRepo.listClinicasByMedico(Number(idMedico))

  return turnos.filter((turno) => {
    const inicio = toMinutes(normalizeHourKey(turno.hora))
    const fin = turno.hora_fin ? toMinutes(normalizeHourKey(turno.hora_fin)) : inicio + duracion
    const diaSemana = getDayOfWeek(turno.fecha_iso)

    const franjas = [
      ...disponibilidad.filter((d) => (
        Number(d.id_clinica) === Number(turno.id_clinica) && Number(d.dia_semana) === diaSemana
      )),
      ...disponibilidadUnica.filter((d) => (
        Number(d.id_clinica) === Number(turno.id_clinica) && d.fecha === turno.fecha_iso
      )),
    ]

    const encaja = franjas.some((franja) => {
      const desde = toMinutes(normalizeHourKey(franja.hora_inicio))
      const hasta = toMinutes(normalizeHourKey(franja.hora_fin))
      if (inicio < desde || fin > hasta) return false
      return (inicio - desde) % duracion === 0
    })

    return !encaja
  })
}

async function saveMyTurnosConfig({ input, requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)

  const duracionTurnoEstandar = Number(input?.duracion_turno_estandar || 30)
  if (!Number.isInteger(duracionTurnoEstandar) || duracionTurnoEstandar <= 0) {
    throw new HttpError(400, 'duracion_turno_estandar invalida')
  }

  const tiposRaw = Array.isArray(input?.tipos_turno) ? input.tipos_turno : []
  const tiposTurno = tiposRaw
    .map((tipo) => ({
      idTipoTurno: tipo?.id_tipo_turno ? Number(tipo.id_tipo_turno) : null,
      nombre: String(tipo?.nombre || '').trim(),
      duracion: Number(tipo?.duracion_minutos ?? tipo?.duracion),
      notificarNuevo: Boolean(tipo?.notificar_nuevo),
    }))
    .filter((tipo) => tipo.nombre)

  if (tiposTurno.some((tipo) => !Number.isInteger(tipo.duracion) || tipo.duracion <= 0)) {
    throw new HttpError(400, 'Cada tipo de turno debe tener duracion en minutos valida')
  }

  const actual = await getTurnosConfigByMedico({ idMedico: Number(medico.id_medico) })
  if (actual.duracion_turno_estandar !== duracionTurnoEstandar && !asBool(input?.confirmar)) {
    const afectados = await findTurnosDesalineados({
      idMedico: Number(medico.id_medico),
      duracion: duracionTurnoEstandar,
    })

    if (afectados.length > 0) {
      throw new HttpError(
        409,
        `Hay ${afectados.length} turno(s) agendado(s) que no coinciden con una grilla de ${duracionTurnoEstandar} minutos`,
        { turnos_afectados: afectados }
      )
    }
  }

  await medicosRepo.upsertTurnosConfigByMedico({
    idMedico: Number(medico.id_medico),
    duracionTurnoEstandar,
    tiposTurno,
  })

  return getTurnosConfigByMedico({ idMedico: Number(medico.id_medico) })
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

  const { clinics, disponibilidad, disponibilidadUnica } = await medicosRepo.listClinicasByMedico(Number(idMedico))

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

    const rangosUnicos = disponibilidadUnica
      .filter((d) => Number(d.id_clinica) === Number(clinic.id_clinica))
      .map((d, idx) => ({
        id: Number(`${clinic.id_clinica}9${idx + 1}`),
        frecuencia: 'unica',
        fecha: d.fecha,
        inicio: d.hora_inicio,
        fin: d.hora_fin,
      }))

    return {
      id: clinic.id_clinica,
      nombre: clinic.nombre,
      tipo: clinic.link || (!clinic.direccion && String(clinic.nombre || '').toLowerCase().includes('virtual')) ? 'virtual' : 'presencial',
      ciudad: clinic.ciudad || '',
      direccion: clinic.direccion || clinic.link || '',
      link: clinic.link || clinic.direccion || '',
      rangos,
      rangos_unicos: rangosUnicos,
    }
  })
}

async function listMyClinicas({ requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)
  return listClinicasByMedico({ idMedico: Number(medico.id_medico) })
}

async function createMyClinica({ input, requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  // A diferencia del resto de las funciones (ensureTurnosFeatureForUser), crear una
  // clínica propia requiere membresía propia: un médico cubierto por un gerente no
  // puede agregar clínicas independientes de la que lo invitó.
  await assertOwnMembershipActive(requesterIdUsuario, 'Agregar una clínica propia')
  await ensureTurnosFeatureForUser(requesterIdUsuario)

  const nombre = String(input?.nombre || '').trim()
  const tipo = asBool(input?.tipo === 'virtual' || input?.tipo_virtual) ? 'virtual' : String(input?.tipo || 'presencial')
  const direccion = String(input?.direccion || '').trim()
  const rangos = normalizeRangos(input?.rangos)
  const rangosUnicos = normalizeRangosUnicos(input?.rangos)

  if (!nombre) throw new HttpError(400, 'nombre es obligatorio')
  if (rangos.length === 0 && rangosUnicos.length === 0) {
    throw new HttpError(400, 'Debes enviar al menos un rango semanal o de unica vez')
  }

  const idCiudad = Number(input?.id_ciudad) || Number(medico.id_ciudad) || Number(await medicosRepo.findAnyCityId())
  if (!idCiudad) throw new HttpError(400, 'No se pudo determinar una ciudad para el consultorio')

  await medicosRepo.createClinicaWithDisponibilidad({
    idMedico: Number(medico.id_medico),
    idCiudad,
    nombre,
    direccion,
    link: String(input?.link || '').trim(),
    tipo,
    rangosSemanales: rangos,
    rangosUnicos,
  })

  return listClinicasByMedico({ idMedico: Number(medico.id_medico) })
}

async function updateMyClinica({ idClinica, input, requesterIdUsuario, requesterRol }) {
  if (!idClinica) throw new HttpError(400, 'id_clinica es obligatorio')
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)

  const allowed = await medicosRepo.ensureMedicoHasClinica({
    idMedico: Number(medico.id_medico),
    idClinica: Number(idClinica),
  })
  if (!allowed) throw new HttpError(403, 'El consultorio no pertenece al medico autenticado')

  const nombre = String(input?.nombre || '').trim()
  const direccion = String(input?.direccion || '').trim()
  const rangos = normalizeRangos(input?.rangos)
  const rangosUnicos = normalizeRangosUnicos(input?.rangos)
  if (!nombre) throw new HttpError(400, 'nombre es obligatorio')
  if (rangos.length === 0 && rangosUnicos.length === 0) {
    throw new HttpError(400, 'Debes enviar al menos un rango semanal o de unica vez')
  }

  await medicosRepo.updateClinicaWithDisponibilidad({
    idMedico: Number(medico.id_medico),
    idClinica: Number(idClinica),
    nombre,
    direccion,
    link: String(input?.link || '').trim(),
    tipo: input?.tipo,
    rangosSemanales: rangos,
    rangosUnicos,
  })

  return listClinicasByMedico({ idMedico: Number(medico.id_medico) })
}

async function deleteMyClinica({ idClinica, requesterIdUsuario, requesterRol }) {
  if (!idClinica) throw new HttpError(400, 'id_clinica es obligatorio')
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)

  const allowed = await medicosRepo.ensureMedicoHasClinica({
    idMedico: Number(medico.id_medico),
    idClinica: Number(idClinica),
  })
  if (!allowed) throw new HttpError(403, 'El consultorio no pertenece al medico autenticado')

  await medicosRepo.deleteClinicaByMedico({
    idMedico: Number(medico.id_medico),
    idClinica: Number(idClinica),
  })

  return { ok: true }
}

async function listMyBloqueos({ idClinica, requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)

  if (idClinica) {
    const allowed = await medicosRepo.ensureMedicoHasClinica({
      idMedico: Number(medico.id_medico),
      idClinica: Number(idClinica),
    })
    if (!allowed) throw new HttpError(403, 'El consultorio no pertenece al medico autenticado')
  }

  return medicosRepo.listBloqueosByMedico({
    idMedico: Number(medico.id_medico),
    idClinica: idClinica ? Number(idClinica) : null,
  })
}

async function createMyBloqueo({ input, requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)

  const idClinica = Number(input?.id_clinica)
  const desde = String(input?.fecha_desde || input?.fecha || '')
  const hasta = String(input?.fecha_hasta || input?.fecha || '')
  const motivo = String(input?.motivo || '').trim() || null
  const horaInicio = input?.hora_inicio ? `${String(input.hora_inicio).slice(0, 5)}:00` : null
  const horaFin = input?.hora_fin ? `${String(input.hora_fin).slice(0, 5)}:00` : null

  if (!idClinica) throw new HttpError(400, 'id_clinica es obligatorio')
  if (!desde || !hasta) throw new HttpError(400, 'fecha_desde y fecha_hasta son obligatorias')

  const allowed = await medicosRepo.ensureMedicoHasClinica({
    idMedico: Number(medico.id_medico),
    idClinica,
  })
  if (!allowed) throw new HttpError(403, 'El consultorio no pertenece al medico autenticado')

  let cursor = new Date(`${desde}T00:00:00`)
  const end = new Date(`${hasta}T00:00:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) {
    throw new HttpError(400, 'Rango de fechas invalido')
  }

  while (cursor <= end) {
    const fecha = formatLocalDate(cursor)
    await medicosRepo.createBloqueo({
      idMedico: Number(medico.id_medico),
      idClinica,
      fecha,
      horaInicio,
      horaFin,
      motivo,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return listMyBloqueos({ requesterIdUsuario, requesterRol, idClinica: null })
}

async function updateMyBloqueo({ idExcepcion, input, requesterIdUsuario, requesterRol }) {
  if (!idExcepcion) throw new HttpError(400, 'id_excepcion es obligatorio')
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)

  const bloqueo = await medicosRepo.findBloqueoById(Number(idExcepcion))
  if (!bloqueo || Number(bloqueo.id_medico) !== Number(medico.id_medico)) {
    throw new HttpError(404, 'Bloqueo no encontrado')
  }

  const idClinica = Number(input?.id_clinica || bloqueo.id_clinica)
  const fecha = String(input?.fecha || '')
  const motivo = String(input?.motivo || '').trim() || null
  const horaInicio = input?.hora_inicio ? `${String(input.hora_inicio).slice(0, 5)}:00` : null
  const horaFin = input?.hora_fin ? `${String(input.hora_fin).slice(0, 5)}:00` : null

  const allowed = await medicosRepo.ensureMedicoHasClinica({
    idMedico: Number(medico.id_medico),
    idClinica,
  })
  if (!allowed) throw new HttpError(403, 'El consultorio no pertenece al medico autenticado')
  if (!fecha) throw new HttpError(400, 'fecha es obligatoria')

  await medicosRepo.updateBloqueo({
    idExcepcion: Number(idExcepcion),
    idClinica,
    fecha,
    horaInicio,
    horaFin,
    motivo,
  })

  return listMyBloqueos({ requesterIdUsuario, requesterRol, idClinica: null })
}

async function deleteMyBloqueo({ idExcepcion, requesterIdUsuario, requesterRol }) {
  if (!idExcepcion) throw new HttpError(400, 'id_excepcion es obligatorio')
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  await ensureTurnosFeatureForUser(requesterIdUsuario)

  const bloqueo = await medicosRepo.findBloqueoById(Number(idExcepcion))
  if (!bloqueo || Number(bloqueo.id_medico) !== Number(medico.id_medico)) {
    throw new HttpError(404, 'Bloqueo no encontrado')
  }

  await medicosRepo.deleteBloqueo(Number(idExcepcion))
  return { ok: true }
}

async function getMyMailConfig({ requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo medicos pueden consultar esta configuracion')
  }

  const config = await medicosRepo.findMedicoMailConfigByUserId(requesterIdUsuario)
  if (!config?.id_medico) {
    throw new HttpError(404, 'Medico no encontrado')
  }

  return {
    enviar_recetas_mail: Boolean(config.enviar_recetas_mail),
    notif_turno_nuevo: Boolean(config.notif_turno_nuevo),
    notif_cancelacion: Boolean(config.notif_cancelacion),
  }
}

async function saveMyMailConfig({ input, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo medicos pueden guardar esta configuracion')
  }

  const config = await medicosRepo.findMedicoMailConfigByUserId(requesterIdUsuario)
  if (!config?.id_medico) {
    throw new HttpError(404, 'Medico no encontrado')
  }

  await medicosRepo.updateMedicoMailConfig({
    idMedico: Number(config.id_medico),
    enviarRecetasMail: Boolean(input?.enviar_recetas_mail),
    notifTurnoNuevo: Boolean(input?.notif_turno_nuevo),
    notifCancelacion: Boolean(input?.notif_cancelacion),
  })

  return {
    enviar_recetas_mail: Boolean(input?.enviar_recetas_mail),
    notif_turno_nuevo: Boolean(input?.notif_turno_nuevo),
    notif_cancelacion: Boolean(input?.notif_cancelacion),
  }
}

async function listMyRecetasSolicitudes({ requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo medicos pueden consultar recetas solicitadas')
  }

  const medico = await medicosRepo.findMedicoByUserId(requesterIdUsuario)
  if (!medico?.id_medico) {
    throw new HttpError(404, 'Medico no encontrado')
  }

  const rows = await medicosRepo.listRecetaSolicitudesByMedico(Number(medico.id_medico))

  return rows.map((row) => ({
    ...row,
    items: (() => {
      try {
        const parsed = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : row.items_json
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    })(),
  }))
}

async function updateMyRecetaSolicitudEstado({ idSolicitud, estado, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo medicos pueden actualizar recetas solicitadas')
  }

  const medico = await medicosRepo.findMedicoByUserId(requesterIdUsuario)
  if (!medico?.id_medico) {
    throw new HttpError(404, 'Medico no encontrado')
  }

  const estadoClean = String(estado || '').trim().toLowerCase()
  const estadoFinal = estadoClean === 'resuelta' ? 'resuelta' : 'enviada'

  const updated = await medicosRepo.updateRecetaSolicitudEstadoByMedico({
    idMedico: Number(medico.id_medico),
    idSolicitud: Number(idSolicitud),
    estado: estadoFinal,
  })

  if (!updated) {
    throw new HttpError(404, 'Solicitud de receta no encontrada')
  }

  return {
    ok: true,
    id_solicitud: Number(idSolicitud),
    estado: estadoFinal,
  }
}

module.exports = {
  listMedicos,
  getDisponibilidad,
  getMyDisponibilidad,
  getTurnosConfigByMedico,
  getMyTurnosConfig,
  saveMyTurnosConfig,
  getMyTyc,
  saveMyTyc,
  listClinicasByMedico,
  listMyClinicas,
  createMyClinica,
  updateMyClinica,
  deleteMyClinica,
  listMyBloqueos,
  createMyBloqueo,
  updateMyBloqueo,
  deleteMyBloqueo,
  getMyMailConfig,
  saveMyMailConfig,
  listMyRecetasSolicitudes,
  updateMyRecetaSolicitudEstado,
}
