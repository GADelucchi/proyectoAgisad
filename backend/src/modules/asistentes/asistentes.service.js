const HttpError = require('../../utils/httpError')
const bcrypt = require('bcryptjs')
const { query, pool } = require('../../db/query')
const { findRoleIdByName, existsUsername } = require('../auth/auth.repository')
const {
  listAsistentesByMedico,
  findAsistenteById,
  upsertPermisos,
  findMedicoIdByUserId,
  findGerenteIdByUserId,
  findClinicasByMedicoId,
  findClinicasByGerenteId,
  insertAsistenteClinica,
  findAsistenteIdByUserId,
} = require('./asistentes.repository')

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

async function listAsistentes({ idMedico, requesterIdUsuario, requesterRol }) {
  const target = Number(idMedico)
  if (!target) throw new HttpError(400, 'Se requiere id_medico como parámetro')

  if (requesterRol === 'medico') {
    const medicoPropio = await findMedicoIdByUserId(requesterIdUsuario)
    if (!medicoPropio || Number(medicoPropio) !== target) {
      throw new HttpError(403, 'Solo podés listar tus asistentes')
    }
  }

  return listAsistentesByMedico(target)
}

async function getAsistente({ idAsistente, requesterIdUsuario, requesterRol }) {
  if (requesterRol === 'asistente') {
    const ownAsistenteId = await findAsistenteIdByUserId(requesterIdUsuario)
    if (!ownAsistenteId || Number(ownAsistenteId) !== Number(idAsistente)) {
      throw new HttpError(403, 'Solo podés ver tu propio perfil de asistente')
    }
  }

  const asistente = await findAsistenteById(Number(idAsistente))
  if (!asistente) throw new HttpError(404, 'Asistente no encontrado')
  return asistente
}

async function patchPermisos({ idAsistente, idMedico, permisos, requesterIdUsuario, requesterRol }) {
  const target = Number(idMedico)
  if (!target) throw new HttpError(400, 'id_medico es obligatorio')

  if (requesterRol === 'medico') {
    const medicoPropio = await findMedicoIdByUserId(requesterIdUsuario)
    if (!medicoPropio || Number(medicoPropio) !== target) {
      throw new HttpError(403, 'Solo podés modificar permisos de tus asistentes')
    }
  }

  const asistente = await findAsistenteById(Number(idAsistente))
  if (!asistente) throw new HttpError(404, 'Asistente no encontrado')

  await upsertPermisos(Number(idAsistente), target, permisos)

  const rows = await query(
    `SELECT * FROM asistente_permisos
     WHERE id_asistente = :idAsistente AND id_medico = :idMedico`,
    { idAsistente: Number(idAsistente), idMedico: target }
  )
  return rows[0] || null
}

async function createAsistente(input, requester) {
  const required = ['email', 'password', 'nombre', 'apellido']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const roleId = await findRoleIdByName('asistente')
    if (!roleId) {
      throw new HttpError(500, 'No existe el rol asistente. Cargar datos base primero')
    }

    const username = await ensureUsername(input.email, input.username)
    const hashedPassword = await bcrypt.hash(input.password, 10)

    const [userResult] = await conn.execute(
      `INSERT INTO usuarios (id_rol, username, email, password_hash, email_verificado, activo)
       VALUES (?, ?, ?, ?, 0, 1)`,
      [roleId, username, input.email, hashedPassword]
    )

    const [asistenteResult] = await conn.execute(
      `INSERT INTO asistentes (id_usuario, nombre, apellido, telefono)
       VALUES (?, ?, ?, ?)`,
      [userResult.insertId, input.nombre, input.apellido, input.telefono || null]
    )

    const requesterRole = requester?.rol || 'medico'
    let clinicIds = Array.isArray(input.clinic_ids) ? input.clinic_ids : []
    clinicIds = clinicIds.map((id) => Number(id)).filter(Boolean)

    if (clinicIds.length === 0) {
      if (requesterRole === 'medico') {
        const idMedico = await findMedicoIdByUserId(requester.idUsuario)
        if (!idMedico) throw new HttpError(403, 'No se pudo resolver el médico autenticado')
        const rows = await findClinicasByMedicoId(idMedico)
        clinicIds = rows.map((row) => Number(row.id_clinica)).filter(Boolean)
      } else if (requesterRole === 'gerente') {
        const idGerente = await findGerenteIdByUserId(requester.idUsuario)
        if (!idGerente) throw new HttpError(403, 'No se pudo resolver el gerente autenticado')
        const rows = await findClinicasByGerenteId(idGerente)
        clinicIds = rows.map((row) => Number(row.id_clinica)).filter(Boolean)
      }
    }

    for (const idClinica of clinicIds) {
      await insertAsistenteClinica(asistenteResult.insertId, idClinica)
    }

    const permisos = getDefaultPermisos(input.permisos)
    const targetMedicoId = input.id_medico ? Number(input.id_medico) : null

    if (targetMedicoId) {
      await upsertPermisos(asistenteResult.insertId, targetMedicoId, permisos)
    }

    await conn.commit()

    return {
      id_usuario: userResult.insertId,
      id_asistente: asistenteResult.insertId,
      username,
      email: input.email,
      rol: 'asistente',
      clinic_ids: clinicIds,
      id_medico: targetMedicoId,
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

module.exports = {
  listAsistentes,
  getAsistente,
  patchPermisos,
  createAsistente,
}
