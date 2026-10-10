const HttpError = require('../../utils/httpError')
const bcrypt = require('bcryptjs')
const { query, pool } = require('../../db/query')
const { findRoleIdByName, existsUsername } = require('../auth/auth.repository')
const {
  listAsistentesByMedico,
  findAsistenteById,
  upsertPermisos,
  findGerenteIdByUserId,
  findClinicasByMedicoId,
  findClinicasByGerenteId,
  insertAsistenteClinica,
  asistenteVinculadoAMedico,
  findAsistenteIdByUserId,
  findAsistenteAccessByUserId,
} = require('./asistentes.repository')
const { assertUserFeatureByUserId, assertMedicoFeatureByMedicoId } = require('../membresias/membresias.service')
const acceso = require('../acceso/acceso.service')
const { validateEmail, validatePassword, validateName, validatePhoneNumber } = require('../../utils/validators')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getDefaultPermisos(inputPermisos = {}) {
  return {
    agenda: inputPermisos.agenda !== undefined ? Number(Boolean(inputPermisos.agenda)) : 1,
    pacientes: inputPermisos.pacientes !== undefined ? Number(Boolean(inputPermisos.pacientes)) : 0,
    mensajes: inputPermisos.mensajes !== undefined ? Number(Boolean(inputPermisos.mensajes)) : 0,
    recetas: inputPermisos.recetas !== undefined ? Number(Boolean(inputPermisos.recetas)) : 0,
    configuracion:
      inputPermisos.configuracion !== undefined ? Number(Boolean(inputPermisos.configuracion)) : 0,
    bloqueado: inputPermisos.bloqueado !== undefined ? Number(Boolean(inputPermisos.bloqueado)) : 0,
  }
}

async function ensureUsername(email, desiredUsername) {
  let username = normalizeText(desiredUsername) || normalizeText(email.split('@')[0]) || 'asistente'
  username = username.toLowerCase()

  if (await existsUsername(username)) {
    username = `${username}_${Date.now().toString().slice(-6)}`
  }

  return username
}

/**
 * Médico sobre cuyos asistentes se opera: el médico, siempre el propio
 * (id_medico es opcional); el admin, el que indique.
 */
async function resolveMedicoDeAsistentes({ idMedico, requesterIdUsuario, requesterRol }) {
  const target = await acceso.resolverMedicoAccesible({ idMedico, requesterIdUsuario, requesterRol })

  await assertMedicoFeatureByMedicoId({
    idMedico: target,
    feature: 'permite_asistentes',
    denyMessage: 'Tu plan actual no permite gestionar asistentes',
  })

  return target
}

async function listAsistentes({ idMedico, requesterIdUsuario, requesterRol }) {
  const target = await resolveMedicoDeAsistentes({ idMedico, requesterIdUsuario, requesterRol })
  return listAsistentesByMedico(target)
}

async function getAsistente({ idAsistente, requesterIdUsuario, requesterRol }) {
  if (requesterRol === 'asistente') {
    const ownAsistenteId = await findAsistenteIdByUserId(requesterIdUsuario)
    if (!ownAsistenteId || Number(ownAsistenteId) !== Number(idAsistente)) {
      throw new HttpError(403, 'Solo podés ver tu propio perfil de asistente')
    }
  }

  // Un médico solo ve a los asistentes que él vinculó.
  if (requesterRol === 'medico') {
    const idMedico = await acceso.resolverMedicoAccesible({ requesterIdUsuario, requesterRol })
    if (!(await asistenteVinculadoAMedico({ idAsistente: Number(idAsistente), idMedico }))) {
      throw new HttpError(404, 'Asistente no encontrado')
    }
  }

  const asistente = await findAsistenteById(Number(idAsistente))
  if (!asistente) throw new HttpError(404, 'Asistente no encontrado')
  return asistente
}

async function patchPermisos({ idAsistente, idMedico, permisos, requesterIdUsuario, requesterRol }) {
  const target = await resolveMedicoDeAsistentes({ idMedico, requesterIdUsuario, requesterRol })

  const asistente = await findAsistenteById(Number(idAsistente))
  if (!asistente) throw new HttpError(404, 'Asistente no encontrado')

  // El médico solo cambia permisos de asistentes que ya vinculó: no puede
  // "adoptar" al asistente de otro médico.
  if (requesterRol !== 'admin' && !(await asistenteVinculadoAMedico({ idAsistente: Number(idAsistente), idMedico: target }))) {
    throw new HttpError(404, 'Asistente no encontrado')
  }

  await upsertPermisos(Number(idAsistente), target, permisos)

  const rows = await query(
    `SELECT * FROM asistente_permisos
     WHERE id_asistente = :idAsistente AND id_medico = :idMedico`,
    { idAsistente: Number(idAsistente), idMedico: target }
  )
  return rows[0] || null
}

/**
 * Médico al que queda vinculado el asistente nuevo y clínicas que puede usar,
 * según quién lo crea: el médico, para sí mismo y en sus clínicas; el gerente,
 * para un médico de su equipo (opcional) y en sus clínicas; el admin, libre.
 */
async function resolveDestinoAsistente(input, requester) {
  const rol = requester?.rol
  const pedido = input.id_medico ? Number(input.id_medico) : null

  if (rol === 'medico') {
    const idMedico = Number(await acceso.findMedicoIdByUserId(requester.idUsuario)) || null
    if (!idMedico) throw new HttpError(403, 'No se pudo resolver el médico autenticado')
    const clinicas = await findClinicasByMedicoId(idMedico)
    return { idMedico, clinicasPermitidas: clinicas.map((row) => Number(row.id_clinica)) }
  }

  if (rol === 'gerente') {
    const idGerente = await findGerenteIdByUserId(requester.idUsuario)
    if (!idGerente) throw new HttpError(403, 'No se pudo resolver el gerente autenticado')
    if (pedido && !(await acceso.gerenteTieneMedico({ idUsuario: requester.idUsuario, idMedico: pedido }))) {
      throw new HttpError(403, 'Ese médico no atiende en tus clínicas')
    }
    const clinicas = await findClinicasByGerenteId(idGerente)
    return { idMedico: pedido, clinicasPermitidas: clinicas.map((row) => Number(row.id_clinica)) }
  }

  return { idMedico: pedido, clinicasPermitidas: null }
}

async function createAsistente(input, requester) {
  const required = ['email', 'password', 'nombre', 'apellido']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }

  const email = validateEmail(input.email)
  const password = validatePassword(input.password)
  const nombre = validateName(input.nombre, 'El nombre')
  const apellido = validateName(input.apellido, 'El apellido')
  const telefono = validatePhoneNumber(input.telefono, false)

  if (requester?.rol === 'medico' || requester?.rol === 'gerente') {
    await assertUserFeatureByUserId({
      idUsuario: requester.idUsuario,
      feature: 'permite_asistentes',
      denyMessage: 'Tu plan actual no permite gestionar asistentes',
    })
  }

  const { idMedico, clinicasPermitidas } = await resolveDestinoAsistente(input, requester)

  const pedidas = (Array.isArray(input.clinic_ids) ? input.clinic_ids : []).map(Number).filter(Boolean)
  const clinicIds = clinicasPermitidas
    ? (pedidas.length > 0 ? pedidas.filter((id) => clinicasPermitidas.includes(id)) : clinicasPermitidas)
    : pedidas

  const roleId = await findRoleIdByName('asistente')
  if (!roleId) {
    throw new HttpError(500, 'No existe el rol asistente. Cargar datos base primero')
  }

  const username = await ensureUsername(email, input.username)
  const hashedPassword = await bcrypt.hash(password, 10)

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const [userResult] = await conn.execute(
      `INSERT INTO usuarios (id_rol, username, email, password_hash, email_verificado, activo)
       VALUES (?, ?, ?, ?, 0, 1)`,
      [roleId, username, email, hashedPassword]
    )

    const [asistenteResult] = await conn.execute(
      `INSERT INTO asistentes (id_usuario, nombre, apellido, telefono)
       VALUES (?, ?, ?, ?)`,
      [userResult.insertId, nombre, apellido, telefono]
    )

    // Todo en la misma conexión: asistente_clinicas y asistente_permisos tienen
    // FK a asistentes, y desde otra conexión la fila todavía no confirmada no se ve.
    for (const idClinica of clinicIds) {
      await insertAsistenteClinica(asistenteResult.insertId, idClinica, conn)
    }

    if (idMedico) {
      await upsertPermisos(asistenteResult.insertId, idMedico, getDefaultPermisos(input.permisos), conn)
    }

    await conn.commit()

    return {
      id_usuario: userResult.insertId,
      id_asistente: asistenteResult.insertId,
      username,
      email,
      rol: 'asistente',
      clinic_ids: clinicIds,
      id_medico: idMedico,
    }
  } catch (err) {
    await conn.rollback()

    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Username o email ya existen')
    }

    throw err
  } finally {
    conn.release()
  }
}

async function getMyAccess({ requesterIdUsuario, requesterRol }) {
  if (requesterRol !== 'asistente') {
    throw new HttpError(403, 'Solo asistentes pueden consultar su acceso')
  }

  const access = await findAsistenteAccessByUserId(requesterIdUsuario)
  if (!access) {
    throw new HttpError(404, 'No se encontró acceso para este asistente')
  }

  return {
    doctorId: access.id_medico,
    assistantId: access.id_asistente,
    blocked: Boolean(access.bloqueado),
    permissions: {
      agenda: Boolean(access.agenda),
      pacientes: Boolean(access.pacientes),
      mensajes: Boolean(access.mensajes),
      recetas: Boolean(access.recetas),
      configuracion: Boolean(access.configuracion),
    },
  }
}

module.exports = {
  listAsistentes,
  getAsistente,
  patchPermisos,
  createAsistente,
  getMyAccess,
}
