const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const env = require('../../config/env')
const HttpError = require('../../utils/httpError')
const { pool } = require('../../db/query')
const {
  findUserByEmail,
  findRoleIdByName,
  existsUsername,
  findEspecialidadIdByName,
  updateUltimoLogin,
} = require('./auth.repository')

function buildTokenPayload(user) {
  return {
    idUsuario: user.id_usuario,
    idRol: user.id_rol,
    rol: user.rol,
    username: user.username,
    email: user.email,
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isStrongPassword(value) {
  if (typeof value !== 'string') return false
  if (value.length < 8) return false

  const hasLetter = /[A-Za-z]/.test(value)
  const hasNumber = /\d/.test(value)

  return hasLetter && hasNumber
}

async function ensureUsername(email, desiredUsername) {
  let username = normalizeText(desiredUsername) || normalizeText(email.split('@')[0]) || 'usuario'
  username = username.toLowerCase()

  if (await existsUsername(username)) {
    username = `${username}_${Date.now().toString().slice(-6)}`
  }

  return username
}

async function ensureProvinceAndCityId(conn, provinciaNombre, ciudadNombre) {
  const provincia = normalizeText(provinciaNombre) || 'Buenos Aires'
  const ciudad = normalizeText(ciudadNombre)

  if (!ciudad) {
    throw new HttpError(400, 'La ciudad es obligatoria')
  }

  let [provinceRows] = await conn.execute(
    'SELECT id_provincia FROM provincias WHERE nombre = ? LIMIT 1',
    [provincia]
  )
  let idProvincia = provinceRows[0]?.id_provincia || null

  if (!idProvincia) {
    const [provinceInsert] = await conn.execute(
      'INSERT INTO provincias (nombre) VALUES (?)',
      [provincia]
    )
    idProvincia = provinceInsert.insertId
  }

  let [cityRows] = await conn.execute(
    'SELECT id_ciudad FROM ciudades WHERE id_provincia = ? AND nombre = ? LIMIT 1',
    [idProvincia, ciudad]
  )
  let idCiudad = cityRows[0]?.id_ciudad || null

  if (!idCiudad) {
    const [cityInsert] = await conn.execute(
      'INSERT INTO ciudades (id_provincia, nombre) VALUES (?, ?)',
      [idProvincia, ciudad]
    )
    idCiudad = cityInsert.insertId
  }

  return idCiudad
}

async function ensureObraSocialId(conn, obraSocialNombre) {
  const nombre = normalizeText(obraSocialNombre)
  if (!nombre) return null

  const [rows] = await conn.execute(
    'SELECT id_obra_social FROM obras_sociales WHERE nombre = ? LIMIT 1',
    [nombre]
  )
  if (rows[0]?.id_obra_social) {
    return rows[0].id_obra_social
  }

  const [insert] = await conn.execute(
    'INSERT INTO obras_sociales (nombre) VALUES (?)',
    [nombre]
  )
  return insert.insertId
}

async function createBaseUser(conn, { roleName, email, password, username }) {
  const roleId = await findRoleIdByName(roleName)
  if (!roleId) {
    throw new HttpError(500, `No existe el rol ${roleName}. Cargar datos base primero`)
  }

  if (!isStrongPassword(password)) {
    throw new HttpError(
      400,
      'La contraseña debe tener al menos 8 caracteres e incluir letras y números'
    )
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const resolvedUsername = await ensureUsername(email, username)

  const [userResult] = await conn.execute(
    `INSERT INTO usuarios (id_rol, username, email, password_hash, email_verificado, activo)
     VALUES (?, ?, ?, ?, 0, 1)`,
    [roleId, resolvedUsername, email, hashedPassword]
  )

  return { userId: userResult.insertId, username: resolvedUsername }
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new HttpError(400, 'Email y password son obligatorios')
  }

  const user = await findUserByEmail(email)
  if (!user || !user.activo) {
    throw new HttpError(401, 'Credenciales invalidas')
  }

  const isValid = await bcrypt.compare(password, user.password_hash)
  if (!isValid) {
    throw new HttpError(401, 'Credenciales invalidas')
  }

  await updateUltimoLogin(user.id_usuario)

  const token = jwt.sign(buildTokenPayload(user), env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  })

  return {
    token,
    user: buildTokenPayload(user),
  }
}

async function registerPaciente(input) {
  const required = ['email', 'password', 'dni', 'nombre', 'apellido']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const { userId, username } = await createBaseUser(conn, {
      roleName: 'paciente',
      email: input.email,
      password: input.password,
      username: input.username,
    })

    const idObraSocial =
      input.id_obra_social ||
      (input.obra_social ? await ensureObraSocialId(conn, input.obra_social) : null)

    await conn.execute(
      `INSERT INTO pacientes (
        id_usuario, dni, nombre, apellido, telefono, fecha_nac, id_obra_social, nro_obra_social, acepta_tyc, acepta_tyc_fecha
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        input.dni,
        input.nombre,
        input.apellido,
        input.telefono || null,
        input.fecha_nac || null,
        idObraSocial,
        input.nro_obra_social || null,
        input.acepta_tyc ? 1 : 0,
        input.acepta_tyc ? new Date() : null,
      ]
    )

    await conn.commit()

    return {
      id_usuario: userId,
      username,
      email: input.email,
      rol: 'paciente',
    }
  } catch (err) {
    await conn.rollback()

    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Username, email o DNI ya existen')
    }

    throw err
  } finally {
    conn.release()
  }
}

async function registerMedico(input) {
  const required = ['email', 'password', 'nombre', 'apellido', 'dni', 'matricula', 'especialidad', 'provincia', 'ciudad']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const { userId, username } = await createBaseUser(conn, {
      roleName: 'medico',
      email: input.email,
      password: input.password,
      username: input.username,
    })

    const idEspecialidad = await findEspecialidadIdByName(input.especialidad)
    if (!idEspecialidad) {
      throw new HttpError(400, 'La especialidad seleccionada no existe')
    }

    const idCiudad = await ensureProvinceAndCityId(conn, input.provincia, input.ciudad)

    const [medicoResult] = await conn.execute(
      `INSERT INTO medicos (
        id_usuario, id_especialidad, id_ciudad, matricula, nombre, apellido, telefono, bio, foto_url, acepta_tyc, acepta_tyc_fecha
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        userId,
        idEspecialidad,
        idCiudad,
        input.matricula,
        input.nombre,
        input.apellido,
        input.telefono || null,
        input.bio || null,
        input.foto_url || null,
        input.acepta_tyc ? 1 : 0,
        input.acepta_tyc ? new Date() : null,
      ]
    )

    await conn.commit()

    return {
      id_usuario: userId,
      id_medico: medicoResult.insertId,
      username,
      email: input.email,
      rol: 'medico',
      plan_solicitado: input.plan || null,
      estado_onboarding: 'pendiente_membresia',
    }
  } catch (err) {
    await conn.rollback()

    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Username, email, DNI o matrícula ya existen')
    }

    throw err
  } finally {
    conn.release()
  }
}

async function registerGerente(input) {
  const required = ['email', 'password', 'nombre', 'apellido', 'clinica_nombre', 'provincia', 'ciudad', 'direccion']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const { userId, username } = await createBaseUser(conn, {
      roleName: 'gerente',
      email: input.email,
      password: input.password,
      username: input.username,
    })

    const idCiudad = await ensureProvinceAndCityId(conn, input.provincia, input.ciudad)

    const [gerenteResult] = await conn.execute(
      `INSERT INTO gerentes (id_usuario, nombre, apellido, telefono)
       VALUES (?, ?, ?, ?)` ,
      [userId, input.nombre, input.apellido, input.telefono || null]
    )

    const [clinicaResult] = await conn.execute(
      `INSERT INTO clinicas (nombre, id_ciudad, direccion, telefono)
       VALUES (?, ?, ?, ?)` ,
      [input.clinica_nombre, idCiudad, input.direccion, input.clinica_telefono || input.telefono || null]
    )

    await conn.execute(
      `INSERT INTO gerente_clinicas (id_gerente, id_clinica)
       VALUES (?, ?)`,
      [gerenteResult.insertId, clinicaResult.insertId]
    )

    await conn.commit()

    return {
      id_usuario: userId,
      id_gerente: gerenteResult.insertId,
      id_clinica: clinicaResult.insertId,
      username,
      email: input.email,
      rol: 'gerente',
      plan_solicitado: input.plan || null,
      estado_onboarding: 'pendiente_membresia',
    }
  } catch (err) {
    await conn.rollback()

    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Username, email o clínica ya existen')
    }

    throw err
  } finally {
    conn.release()
  }
}

module.exports = {
  login,
  registerPaciente,
  registerMedico,
  registerGerente,
}
