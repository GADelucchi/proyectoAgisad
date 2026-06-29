const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const env = require('../../config/env')
const HttpError = require('../../utils/httpError')
const { pool } = require('../../db/query')
const {
  findUserByEmail,
  findRoleIdByName,
  existsUsername,
  updateUltimoLogin,
} = require('./auth.repository')
const { normalizePlanCode } = require('../membresias/membresias.service')

function buildTokenPayload(user) {
  return {
    idUsuario: user.id_usuario,
    idRol: user.id_rol,
    rol: user.rol,
    username: user.username,
    email: user.email,
    nombre: user.nombre,
  }
}

function buildUserPayload(user) {
  return {
    ...buildTokenPayload(user),
    membresia: {
      id_membresia: user.id_membresia || null,
      plan_codigo: user.plan_codigo || null,
      plan_nombre: user.plan_nombre || null,
      estado: user.membresia_estado || null,
      pagado_hasta: user.membresia_pagado_hasta || null,
      activa_vigente: Boolean(user.membresia_activa_vigente),
      permite_turnos: Boolean(user.permite_turnos),
      permite_asistentes: Boolean(user.permite_asistentes),
      limite_asistentes:
        user.limite_asistentes === null || user.limite_asistentes === undefined
          ? null
          : Number(user.limite_asistentes),
    },
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

async function ensureEspecialidadId(conn, especialidadNombre) {
  const nombre = normalizeText(especialidadNombre)
  if (!nombre) {
    throw new HttpError(400, 'La especialidad es obligatoria')
  }

  const [rows] = await conn.execute(
    'SELECT id_especialidad FROM especialidades WHERE nombre = ? LIMIT 1',
    [nombre]
  )
  if (rows[0]?.id_especialidad) {
    return rows[0].id_especialidad
  }

  await conn.execute('INSERT IGNORE INTO especialidades (nombre) VALUES (?)', [nombre])

  const [newRows] = await conn.execute(
    'SELECT id_especialidad FROM especialidades WHERE nombre = ? LIMIT 1',
    [nombre]
  )
  if (!newRows[0]?.id_especialidad) {
    throw new HttpError(500, 'No se pudo registrar la especialidad')
  }

  return newRows[0].id_especialidad
}

async function getMedicosSchemaFlags(conn) {
  const [cols] = await conn.execute('SHOW COLUMNS FROM medicos')
  const fields = new Set(cols.map((c) => c.Field))

  return {
    hasIdEspecialidad: fields.has('id_especialidad'),
    hasMatricula: fields.has('matricula'),
    hasMatriculaProv: fields.has('matricula_prov'),
  }
}

async function tableExists(conn, tableName) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  )
  return Number(rows[0]?.total || 0) > 0
}

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [tableName, columnName]
  )
  return Number(rows[0]?.total || 0) > 0
}

async function resolveOrCreatePlan(conn, rawPlanName) {
  const planName = normalizeText(rawPlanName)
  if (!planName) return { idPlan: null, code: null }

  const hasPlanCatalog = await tableExists(conn, 'membresia_planes')
  const planCode = normalizePlanCode(planName) || planName.toLowerCase()

  if (!hasPlanCatalog) {
    return { idPlan: null, code: planCode }
  }

  const [existing] = await conn.execute(
    `SELECT id_plan, codigo
     FROM membresia_planes
     WHERE codigo = ? OR LOWER(nombre) = LOWER(?)
     LIMIT 1`,
    [planCode, planName]
  )

  if (existing[0]?.id_plan) {
    return {
      idPlan: existing[0].id_plan,
      code: existing[0].codigo || planCode,
    }
  }

  try {
    const [inserted] = await conn.execute(
      `INSERT INTO membresia_planes (codigo, nombre, descripcion, activo)
       VALUES (?, ?, ?, 1)`,
      [planCode, planName, `Plan ${planName}`]
    )

    return { idPlan: inserted.insertId, code: planCode }
  } catch (err) {
    if (err?.code !== 'ER_DUP_ENTRY') throw err

    const [retry] = await conn.execute(
      `SELECT id_plan, codigo
       FROM membresia_planes
       WHERE codigo = ?
       LIMIT 1`,
      [planCode]
    )

    return {
      idPlan: retry[0]?.id_plan || null,
      code: retry[0]?.codigo || planCode,
    }
  }
}

async function createMembershipForUser(conn, { userId, plan }) {
  const requestedPlan = normalizeText(plan)
  if (!requestedPlan) return

  const hasMembershipTable = await tableExists(conn, 'membresias')
  if (!hasMembershipTable) return

  const hasPlanIdInMembership = await columnExists(conn, 'membresias', 'id_plan')
  const resolvedPlan = await resolveOrCreatePlan(conn, requestedPlan)
  const planCode = resolvedPlan.code || normalizePlanCode(requestedPlan) || requestedPlan
  const [planCatalogRows] = await conn.execute(
    `SELECT id_plan, vigencia_meses, precio_mensual
     FROM membresia_planes
     WHERE id_plan = ? OR codigo = ?
     ORDER BY id_plan = ? DESC
     LIMIT 1`,
    [resolvedPlan.idPlan || 0, planCode, resolvedPlan.idPlan || 0]
  )

  const planCatalog = planCatalogRows[0] || null
  const vigenciaMeses = Number(planCatalog?.vigencia_meses || 1)
  const precioMensual =
    planCatalog?.precio_mensual === null || planCatalog?.precio_mensual === undefined
      ? null
      : Number(planCatalog.precio_mensual)

  try {
    if (hasPlanIdInMembership && resolvedPlan.idPlan) {
      await conn.execute(
        `INSERT INTO membresias (
          id_usuario,
          id_plan,
          plan,
          estado,
          fecha_inicio,
          fecha_fin,
          monto_mensual,
          pagado_hasta,
          auto_renueva
        ) VALUES (?, ?, ?, 'activa', CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? MONTH), ?, DATE_ADD(CURDATE(), INTERVAL ? MONTH), 0)`,
        [userId, resolvedPlan.idPlan, planCode, vigenciaMeses, precioMensual, vigenciaMeses]
      )
      return
    }

    await conn.execute(
      `INSERT INTO membresias (
        id_usuario,
        plan,
        estado,
        fecha_inicio,
        fecha_fin,
        monto_mensual,
        pagado_hasta,
        auto_renueva
      ) VALUES (?, ?, 'activa', CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? MONTH), ?, DATE_ADD(CURDATE(), INTERVAL ? MONTH), 0)`,
      [userId, planCode, vigenciaMeses, precioMensual, vigenciaMeses]
    )
  } catch (err) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err

    await conn.execute(
      `INSERT INTO membresias (
        id_usuario,
        plan,
        estado,
        fecha_inicio,
        auto_renueva
      ) VALUES (?, ?, 'activa', CURDATE(), 0)`,
      [userId, planCode]
    )
  }
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
    user: buildUserPayload(user),
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

    const idCiudad = await ensureProvinceAndCityId(conn, input.provincia, input.ciudad)
    const schema = await getMedicosSchemaFlags(conn)
    let medicoResult

    if (schema.hasIdEspecialidad && schema.hasMatricula) {
      const idEspecialidad = await ensureEspecialidadId(conn, input.especialidad)

      ;[medicoResult] = await conn.execute(
        `INSERT INTO medicos (
          id_usuario, id_especialidad, id_ciudad, matricula, nombre, apellido, dni, telefono, bio, foto_url, acepta_tyc, acepta_tyc_fecha
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          userId,
          idEspecialidad,
          idCiudad,
          input.matricula,
          input.nombre,
          input.apellido,
          input.dni,
          input.telefono || null,
          input.bio || null,
          input.foto_url || null,
          input.acepta_tyc ? 1 : 0,
          input.acepta_tyc ? new Date() : null,
        ]
      )
    } else if (schema.hasMatriculaProv) {
      ;[medicoResult] = await conn.execute(
        `INSERT INTO medicos (
          id_usuario, nombre, apellido, dni, telefono, direccion, id_ciudad, matricula_prov, bio, foto_url, acepta_tyc, acepta_tyc_fecha
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          userId,
          input.nombre,
          input.apellido,
          input.dni,
          input.telefono || null,
          input.direccion || null,
          idCiudad,
          input.matricula,
          input.bio || null,
          input.foto_url || null,
          input.acepta_tyc ? 1 : 0,
          input.acepta_tyc ? new Date() : null,
        ]
      )
    } else {
      throw new HttpError(500, 'Esquema de tabla medicos no soportado')
    }

    await createMembershipForUser(conn, {
      userId,
      plan: input.plan,
    })

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

    await createMembershipForUser(conn, {
      userId,
      plan: input.plan,
    })

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
