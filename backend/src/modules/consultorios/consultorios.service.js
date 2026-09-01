const HttpError = require('../../utils/httpError')
const repo = require('./consultorios.repository')
const turnosRepo = require('../turnos/turnos.repository')
const { assertMedicoFeatureByMedicoId } = require('../membresias/membresias.service')
const { validateTextField } = require('../../utils/validators')
const { sendSolicitudConsultorioEmail, sendSolicitudResueltaEmail } = require('../../utils/mailer')

const DAY_TO_INDEX = { Dom: 0, Lun: 1, Mar: 2, Mie: 3, Jue: 4, Vie: 5, Sab: 6 }

// Publicar consultorios es un adicional pago sobre la membresía del médico.
// El propietario "puro" no lo necesita: su plan ya es exactamente esta capacidad.
const ADICIONAL_MONTO = 20000
const ADICIONAL_MAX_CONSULTORIOS = 2

function toMinutes(value) {
  const [h, m] = String(value || '').slice(0, 5).split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function toTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}:00`
}

function getDayOfWeek(dateIso) {
  return new Date(`${dateIso}T00:00:00`).getDay()
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

/**
 * Resuelve quién es el dueño del consultorio: puede ser un propietario (rol
 * dedicado) o un médico que publicó un consultorio propio para alquiler.
 */
async function resolveDuenoOrThrow({ idClinica, requesterIdUsuario, requesterRol }) {
  if (requesterRol === 'propietario') {
    const propietario = await repo.findPropietarioByUserId(requesterIdUsuario)
    if (!propietario) throw new HttpError(404, 'Propietario no encontrado')

    const owns = await repo.isClinicaOwnedByPropietario({
      idPropietario: propietario.id_propietario,
      idClinica,
    })
    if (!owns) throw new HttpError(403, 'El consultorio no te pertenece')

    return { tipo: 'propietario', idPropietario: propietario.id_propietario }
  }

  if (requesterRol === 'medico') {
    const medico = await repo.findMedicoByUserId(requesterIdUsuario)
    if (!medico) throw new HttpError(404, 'Médico no encontrado')

    const owns = await repo.isClinicaOwnedByMedico({
      idMedico: medico.id_medico,
      idClinica,
    })
    if (!owns) throw new HttpError(403, 'El consultorio no te pertenece')

    return { tipo: 'medico', idMedico: medico.id_medico }
  }

  throw new HttpError(403, 'No tenés permisos sobre consultorios')
}

async function resolveMedicoOrThrow({ requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo médicos pueden realizar esta acción')
  }
  const medico = await repo.findMedicoByUserId(requesterIdUsuario)
  if (!medico) throw new HttpError(404, 'Médico no encontrado')
  return medico
}

async function listPublicos() {
  return repo.listConsultoriosPublicos()
}

async function listMisConsultorios({ requesterIdUsuario, requesterRol }) {
  if (requesterRol === 'propietario') {
    const propietario = await repo.findPropietarioByUserId(requesterIdUsuario)
    if (!propietario) throw new HttpError(404, 'Propietario no encontrado')
    return repo.listClinicasByPropietario(propietario.id_propietario)
  }

  if (requesterRol === 'medico') {
    const medico = await repo.findMedicoByUserId(requesterIdUsuario)
    if (!medico) throw new HttpError(404, 'Médico no encontrado')
    return repo.listClinicasCompartidasByMedicoDueno(medico.id_medico)
  }

  throw new HttpError(403, 'No tenés permisos sobre consultorios')
}

async function crearConsultorio({ input, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'propietario') {
    throw new HttpError(403, 'Solo propietarios pueden crear consultorios desde este módulo')
  }

  const propietario = await repo.findPropietarioByUserId(requesterIdUsuario)
  if (!propietario) throw new HttpError(404, 'Propietario no encontrado')

  const nombre = validateTextField(input?.nombre, 100, 'El nombre del consultorio', true)
  const direccion = validateTextField(input?.direccion, 200, 'La dirección', true)
  const idCiudad = Number(input?.id_ciudad)
  if (!Number.isInteger(idCiudad) || idCiudad <= 0) {
    throw new HttpError(400, 'id_ciudad es obligatorio')
  }

  const idClinica = await repo.createClinicaForPropietario({
    idPropietario: propietario.id_propietario,
    nombre,
    idCiudad,
    direccion,
    telefono: input?.telefono || null,
  })

  return { id_clinica: idClinica, nombre }
}

/**
 * Un médico marca uno de sus consultorios propios como disponible para alquiler.
 * Requiere que su plan lo habilite.
 */
async function publicarConsultorio({ idClinica, publicar, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'medico') {
    throw new HttpError(403, 'Solo médicos pueden publicar un consultorio propio')
  }

  const medico = await repo.findMedicoByUserId(requesterIdUsuario)
  if (!medico) throw new HttpError(404, 'Médico no encontrado')

  const owns = await repo.isClinicaOwnedByMedico({ idMedico: medico.id_medico, idClinica })
  if (!owns) throw new HttpError(403, 'El consultorio no te pertenece')

  if (publicar) {
    const adicional = await repo.findAdicionalByMedico(medico.id_medico)

    if (adicional?.estado !== 'activo') {
      throw new HttpError(
        402,
        adicional?.estado === 'pendiente'
          ? 'Tu solicitud del adicional está pendiente de activación'
          : 'Necesitás contratar el adicional para publicar consultorios',
        { code: adicional?.estado === 'pendiente' ? 'ADICIONAL_PENDIENTE' : 'ADICIONAL_REQUERIDO' }
      )
    }

    const publicados = await repo.contarPublicadosByMedico(medico.id_medico)
    const tope = Number(adicional.max_consultorios) || ADICIONAL_MAX_CONSULTORIOS
    if (publicados >= tope) {
      throw new HttpError(
        409,
        `Tu adicional permite publicar hasta ${tope} consultorios. Si necesitás más, la cuenta de propietario está pensada para eso.`,
        { code: 'ADICIONAL_TOPE' }
      )
    }
  }

  await repo.marcarClinicaCompartida({ idClinica, compartido: publicar })
  return { id_clinica: Number(idClinica), compartido: Boolean(publicar) }
}

async function getDisponibilidadConfig({ idClinica, requesterIdUsuario, requesterRol }) {
  await resolveDuenoOrThrow({ idClinica: Number(idClinica), requesterIdUsuario, requesterRol })
  return repo.listDisponibilidadByClinica(Number(idClinica))
}

async function guardarDisponibilidad({ idClinica, input, requesterIdUsuario, requesterRol }) {
  await resolveDuenoOrThrow({ idClinica: Number(idClinica), requesterIdUsuario, requesterRol })

  const rangos = []
  for (const rango of Array.isArray(input?.rangos) ? input.rangos : []) {
    const inicio = String(rango?.inicio || '').slice(0, 5)
    const fin = String(rango?.fin || '').slice(0, 5)
    if (!inicio || !fin) continue
    if (toMinutes(fin) <= toMinutes(inicio)) {
      throw new HttpError(400, 'La hora de fin debe ser posterior a la de inicio')
    }

    const duracion = Number(rango?.duracion || 30)
    const dias = Array.isArray(rango?.dias) && rango.dias.length
      ? rango.dias
      : (rango?.dia ? [rango.dia] : [])

    for (const d of dias) {
      if (DAY_TO_INDEX[d] === undefined) continue
      rangos.push({
        diaSemana: DAY_TO_INDEX[d],
        horaInicio: `${inicio}:00`,
        horaFin: `${fin}:00`,
        duracionTurno: Number.isFinite(duracion) && duracion > 0 ? duracion : 30,
      })
    }
  }

  const excepciones = []
  for (const exc of Array.isArray(input?.excepciones) ? input.excepciones : []) {
    const fecha = String(exc?.fecha || '').slice(0, 10)
    const tipo = exc?.tipo === 'bloqueo' ? 'bloqueo' : 'extra'
    if (!fecha) continue

    const inicio = String(exc?.inicio || '').slice(0, 5)
    const fin = String(exc?.fin || '').slice(0, 5)

    // Un bloqueo sin horas cubre el día entero; un "extra" sí las necesita.
    if (tipo === 'extra' && (!inicio || !fin)) continue

    excepciones.push({
      fecha,
      horaInicio: inicio ? `${inicio}:00` : null,
      horaFin: fin ? `${fin}:00` : null,
      tipo,
      motivo: exc?.motivo || null,
    })
  }

  if (rangos.length === 0 && excepciones.length === 0) {
    throw new HttpError(400, 'Cargá al menos un horario disponible')
  }

  await repo.replaceDisponibilidadByClinica({
    idClinica: Number(idClinica),
    rangos,
    excepciones,
  })

  return repo.listDisponibilidadByClinica(Number(idClinica))
}

/**
 * Slots libres de un consultorio compartido: la ocupación se calcula con los
 * turnos de TODOS los médicos que lo usan, no solo los de uno.
 */
async function getDisponibilidadCompartida({ idClinica, fecha, duracionMinutos = null }) {
  if (!idClinica || !fecha) {
    throw new HttpError(400, 'id_clinica y fecha son obligatorios')
  }

  const diaSemana = getDayOfWeek(fecha)
  const franjas = await repo.findDisponibilidadByClinicaDia({
    idClinica: Number(idClinica),
    diaSemana,
  })
  const extras = await repo.findExcepcionesByClinicaFecha({
    idClinica: Number(idClinica),
    fecha,
    tipo: 'extra',
  })
  const bloqueos = await repo.findExcepcionesByClinicaFecha({
    idClinica: Number(idClinica),
    fecha,
    tipo: 'bloqueo',
  })

  const duracionDefault = Number(franjas[0]?.duracion_turno) > 0
    ? Number(franjas[0].duracion_turno)
    : 30
  const requestedDuration = Number.isInteger(Number(duracionMinutos)) && Number(duracionMinutos) > 0
    ? Number(duracionMinutos)
    : duracionDefault

  const franjasTotales = [
    ...franjas,
    ...extras.map((e) => ({
      id_disponibilidad: null,
      hora_inicio: e.hora_inicio,
      hora_fin: e.hora_fin,
      duracion_turno: duracionDefault,
    })),
  ]

  if (franjasTotales.length === 0) {
    return { fecha, dia_semana: diaSemana, slots: [] }
  }

  const tomados = await turnosRepo.findTurnosTomadosPorClinica({
    idClinica: Number(idClinica),
    fecha,
  })
  const ocupados = tomados.map((row) => {
    const start = toMinutes(row.hora)
    return {
      start,
      end: row.hora_fin ? toMinutes(row.hora_fin) : start + duracionDefault,
    }
  })

  const slots = []
  for (const franja of franjasTotales) {
    const inicio = toMinutes(String(franja.hora_inicio).slice(0, 5))
    const fin = toMinutes(String(franja.hora_fin).slice(0, 5))

    for (let t = inicio; t + duracionDefault <= fin; t += duracionDefault) {
      const hora = toTime(t)
      const bloqueado = isSlotBlocked({ slotHora: hora, bloqueos })
      const slotEnd = t + requestedDuration
      const overlaps = ocupados.some((o) => t < o.end && o.start < slotEnd)
      slots.push({
        hora,
        id_disponibilidad: franja.id_disponibilidad,
        bloqueado,
        libre: !overlaps && !bloqueado,
      })
    }
  }

  return { fecha, dia_semana: diaSemana, slots }
}

async function crearSolicitud({ idClinica, mensaje, requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  const clinica = await repo.findClinicaById(Number(idClinica))

  if (!clinica || !clinica.activo) {
    throw new HttpError(404, 'El consultorio no existe')
  }
  if (!clinica.compartido) {
    throw new HttpError(400, 'Ese consultorio no está publicado para alquiler')
  }

  if (await repo.isMedicoVinculado({ idClinica: clinica.id_clinica, idMedico: medico.id_medico })) {
    throw new HttpError(409, 'Ya estás vinculado a ese consultorio')
  }
  if (await repo.findSolicitudActiva({ idClinica: clinica.id_clinica, idMedico: medico.id_medico })) {
    throw new HttpError(409, 'Ya tenés una solicitud pendiente para ese consultorio')
  }

  const mensajeValidado = validateTextField(mensaje, 500, 'El mensaje', false)

  const idSolicitud = await repo.createSolicitud({
    idClinica: clinica.id_clinica,
    idMedico: medico.id_medico,
    mensaje: mensajeValidado,
  })

  try {
    const dueno = await repo.findOwnerEmailByClinica(clinica.id_clinica)
    if (dueno?.email) {
      await sendSolicitudConsultorioEmail({
        to: dueno.email,
        dueno,
        medico,
        consultorio: clinica,
        mensaje: mensajeValidado,
      })
    }
  } catch (err) {
    console.error('[consultorios] no se pudo enviar el mail de solicitud:', err.message)
  }

  return { id_solicitud: idSolicitud, estado: 'pendiente' }
}

async function listSolicitudesRecibidas({ requesterIdUsuario, requesterRol }) {
  const consultorios = await listMisConsultorios({ requesterIdUsuario, requesterRol })
  const ids = consultorios.map((c) => Number(c.id_clinica))
  return repo.listSolicitudesByClinicas(ids)
}

async function listMisSolicitudes({ requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  return repo.listSolicitudesByMedico(medico.id_medico)
}

async function resolverSolicitud({ idSolicitud, aprobar, motivo, requesterIdUsuario, requesterRol }) {
  const solicitud = await repo.findSolicitudById(Number(idSolicitud))
  if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada')
  if (solicitud.estado !== 'pendiente') {
    throw new HttpError(409, 'Esa solicitud ya fue resuelta')
  }

  await resolveDuenoOrThrow({
    idClinica: Number(solicitud.id_clinica),
    requesterIdUsuario,
    requesterRol,
  })

  if (aprobar) {
    await repo.aprobarSolicitud({
      idSolicitud: solicitud.id_solicitud,
      idClinica: solicitud.id_clinica,
      idMedico: solicitud.id_medico,
    })
  } else {
    await repo.rechazarSolicitud({
      idSolicitud: solicitud.id_solicitud,
      motivo: validateTextField(motivo, 255, 'El motivo', false),
    })
  }

  try {
    if (solicitud.medico_email) {
      await sendSolicitudResueltaEmail({
        to: solicitud.medico_email,
        medico: { nombre: solicitud.medico_nombre, apellido: solicitud.medico_apellido },
        consultorio: { nombre: solicitud.clinica_nombre },
        aprobada: Boolean(aprobar),
        motivo: aprobar ? null : motivo,
      })
    }
  } catch (err) {
    console.error('[consultorios] no se pudo enviar el mail de resolución:', err.message)
  }

  return { id_solicitud: solicitud.id_solicitud, estado: aprobar ? 'aprobada' : 'rechazada' }
}

async function listMedicosVinculados({ idClinica, requesterIdUsuario, requesterRol }) {
  await resolveDuenoOrThrow({ idClinica: Number(idClinica), requesterIdUsuario, requesterRol })
  return repo.listMedicosVinculados(Number(idClinica))
}

async function desvincularMedico({ idClinica, idMedico, requesterIdUsuario, requesterRol }) {
  await resolveDuenoOrThrow({ idClinica: Number(idClinica), requesterIdUsuario, requesterRol })
  await repo.desvincularMedico({ idClinica: Number(idClinica), idMedico: Number(idMedico) })
}

async function reporteUso({ idClinica, desde, hasta, requesterIdUsuario, requesterRol }) {
  if (!desde || !hasta) {
    throw new HttpError(400, 'desde y hasta son obligatorios')
  }
  await resolveDuenoOrThrow({ idClinica: Number(idClinica), requesterIdUsuario, requesterRol })

  const filas = await turnosRepo.reporteUsoPorClinica({
    idClinica: Number(idClinica),
    desde,
    hasta,
  })

  return {
    desde,
    hasta,
    total_horas: filas.reduce((acc, f) => acc + Number(f.horas || 0), 0),
    medicos: filas,
  }
}

/**
 * Estado del adicional para el panel del médico: si su plan lo habilita a
 * contratarlo, si ya lo tiene, y cuántos consultorios le quedan por publicar.
 */
async function getEstadoAdicional({ requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })

  let planHabilita = true
  try {
    await assertMedicoFeatureByMedicoId({
      idMedico: medico.id_medico,
      feature: 'permite_publicar_consultorio',
      denyMessage: 'plan no habilitado',
    })
  } catch {
    planHabilita = false
  }

  const adicional = await repo.findAdicionalByMedico(medico.id_medico)
  const publicados = await repo.contarPublicadosByMedico(medico.id_medico)
  const tope = Number(adicional?.max_consultorios) || ADICIONAL_MAX_CONSULTORIOS

  return {
    plan_habilita: planHabilita,
    estado: adicional?.estado || null,
    monto_mensual: Number(adicional?.monto_mensual) || ADICIONAL_MONTO,
    max_consultorios: tope,
    publicados,
    puede_publicar: adicional?.estado === 'activo' && publicados < tope,
    solicitado_en: adicional?.solicitado_en || null,
    activado_en: adicional?.activado_en || null,
  }
}

async function solicitarAdicional({ requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })

  // El plan tiene que admitir el adicional (Inicial no lo admite).
  await assertMedicoFeatureByMedicoId({
    idMedico: medico.id_medico,
    feature: 'permite_publicar_consultorio',
    denyMessage: 'Tu plan actual no permite contratar el adicional de consultorios. Cambiá a Medio o superior.',
  })

  const existente = await repo.findAdicionalByMedico(medico.id_medico)
  if (existente?.estado === 'activo') {
    throw new HttpError(409, 'Ya tenés el adicional activo')
  }
  if (existente?.estado === 'pendiente') {
    throw new HttpError(409, 'Ya tenés una solicitud pendiente de activación')
  }

  const idAdicional = await repo.createAdicional({
    idMedico: medico.id_medico,
    montoMensual: ADICIONAL_MONTO,
    maxConsultorios: ADICIONAL_MAX_CONSULTORIOS,
  })

  return {
    id_adicional: idAdicional,
    estado: 'pendiente',
    monto_mensual: ADICIONAL_MONTO,
    max_consultorios: ADICIONAL_MAX_CONSULTORIOS,
  }
}

async function cancelarAdicional({ requesterIdUsuario, requesterRol }) {
  const medico = await resolveMedicoOrThrow({ requesterIdUsuario, requesterRol })
  const adicional = await repo.findAdicionalByMedico(medico.id_medico)
  if (!adicional) {
    throw new HttpError(404, 'No tenés un adicional contratado')
  }

  // Al dar de baja el adicional se despublican los consultorios: dejarlos
  // visibles sin adicional activo permitiría seguir recibiendo solicitudes.
  const propios = await repo.listClinicasCompartidasByMedicoDueno(medico.id_medico)
  for (const c of propios) {
    await repo.marcarClinicaCompartida({ idClinica: c.id_clinica, compartido: false })
  }

  await repo.cancelarAdicional(adicional.id_adicional)
  return { estado: 'cancelado', despublicados: propios.length }
}

module.exports = {
  listPublicos,
  listMisConsultorios,
  crearConsultorio,
  publicarConsultorio,
  getDisponibilidadConfig,
  guardarDisponibilidad,
  getDisponibilidadCompartida,
  crearSolicitud,
  listSolicitudesRecibidas,
  listMisSolicitudes,
  resolverSolicitud,
  listMedicosVinculados,
  desvincularMedico,
  reporteUso,
  getEstadoAdicional,
  solicitarAdicional,
  cancelarAdicional,
}
