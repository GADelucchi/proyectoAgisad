const bcrypt = require('bcryptjs')
const HttpError = require('../../utils/httpError')
const { pool } = require('../../db/query')
const {
  findUserByEmail,
  findUserById,
  findRoleIdByName,
  existsUsername,
} = require('./auth.repository')
const { issueSession, buildUserPayload } = require('./session')
const { normalizePlanCode } = require('../membresias/membresias.service')
const { emitirCodigo } = require('../email-verification/email-verification.service')
const {
  validateEmail,
  validatePassword,
  validateDNI,
  validatePhoneNumber,
  validateName,
  validateMatricula,
  validateTextField,
} = require('../../utils/validators')

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
          fecha_inicio_trial,
          fecha_fin_trial,
          es_trial,
          auto_renueva
        ) VALUES (?, ?, ?, 'activa', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1, 0)`,
        [userId, resolvedPlan.idPlan, planCode, precioMensual]
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
        fecha_inicio_trial,
        fecha_fin_trial,
        es_trial,
        auto_renueva
      ) VALUES (?, ?, 'activa', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1, 0)`,
      [userId, planCode, precioMensual]
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

async function createBaseUser(conn, { roleName, email, password, username, emailVerificado = false }) {
  // Validar email y password
  const validatedEmail = validateEmail(email)
  const validatedPassword = validatePassword(password)

  const roleId = await findRoleIdByName(roleName)
  if (!roleId) {
    throw new HttpError(500, `No existe el rol ${roleName}. Cargar datos base primero`)
  }

  const hashedPassword = await bcrypt.hash(validatedPassword, 10)
  const resolvedUsername = await ensureUsername(validatedEmail, username)

  const [userResult] = await conn.execute(
    `INSERT INTO usuarios (id_rol, username, email, password_hash, email_verificado, activo)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [roleId, resolvedUsername, validatedEmail, hashedPassword, emailVerificado ? 1 : 0]
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

  if (!user.email_verificado) {
    throw new HttpError(403, 'Tu email todavía no está verificado', { code: 'EMAIL_NO_VERIFICADO' })
  }

  return issueSession(user)
}

async function getCurrentUser(idUsuario) {
  const user = await findUserById(Number(idUsuario))
  if (!user || !user.activo) {
    throw new HttpError(401, 'Usuario no autorizado')
  }

  return buildUserPayload(user)
}

// requireAceptaTyc=false: alta interna hecha por un médico/asistente en nombre
// del paciente (paciente no presente, no puede tildar el checkbox). El paciente
// da su propio consentimiento más adelante, al entrar por "olvidé mi contraseña".
// autoVerificarEmail=true: mismo caso — ese paciente nunca recibe la clave
// generada al azar, su único camino de acceso es "olvidé mi contraseña", que ya
// prueba control del email por sí solo. Pedirle además un código lo dejaría sin
// ninguna pantalla desde la cual verificarlo.
async function registerPaciente(input, { requireAceptaTyc = true, autoVerificarEmail = false } = {}) {
  const required = ['email', 'password', 'dni', 'nombre', 'apellido']
  for (const field of required) {
    if (!input[field]) {
      throw new HttpError(400, `Falta el campo obligatorio: ${field}`)
    }
  }
  if (requireAceptaTyc && !input.acepta_tyc) {
    throw new HttpError(400, 'Tenés que aceptar los términos y condiciones y la política de privacidad')
  }

  // Validar inputs específicos
  const validatedDNI = validateDNI(input.dni)
  const validatedNombre = validateName(input.nombre, 'El nombre')
  const validatedApellido = validateName(input.apellido, 'El apellido')
  const validatedTelefono = validatePhoneNumber(input.telefono, false)

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const { userId, username } = await createBaseUser(conn, {
      roleName: 'paciente',
      email: input.email,
      password: input.password,
      username: input.username,
      emailVerificado: autoVerificarEmail,
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
        validatedDNI,
        validatedNombre,
        validatedApellido,
        validatedTelefono,
        input.fecha_nac || null,
        idObraSocial,
        input.nro_obra_social || null,
        input.acepta_tyc ? 1 : 0,
        input.acepta_tyc ? new Date() : null,
      ]
    )

    await conn.commit()

    if (!autoVerificarEmail) {
      try {
        await emitirCodigo(userId, input.email)
      } catch (err) {
        console.error('[auth] no se pudo enviar el código de verificación:', err.message)
      }
    }

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
  if (!input.acepta_tyc) {
    throw new HttpError(400, 'Tenés que aceptar los términos y condiciones y la política de privacidad')
  }

  // Validar inputs específicos
  const validatedDNI = validateDNI(input.dni)
  const validatedNombre = validateName(input.nombre, 'El nombre')
  const validatedApellido = validateName(input.apellido, 'El apellido')
  const validatedMatricula = validateMatricula(input.matricula)
  const validatedTelefono = validatePhoneNumber(input.telefono, false)
  const validatedBio = validateTextField(input.bio, 500, 'La biografía', false)

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
          validatedMatricula,
          validatedNombre,
          validatedApellido,
          validatedDNI,
          validatedTelefono,
          validatedBio,
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
          validatedNombre,
          validatedApellido,
          validatedDNI,
          validatedTelefono,
          validateTextField(input.direccion, 200, 'La dirección', false),
          idCiudad,
          validatedMatricula,
          validatedBio,
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

    // Crear tipos de consulta por defecto para el médico
    const idMedico = medicoResult.insertId
    await conn.execute(
      `INSERT INTO medico_tipos_turno (id_medico, nombre, duracion_minutos, activo)
       VALUES (?, ?, ?, 1)`,
      [idMedico, 'Seguimiento', 30]
    )
    await conn.execute(
      `INSERT INTO medico_tipos_turno (id_medico, nombre, duracion_minutos, activo)
       VALUES (?, ?, ?, 1)`,
      [idMedico, 'Primera vez', 60]
    )

    await conn.commit()

    try {
      await emitirCodigo(userId, input.email)
    } catch (err) {
      console.error('[auth] no se pudo enviar el código de verificación:', err.message)
    }

    return {
      id_usuario: userId,
      id_medico: idMedico,
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
  if (!input.acepta_tyc) {
    throw new HttpError(400, 'Tenés que aceptar los términos y condiciones y la política de privacidad')
  }

  // Validar inputs específicos
  const validatedNombre = validateName(input.nombre, 'El nombre')
  const validatedApellido = validateName(input.apellido, 'El apellido')
  const validatedTelefono = validatePhoneNumber(input.telefono, false)
  const validatedClinicaNombre = validateTextField(input.clinica_nombre, 100, 'El nombre de la clínica', true)
  const validatedDireccion = validateTextField(input.direccion, 200, 'La dirección', true)

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
      [userId, validatedNombre, validatedApellido, validatedTelefono]
    )

    const [clinicaResult] = await conn.execute(
      `INSERT INTO clinicas (nombre, id_ciudad, direccion, telefono)
       VALUES (?, ?, ?, ?)` ,
      [validatedClinicaNombre, idCiudad, validatedDireccion, validatePhoneNumber(input.clinica_telefono, false) || validatedTelefono]
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

    try {
      await emitirCodigo(userId, input.email)
    } catch (err) {
      console.error('[auth] no se pudo enviar el código de verificación:', err.message)
    }

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
  getCurrentUser,
  registerPaciente,
  registerMedico,
  registerGerente,
}
