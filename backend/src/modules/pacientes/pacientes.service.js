const crypto = require('crypto')
const HttpError = require('../../utils/httpError')
const {
  listPacientesByMedico,
  findPacienteById,
  findPacienteByUserId,
  findMedicoRecetaById,
  createRecetaSolicitud,
  createMensajeSolicitud,
  updatePaciente,
  listObrasSociales,
  existsObraSocial,
  listRecetasByPaciente,
  listMensajesByPaciente,
  findActiveTycByMedico,
  hasPacienteAcceptedTyc,
  insertPacienteTycAceptacion,
  findPacienteByDni,
  findPrimeraClinicaByMedico,
  upsertPacienteVinculo,
  ensureObraSocialByNombre,
  pacienteVinculadoAMedico,
} = require('./pacientes.repository')
const { listTurnosByPaciente } = require('../turnos/turnos.repository')
const { sendRecetaSolicitudEmail, sendPacienteMensajeEmail } = require('../../utils/mailer')
const { assertMembershipNotExpiredByMedicoId } = require('../membresias/membresias.service')
const { registerPaciente } = require('../auth/auth.service')
const acceso = require('../acceso/acceso.service')

const { findMedicoIdByUserId } = acceso
const {
  validateTextField,
  validatePhoneNumber,
  validateDate,
  validateDNI,
  validateName,
  validateEmail,
} = require('../../utils/validators')

/**
 * Resuelve sobre qué médico opera quien hace el pedido y valida los permisos
 * (ver acceso.service). El asistente necesita no estar bloqueado.
 */
function resolveMedicoDestino({ idMedico, requesterIdUsuario, requesterRol }) {
  return acceso.resolverMedicoAccesible({ idMedico, requesterIdUsuario, requesterRol })
}

/**
 * Lista pacientes del médico (o asistente actuando en nombre de un médico).
 * Requiere id_medico en query string.
 */
async function listPacientes({ idMedico, search, requesterIdUsuario, requesterRol }) {
  const target = await resolveMedicoDestino({ idMedico, requesterIdUsuario, requesterRol })
  return listPacientesByMedico(target, search)
}

/**
 * Alta manual de un paciente desde el panel del médico.
 * Si el DNI ya existe en el sistema, solo lo vincula a la agenda del médico.
 */
async function createPacienteManual({ fields = {}, requesterIdUsuario, requesterRol }) {
  const idMedico = await resolveMedicoDestino({
    idMedico: fields.id_medico,
    requesterIdUsuario,
    requesterRol,
  })

  const dni = validateDNI(fields.dni)
  const nombre = validateName(fields.nombre, 'El nombre')
  const apellido = validateName(fields.apellido, 'El apellido')

  const idClinica = await resolveClinicaVinculo({ idMedico, idClinica: fields.id_clinica })

  const existente = await findPacienteByDni(dni)
  if (existente) {
    await upsertPacienteVinculo({ idPaciente: existente.id_paciente, idMedico, idClinica })
    return {
      ...(await findPacienteById(existente.id_paciente)),
      ya_existia: true,
    }
  }

  const email = fields.email
    ? validateEmail(fields.email)
    : `paciente.${dni}@sin-email.local`

  const idObraSocial = fields.id_obra_social
    ? Number(fields.id_obra_social)
    : await ensureObraSocialByNombre(
      validateTextField(fields.obra_social, 120, 'La obra social')
    )

  const { id_usuario: idUsuario } = await registerPaciente({
    email,
    // El paciente nunca recibe esta clave: para entrar debe usar "olvidé mi contraseña".
    password: `${crypto.randomBytes(16).toString('hex')}Aa1`,
    dni,
    nombre,
    apellido,
    telefono: fields.telefono || null,
    fecha_nac: fields.fecha_nac ? validateDate(fields.fecha_nac, 'La fecha de nacimiento') : null,
    ...(await normalizePerfilFields({
      id_obra_social: idObraSocial,
      nro_obra_social: fields.nro_obra_social,
    })),
  }, { requireAceptaTyc: false, autoVerificarEmail: true })

  const creado = await findPacienteByUserId(idUsuario)
  await upsertPacienteVinculo({ idPaciente: creado.id_paciente, idMedico, idClinica })

  return { ...(await findPacienteById(creado.id_paciente)), ya_existia: false }
}

async function resolveClinicaVinculo({ idMedico, idClinica }) {
  if (idClinica) {
    const target = Number(idClinica)
    if (!(await acceso.medicoAtiendeEnClinica({ idMedico, idClinica: target }))) {
      throw new HttpError(400, 'El consultorio indicado no pertenece al médico')
    }
    return target
  }

  const primera = await findPrimeraClinicaByMedico(idMedico)
  if (!primera) {
    throw new HttpError(400, 'Cargá al menos un consultorio antes de agregar pacientes')
  }
  return primera
}

/**
 * Detalle de un paciente.
 * El propio paciente puede ver su perfil. Un médico/asistente puede ver cualquiera.
 */
async function getPaciente({ idPaciente, requesterIdUsuario, requesterRol }) {
  const paciente = await findPacienteById(Number(idPaciente))
  if (!paciente) throw new HttpError(404, 'Paciente no encontrado')

  // El paciente solo puede ver su propio perfil
  if (requesterRol === 'paciente' && paciente.id_usuario !== requesterIdUsuario) {
    throw new HttpError(403, 'Sin permisos para ver ese perfil')
  }

  // El médico solo puede ver pacientes vinculados a él (turno propio o alta manual)
  if (requesterRol === 'medico') {
    const idMedico = await findMedicoIdByUserId(requesterIdUsuario)
    const vinculado = idMedico && await pacienteVinculadoAMedico({ idPaciente: paciente.id_paciente, idMedico })
    if (!vinculado) {
      throw new HttpError(403, 'Ese paciente no está vinculado a tu cuenta')
    }
  }

  return paciente
}

/**
 * Actualiza datos del paciente: el propio paciente, un admin, o el médico
 * al que está vinculado (turno propio o alta manual).
 */
async function patchPaciente({ idPaciente, fields, requesterIdUsuario, requesterRol }) {
  const paciente = await findPacienteById(Number(idPaciente))
  if (!paciente) throw new HttpError(404, 'Paciente no encontrado')

  if (requesterRol === 'medico') {
    const idMedico = await findMedicoIdByUserId(requesterIdUsuario)
    const vinculado = idMedico && await pacienteVinculadoAMedico({ idPaciente: paciente.id_paciente, idMedico })
    if (!vinculado) {
      throw new HttpError(403, 'Ese paciente no está vinculado a tu cuenta')
    }
  } else if (requesterRol !== 'admin' && paciente.id_usuario !== requesterIdUsuario) {
    throw new HttpError(403, 'Solo podés editar tu propio perfil')
  }

  await updatePaciente(Number(idPaciente), await normalizePerfilFields(fields))
  return findPacienteById(Number(idPaciente))
}

/**
 * Búsqueda exacta por DNI para autocompletar el alta manual: si el paciente
 * ya existe en el sistema (con otro médico o el mismo), se reutilizan sus
 * datos en vez de cargarlo de nuevo.
 */
async function buscarPacientePorDni({ dni, requesterRol }) {
  if (requesterRol !== 'medico' && requesterRol !== 'asistente') {
    throw new HttpError(403, 'Sin permisos para buscar pacientes')
  }

  const dniLimpio = String(dni || '').trim()
  if (!/^\d{7,8}$/.test(dniLimpio)) {
    throw new HttpError(400, 'DNI inválido')
  }

  const encontrado = await findPacienteByDni(dniLimpio)
  if (!encontrado) return null

  return findPacienteById(encontrado.id_paciente)
}

/**
 * Historial de un paciente con el médico que lo consulta: turnos, recetas
 * y mensajes que pasaron específicamente por ese médico (no los de otros).
 */
async function getHistorialPaciente({ idPaciente, requesterIdUsuario, requesterRol }) {
  const paciente = await findPacienteById(Number(idPaciente))
  if (!paciente) throw new HttpError(404, 'Paciente no encontrado')

  let idMedico = null
  if (requesterRol === 'medico') {
    idMedico = await findMedicoIdByUserId(requesterIdUsuario)
    const vinculado = idMedico && await pacienteVinculadoAMedico({ idPaciente: paciente.id_paciente, idMedico })
    if (!vinculado) {
      throw new HttpError(403, 'Ese paciente no está vinculado a tu cuenta')
    }
  } else if (requesterRol !== 'admin') {
    throw new HttpError(403, 'Sin permisos para ver este historial')
  }

  const [turnos, recetas, mensajes] = await Promise.all([
    listTurnosByPaciente({ idPaciente: paciente.id_paciente, idMedico }),
    listRecetasByPaciente(paciente.id_paciente, idMedico),
    listMensajesByPaciente(paciente.id_paciente, idMedico),
  ])

  return { turnos, recetas, mensajes }
}

/**
 * Deja solo los campos presentes en el body: `undefined` no toca la columna y `null` la limpia.
 */
async function normalizePerfilFields(fields = {}) {
  const normalized = {}

  if (fields.telefono) {
    normalized.telefono = validatePhoneNumber(fields.telefono)
  }

  if (fields.fecha_nac) {
    normalized.fecha_nac = validateDate(fields.fecha_nac, 'La fecha de nacimiento')
  }

  if ('id_obra_social' in fields) {
    const raw = fields.id_obra_social

    if (raw === null || raw === '') {
      normalized.id_obra_social = null
      normalized.nro_obra_social = null
    } else {
      const idObraSocial = Number(raw)
      if (!Number.isInteger(idObraSocial) || idObraSocial <= 0) {
        throw new HttpError(400, 'La obra social seleccionada no es válida')
      }
      if (!(await existsObraSocial(idObraSocial))) {
        throw new HttpError(400, 'La obra social seleccionada no existe')
      }
      normalized.id_obra_social = idObraSocial
    }
  }

  if ('nro_obra_social' in fields && normalized.nro_obra_social === undefined) {
    normalized.nro_obra_social = validateTextField(
      fields.nro_obra_social,
      30,
      'El número de afiliado'
    )
  }

  return normalized
}

async function getMiPaciente(requesterIdUsuario) {
  const paciente = await findPacienteByUserId(requesterIdUsuario)
  if (!paciente) throw new HttpError(404, 'Paciente no encontrado')
  return paciente
}

/**
 * Perfil del paciente autenticado, sin exponer ids ajenos.
 */
async function getMiPerfil({ requesterIdUsuario }) {
  const paciente = await getMiPaciente(requesterIdUsuario)
  return findPacienteById(paciente.id_paciente)
}

async function patchMiPerfil({ fields, requesterIdUsuario }) {
  const paciente = await getMiPaciente(requesterIdUsuario)
  await updatePaciente(paciente.id_paciente, await normalizePerfilFields(fields))
  return findPacienteById(paciente.id_paciente)
}

async function listCatalogoObrasSociales() {
  return listObrasSociales()
}

async function listMisRecetas({ requesterIdUsuario }) {
  const paciente = await getMiPaciente(requesterIdUsuario)
  const rows = await listRecetasByPaciente(paciente.id_paciente)

  return rows.map((row) => ({
    ...row,
    items: parseItemsJson(row.items_json),
    items_json: undefined,
  }))
}

async function listMisMensajes({ requesterIdUsuario }) {
  const paciente = await getMiPaciente(requesterIdUsuario)
  return listMensajesByPaciente(paciente.id_paciente)
}

function parseItemsJson(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function solicitarReceta({ idMedico, tipo, items, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'paciente') {
    throw new HttpError(403, 'Solo pacientes pueden solicitar recetas')
  }

  const targetMedico = Number(idMedico)
  if (!targetMedico) {
    throw new HttpError(400, 'id_medico invalido')
  }

  const tipoReceta = tipo === 'urgente' ? 'urgente' : 'estandar'
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'Debes agregar al menos un medicamento')
  }
  if (items.length > 5) {
    throw new HttpError(400, 'Máximo 5 medicamentos por solicitud')
  }

  const normalizedItems = items
    .map((item) => {
      const medicamento = validateTextField(item?.medicamento, 100, 'El nombre del medicamento', true)
      const dosis = validateTextField(item?.dosis, 50, 'La dosis', false)
      return { medicamento, dosis }
    })
    .filter((item) => item.medicamento)

  if (normalizedItems.length === 0) {
    throw new HttpError(400, 'Debes ingresar al menos un medicamento válido')
  }

  // Validar que el médico tenga membresía activa
  await assertMembershipNotExpiredByMedicoId(targetMedico, 'No es posible solicitar recetas')

  const paciente = await findPacienteByUserId(requesterIdUsuario)
  if (!paciente) {
    throw new HttpError(404, 'Paciente no encontrado')
  }

  const medico = await findMedicoRecetaById(targetMedico)
  if (!medico) {
    throw new HttpError(404, 'Médico no encontrado')
  }

  const insert = await createRecetaSolicitud({
    idPaciente: paciente.id_paciente,
    idMedico: medico.id_medico,
    tipo: tipoReceta,
    itemsJson: JSON.stringify(normalizedItems),
    enviadoAEmail: medico.email,
  })

  if (medico.enviar_recetas_mail !== 0) {
    await sendRecetaSolicitudEmail({
      to: medico.email,
      medico,
      paciente,
      tipo: tipoReceta,
      items: normalizedItems,
    })
  }

  return {
    ...insert,
    tipo: tipoReceta,
  }
}

async function solicitarMensaje({ idMedico, asunto, mensaje, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'paciente') {
    throw new HttpError(403, 'Solo pacientes pueden enviar mensajes')
  }

  const targetMedico = Number(idMedico)
  if (!targetMedico) {
    throw new HttpError(400, 'id_medico invalido')
  }

  // Validar asunto y mensaje
  const asuntoClean = validateTextField(asunto, 150, 'El asunto', true)
  const mensajeClean = validateTextField(mensaje, 2000, 'El mensaje', true)

  // Validar que el médico tenga membresía activa
  await assertMembershipNotExpiredByMedicoId(targetMedico, 'No es posible enviar mensajes')

  const paciente = await findPacienteByUserId(requesterIdUsuario)
  if (!paciente) {
    throw new HttpError(404, 'Paciente no encontrado')
  }

  const medico = await findMedicoRecetaById(targetMedico)
  if (!medico) {
    throw new HttpError(404, 'Médico no encontrado')
  }

  const insert = await createMensajeSolicitud({
    idPaciente: paciente.id_paciente,
    idMedico: medico.id_medico,
    asunto: asuntoClean,
    mensaje: mensajeClean,
    enviadoAEmail: medico.email,
  })

  await sendPacienteMensajeEmail({
    to: medico.email,
    medico,
    paciente,
    asunto: asuntoClean,
    mensaje: mensajeClean,
  })

  return insert
}

async function getTycByMedico({ idMedico, requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'paciente') {
    throw new HttpError(403, 'Solo pacientes pueden consultar TyC de médicos')
  }

  const targetMedico = Number(idMedico)
  if (!targetMedico) {
    throw new HttpError(400, 'id_medico invalido')
  }

  const paciente = await findPacienteByUserId(requesterIdUsuario)
  if (!paciente) {
    throw new HttpError(404, 'Paciente no encontrado')
  }

  const tyc = await findActiveTycByMedico(targetMedico)
  if (!tyc) {
    return {
      requiere_aceptacion: false,
      tyc: null,
      aceptado: true,
    }
  }

  const aceptado = await hasPacienteAcceptedTyc({
    idPaciente: paciente.id_paciente,
    idTyc: tyc.id_tyc,
  })

  return {
    requiere_aceptacion: true,
    tyc,
    aceptado,
  }
}

async function aceptarTycByMedico({ idMedico, idTyc, requesterIdUsuario, requesterRol, ip }) {
  if (requesterRol !== 'paciente') {
    throw new HttpError(403, 'Solo pacientes pueden aceptar TyC')
  }

  const targetMedico = Number(idMedico)
  if (!targetMedico) {
    throw new HttpError(400, 'id_medico invalido')
  }

  const paciente = await findPacienteByUserId(requesterIdUsuario)
  if (!paciente) {
    throw new HttpError(404, 'Paciente no encontrado')
  }

  const tyc = await findActiveTycByMedico(targetMedico)
  if (!tyc) {
    throw new HttpError(404, 'El médico no tiene TyC activos')
  }

  if (idTyc && Number(idTyc) !== Number(tyc.id_tyc)) {
    throw new HttpError(400, 'El id_tyc no coincide con la versión activa')
  }

  await insertPacienteTycAceptacion({
    idPaciente: paciente.id_paciente,
    idMedico: targetMedico,
    idTyc: tyc.id_tyc,
    ip,
  })

  return {
    ok: true,
    id_tyc: tyc.id_tyc,
    aceptado: true,
  }
}

module.exports = {
  listPacientes,
  createPacienteManual,
  getPaciente,
  patchPaciente,
  getMiPerfil,
  patchMiPerfil,
  listCatalogoObrasSociales,
  listMisRecetas,
  listMisMensajes,
  solicitarReceta,
  solicitarMensaje,
  getTycByMedico,
  aceptarTycByMedico,
  buscarPacientePorDni,
  getHistorialPaciente,
}
