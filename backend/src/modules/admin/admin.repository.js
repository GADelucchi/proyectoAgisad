const { query, pool } = require('../../db/query')

function normalizePlanCode(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function mapSuscripcionFilter(filter) {
  if (!filter) return null
  const allowed = new Set(['activa', 'cancelada', 'vencida', 'inexistente'])
  return allowed.has(filter) ? filter : null
}

async function listUsuariosAdmin({ q, rol, suscripcion }) {
  const params = {
    q: q ? `%${q}%` : null,
    rol: rol || null,
    suscripcion: mapSuscripcionFilter(suscripcion),
  }

  let sql = `
    SELECT
      u.id_usuario,
      u.username,
      u.email,
      u.activo,
      u.email_verificado,
      r.nombre AS rol,
      COALESCE(
        CONCAT(p.nombre, ' ', p.apellido),
        CONCAT(m.nombre, ' ', m.apellido),
        CONCAT(a.nombre, ' ', a.apellido),
        CONCAT(g.nombre, ' ', g.apellido),
        u.username
      ) AS nombre,
      ms.plan AS suscripcion_plan,
      CASE WHEN ms.estado IS NULL THEN 'inexistente' ELSE ms.estado END AS suscripcion_estado,
      ms.fecha_fin AS suscripcion_fecha_fin
    FROM usuarios u
    INNER JOIN roles r ON r.id_rol = u.id_rol
    LEFT JOIN pacientes p ON p.id_usuario = u.id_usuario
    LEFT JOIN medicos m ON m.id_usuario = u.id_usuario
    LEFT JOIN asistentes a ON a.id_usuario = u.id_usuario
    LEFT JOIN gerentes g ON g.id_usuario = u.id_usuario
    LEFT JOIN (
      SELECT m1.*
      FROM membresias m1
      INNER JOIN (
        SELECT id_usuario, MAX(id_membresia) AS id_membresia
        FROM membresias
        GROUP BY id_usuario
      ) latest ON latest.id_membresia = m1.id_membresia
    ) ms ON ms.id_usuario = u.id_usuario
    WHERE 1 = 1
      AND (:q IS NULL
        OR u.username LIKE :q
        OR u.email LIKE :q
        OR p.nombre LIKE :q
        OR p.apellido LIKE :q
        OR m.nombre LIKE :q
        OR m.apellido LIKE :q
        OR a.nombre LIKE :q
        OR a.apellido LIKE :q
        OR g.nombre LIKE :q
        OR g.apellido LIKE :q)
      AND (:rol IS NULL OR r.nombre = :rol)
  `

  if (params.suscripcion === 'inexistente') {
    sql += ' AND ms.id_membresia IS NULL '
  } else {
    sql += ' AND (:suscripcion IS NULL OR ms.estado = :suscripcion) '
  }

  sql += ' ORDER BY u.id_usuario DESC '

  return query(sql, params)
}

async function findUsuarioBaseById(idUsuario) {
  const rows = await query(
    `SELECT
      u.id_usuario,
      u.username,
      u.email,
      u.activo,
      u.email_verificado,
      u.creado_en,
      r.nombre AS rol,
      p.id_paciente,
      p.dni AS paciente_dni,
      p.nombre AS paciente_nombre,
      p.apellido AS paciente_apellido,
      p.telefono AS paciente_telefono,
      DATE_FORMAT(p.fecha_nac, '%d/%m/%Y') AS paciente_fecha_nac,
      p.acepta_tyc AS paciente_acepta_tyc,
      DATE_FORMAT(p.acepta_tyc_fecha, '%d/%m/%Y %H:%i') AS paciente_acepta_tyc_fecha,
      os.nombre AS paciente_obra_social,
      p.nro_obra_social AS paciente_nro_obra_social,
      m.id_medico,
      m.matricula AS matricula,
      m.nombre AS medico_nombre,
      m.apellido AS medico_apellido,
      m.telefono AS medico_telefono,
      e.nombre AS medico_especialidad,
      cmed.nombre AS medico_ciudad,
      pmed.nombre AS medico_provincia,
      a.id_asistente,
      a.nombre AS asistente_nombre,
      a.apellido AS asistente_apellido,
      a.telefono AS asistente_telefono,
      g.id_gerente,
      g.nombre AS gerente_nombre,
      g.apellido AS gerente_apellido,
      g.telefono AS gerente_telefono,
      mb.id_membresia,
      mb.plan AS membresia_plan,
      mb.estado AS membresia_estado,
      DATE_FORMAT(mb.fecha_inicio, '%d/%m/%Y') AS membresia_fecha_inicio,
      DATE_FORMAT(mb.fecha_fin, '%d/%m/%Y') AS membresia_fecha_fin,
      mb.monto_mensual,
      DATE_FORMAT(mb.pagado_hasta, '%d/%m/%Y') AS membresia_pagado_hasta,
      mb.auto_renueva
    FROM usuarios u
    INNER JOIN roles r ON r.id_rol = u.id_rol
    LEFT JOIN pacientes p ON p.id_usuario = u.id_usuario
    LEFT JOIN obras_sociales os ON os.id_obra_social = p.id_obra_social
    LEFT JOIN medicos m ON m.id_usuario = u.id_usuario
    LEFT JOIN especialidades e ON e.id_especialidad = m.id_especialidad
    LEFT JOIN ciudades cmed ON cmed.id_ciudad = m.id_ciudad
    LEFT JOIN provincias pmed ON pmed.id_provincia = cmed.id_provincia
    LEFT JOIN asistentes a ON a.id_usuario = u.id_usuario
    LEFT JOIN gerentes g ON g.id_usuario = u.id_usuario
    LEFT JOIN (
      SELECT m1.*
      FROM membresias m1
      INNER JOIN (
        SELECT id_usuario, MAX(id_membresia) AS id_membresia
        FROM membresias
        GROUP BY id_usuario
      ) latest ON latest.id_membresia = m1.id_membresia
    ) mb ON mb.id_usuario = u.id_usuario
    WHERE u.id_usuario = :idUsuario
    LIMIT 1`,
    { idUsuario }
  )

  return rows[0] || null
}

async function findPacienteMedicosVinculados(idPaciente) {
  return query(
    `SELECT
      pv.id_medico,
      CONCAT(m.nombre, ' ', m.apellido) AS medico,
      m.matricula AS matricula,
      c.nombre AS clinica,
      DATE_FORMAT(pv.ultima_atencion, '%d/%m/%Y %H:%i') AS ultima_atencion,
      pv.estado
    FROM paciente_vinculos pv
    INNER JOIN medicos m ON m.id_medico = pv.id_medico
    INNER JOIN clinicas c ON c.id_clinica = pv.id_clinica
    WHERE pv.id_paciente = :idPaciente
    ORDER BY pv.ultima_atencion DESC, m.apellido, m.nombre`,
    { idPaciente }
  )
}

async function findMedicoClinicas(idMedico) {
  return query(
    `SELECT
      mc.id_clinica,
      c.nombre,
      c.direccion,
      mc.activo
    FROM medico_clinicas mc
    INNER JOIN clinicas c ON c.id_clinica = mc.id_clinica
    WHERE mc.id_medico = :idMedico
    ORDER BY c.nombre`,
    { idMedico }
  )
}

async function findMedicoCoberturaGerente(idMedico) {
  return query(
    `SELECT
      gmb.id_clinica,
      c.nombre AS clinica,
      gmb.cubre_membresia,
      gmb.activo,
      CONCAT(g.nombre, ' ', g.apellido) AS gerente
    FROM gerente_medico_beneficios gmb
    INNER JOIN gerentes g ON g.id_gerente = gmb.id_gerente
    INNER JOIN clinicas c ON c.id_clinica = gmb.id_clinica
    WHERE gmb.id_medico = :idMedico
    ORDER BY c.nombre`,
    { idMedico }
  )
}

async function findAsistenteMedicos(idAsistente) {
  return query(
    `SELECT
      ap.id_medico,
      CONCAT(m.nombre, ' ', m.apellido) AS medico,
      ap.agenda,
      ap.pacientes,
      ap.mensajes,
      ap.recetas,
      ap.configuracion,
      ap.bloqueado
    FROM asistente_permisos ap
    INNER JOIN medicos m ON m.id_medico = ap.id_medico
    WHERE ap.id_asistente = :idAsistente
    ORDER BY m.apellido, m.nombre`,
    { idAsistente }
  )
}

async function findAsistenteClinicas(idAsistente) {
  return query(
    `SELECT
      ac.id_clinica,
      c.nombre,
      c.direccion,
      ac.activo
    FROM asistente_clinicas ac
    INNER JOIN clinicas c ON c.id_clinica = ac.id_clinica
    WHERE ac.id_asistente = :idAsistente
    ORDER BY c.nombre`,
    { idAsistente }
  )
}

async function findGerenteClinicas(idGerente) {
  return query(
    `SELECT
      gc.id_clinica,
      c.nombre,
      c.direccion,
      gc.activo
    FROM gerente_clinicas gc
    INNER JOIN clinicas c ON c.id_clinica = gc.id_clinica
    WHERE gc.id_gerente = :idGerente
    ORDER BY c.nombre`,
    { idGerente }
  )
}

async function findGerenteMedicos(idGerente) {
  return query(
    `SELECT DISTINCT
      m.id_medico,
      CONCAT(m.nombre, ' ', m.apellido) AS medico,
      m.matricula AS matricula,
      c.nombre AS clinica,
      CASE WHEN gmb.id_medico IS NULL THEN 0 ELSE gmb.cubre_membresia END AS cubierto_por_gerente,
      CASE WHEN mb.estado IS NULL THEN 'inexistente' ELSE mb.estado END AS suscripcion_estado
    FROM gerente_clinicas gc
    INNER JOIN clinicas c ON c.id_clinica = gc.id_clinica
    INNER JOIN medico_clinicas mc ON mc.id_clinica = gc.id_clinica AND mc.activo = 1
    INNER JOIN medicos m ON m.id_medico = mc.id_medico
    LEFT JOIN gerente_medico_beneficios gmb
      ON gmb.id_gerente = gc.id_gerente
      AND gmb.id_medico = m.id_medico
      AND gmb.id_clinica = gc.id_clinica
      AND gmb.activo = 1
    LEFT JOIN (
      SELECT m1.*
      FROM membresias m1
      INNER JOIN (
        SELECT id_usuario, MAX(id_membresia) AS id_membresia
        FROM membresias
        GROUP BY id_usuario
      ) latest ON latest.id_membresia = m1.id_membresia
    ) mb ON mb.id_usuario = m.id_usuario
    WHERE gc.id_gerente = :idGerente
      AND gc.activo = 1
    ORDER BY clinica, medico`,
    { idGerente }
  )
}

async function findPagosByUsuario(idUsuario) {
  return query(
    `SELECT
      pm.id_pago,
      pm.estado,
      pm.metodo,
      pm.monto,
      pm.moneda,
      DATE_FORMAT(pm.fecha_pago, '%d/%m/%Y %H:%i') AS fecha_pago,
      pm.referencia_externa,
      mb.plan
    FROM pagos_membresia pm
    INNER JOIN membresias mb ON mb.id_membresia = pm.id_membresia
    WHERE mb.id_usuario = :idUsuario
    ORDER BY pm.fecha_pago DESC`,
    { idUsuario }
  )
}

async function getFinanzasResumen() {
  const [[resumen]] = await Promise.all([
    query(
      `SELECT
        COALESCE(SUM(CASE WHEN pm.estado = 'aprobado' THEN pm.monto ELSE 0 END), 0) AS total_ingresado,
        COALESCE(SUM(CASE WHEN pm.estado = 'pendiente' THEN pm.monto ELSE 0 END), 0) AS total_pendiente,
        COALESCE(SUM(CASE WHEN pm.estado = 'reintegrado' THEN pm.monto ELSE 0 END), 0) AS total_reintegrado,
        COUNT(CASE WHEN pm.estado = 'aprobado' THEN 1 END) AS pagos_aprobados
      FROM pagos_membresia pm`
    ),
  ])

  return resumen || {
    total_ingresado: 0,
    total_pendiente: 0,
    total_reintegrado: 0,
    pagos_aprobados: 0,
  }
}

async function listFinanzasMensual() {
  return query(
    `SELECT
      DATE_FORMAT(pm.fecha_pago, '%Y-%m') AS periodo,
      COALESCE(SUM(CASE WHEN pm.estado = 'aprobado' THEN pm.monto ELSE 0 END), 0) AS total_aprobado,
      COALESCE(SUM(CASE WHEN pm.estado = 'pendiente' THEN pm.monto ELSE 0 END), 0) AS total_pendiente,
      COUNT(*) AS cantidad_movimientos
    FROM pagos_membresia pm
    GROUP BY DATE_FORMAT(pm.fecha_pago, '%Y-%m')
    ORDER BY periodo DESC
    LIMIT 12`
  )
}

async function listFinanzasMovimientos({ limit = 100 }) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(500, Number(limit))) : 100

  return query(
    `SELECT
      pm.id_pago,
      DATE_FORMAT(pm.fecha_pago, '%d/%m/%Y %H:%i') AS fecha_pago,
      pm.estado,
      pm.metodo,
      pm.monto,
      pm.moneda,
      pm.referencia_externa,
      mb.plan,
      u.id_usuario,
      u.email,
      r.nombre AS rol
    FROM pagos_membresia pm
    INNER JOIN membresias mb ON mb.id_membresia = pm.id_membresia
    INNER JOIN usuarios u ON u.id_usuario = mb.id_usuario
    INNER JOIN roles r ON r.id_rol = u.id_rol
    ORDER BY pm.fecha_pago DESC
    LIMIT ${safeLimit}`
  )
}

async function findUserSubscriptionByEmail(email) {
  const rows = await query(`
    SELECT 
      u.email,
      u.username,
      r.nombre AS rol,
      m.id_membresia,
      m.plan,
      m.estado,
      m.fecha_inicio,
      m.fecha_fin,
      m.monto_mensual,
      m.pagado_hasta,
      m.auto_renueva,
      m.creado_en
    FROM usuarios u
    INNER JOIN roles r ON r.id_rol = u.id_rol
    LEFT JOIN membresias m ON u.id_usuario = m.id_usuario
    WHERE u.email = :email
    ORDER BY m.creado_en DESC
    LIMIT 1
  `, { email })
  
  return rows[0] || { error: 'Usuario no encontrado' }
}

async function reactivateMembershipByUser({
  idUsuario,
  rawPlan,
  metodo,
  referenciaExterna,
  monto,
}) {
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const [latestRows] = await conn.execute(
      `SELECT
         m.id_membresia,
         m.id_plan,
         m.plan,
         m.estado,
         m.pagado_hasta,
         m.monto_mensual
       FROM membresias m
       WHERE m.id_usuario = ?
       ORDER BY m.id_membresia DESC
       LIMIT 1
       FOR UPDATE`,
      [idUsuario]
    )

    const latest = latestRows[0] || null
    const requestedPlanCode = normalizePlanCode(rawPlan)

    let resolvedPlan = null
    if (requestedPlanCode) {
      const [planRows] = await conn.execute(
        `SELECT id_plan, codigo, nombre, vigencia_meses, precio_mensual
         FROM membresia_planes
         WHERE LOWER(codigo) = ? OR LOWER(nombre) = ?
         LIMIT 1`,
        [requestedPlanCode, requestedPlanCode]
      )
      resolvedPlan = planRows[0] || null
    }

    if (!resolvedPlan && latest?.id_plan) {
      const [planRows] = await conn.execute(
        `SELECT id_plan, codigo, nombre, vigencia_meses, precio_mensual
         FROM membresia_planes
         WHERE id_plan = ?
         LIMIT 1`,
        [latest.id_plan]
      )
      resolvedPlan = planRows[0] || null
    }

    if (!resolvedPlan && latest?.plan) {
      const legacyCode = normalizePlanCode(latest.plan)
      const [planRows] = await conn.execute(
        `SELECT id_plan, codigo, nombre, vigencia_meses, precio_mensual
         FROM membresia_planes
         WHERE LOWER(codigo) = ? OR LOWER(nombre) = ?
         LIMIT 1`,
        [legacyCode, legacyCode]
      )
      resolvedPlan = planRows[0] || null
    }

    if (!resolvedPlan) {
      throw new Error('No se pudo resolver un plan de membresia para el usuario')
    }

    const vigenciaMeses = Math.max(1, Number(resolvedPlan.vigencia_meses || 1))
    const montoFinal =
      monto === null || monto === undefined
        ? (resolvedPlan.precio_mensual ?? latest?.monto_mensual ?? null)
        : Number(monto)

    let idMembresia = latest?.id_membresia || null

    if (!idMembresia) {
      const [insertMembership] = await conn.execute(
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
         ) VALUES (
           ?, ?, ?, 'activa', CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? MONTH), ?, DATE_ADD(CURDATE(), INTERVAL ? MONTH), 0
         )`,
        [idUsuario, resolvedPlan.id_plan, resolvedPlan.codigo, vigenciaMeses, montoFinal, vigenciaMeses]
      )
      idMembresia = insertMembership.insertId
    } else {
      await conn.execute(
        `UPDATE membresias
         SET
           id_plan = ?,
           plan = ?,
           estado = 'activa',
           monto_mensual = ?,
           fecha_inicio = CASE
             WHEN estado = 'activa' AND pagado_hasta IS NOT NULL AND pagado_hasta >= CURDATE()
               THEN fecha_inicio
             ELSE CURDATE()
           END,
           pagado_hasta = DATE_ADD(
             CASE
               WHEN estado = 'activa' AND pagado_hasta IS NOT NULL AND pagado_hasta >= CURDATE()
                 THEN pagado_hasta
               ELSE CURDATE()
             END,
             INTERVAL ? MONTH
           ),
           fecha_fin = DATE_ADD(
             CASE
               WHEN estado = 'activa' AND pagado_hasta IS NOT NULL AND pagado_hasta >= CURDATE()
                 THEN pagado_hasta
               ELSE CURDATE()
             END,
             INTERVAL ? MONTH
           )
         WHERE id_membresia = ?`,
        [resolvedPlan.id_plan, resolvedPlan.codigo, montoFinal, vigenciaMeses, vigenciaMeses, idMembresia]
      )
    }

    if (montoFinal !== null && montoFinal !== undefined) {
      await conn.execute(
        `INSERT INTO pagos_membresia (
           id_membresia,
           monto,
           moneda,
           metodo,
           estado,
           referencia_externa,
           fecha_pago
         ) VALUES (?, ?, 'ARS', ?, 'aprobado', ?, NOW())`,
        [idMembresia, Number(montoFinal), metodo, referenciaExterna || null]
      )
    }

    const [updatedRows] = await conn.execute(
      `SELECT
         m.id_membresia,
         m.id_usuario,
         m.plan,
         m.estado,
         DATE_FORMAT(m.fecha_inicio, '%d/%m/%Y') AS fecha_inicio,
         DATE_FORMAT(m.fecha_fin, '%d/%m/%Y') AS fecha_fin,
         DATE_FORMAT(m.pagado_hasta, '%d/%m/%Y') AS pagado_hasta,
         m.monto_mensual,
         mp.nombre AS plan_nombre
       FROM membresias m
       LEFT JOIN membresia_planes mp ON mp.id_plan = m.id_plan
       WHERE m.id_membresia = ?
       LIMIT 1`,
      [idMembresia]
    )

    await conn.commit()
    return updatedRows[0] || null
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

module.exports = {
  listUsuariosAdmin,
  findUsuarioBaseById,
  findPacienteMedicosVinculados,
  findMedicoClinicas,
  findMedicoCoberturaGerente,
  findAsistenteMedicos,
  findAsistenteClinicas,
  findGerenteClinicas,
  findGerenteMedicos,
  findPagosByUsuario,
  getFinanzasResumen,
  listFinanzasMensual,
  listFinanzasMovimientos,
  findUserSubscriptionByEmail,
  reactivateMembershipByUser,
}
