const { query } = require('../../db/query')

async function findUserByEmail(email) {
  const rows = await query(
    `SELECT
       u.id_usuario,
       u.id_rol,
       u.username,
       u.email,
       u.password_hash,
       u.activo,
       r.nombre AS rol,
       ms.id_membresia,
       ms.plan AS plan_codigo,
       ms.estado AS membresia_estado,
       ms.pagado_hasta AS membresia_pagado_hasta,
       CASE
         WHEN ms.id_membresia IS NULL THEN 0
         WHEN ms.estado = 'activa' AND (ms.pagado_hasta IS NULL OR ms.pagado_hasta >= CURDATE()) THEN 1
         ELSE 0
       END AS membresia_activa_vigente,
       COALESCE(mp.nombre, ms.plan) AS plan_nombre,
       COALESCE(mp.permite_turnos, 1) AS permite_turnos,
       COALESCE(mp.permite_asistentes, 1) AS permite_asistentes,
       mp.limite_asistentes,
       COALESCE(
         CONCAT(p.nombre, ' ', p.apellido),
         CONCAT(m.nombre, ' ', m.apellido),
         CONCAT(g.nombre, ' ', g.apellido),
         CONCAT(a.nombre, ' ', a.apellido),
         u.username
       ) AS nombre
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     LEFT JOIN pacientes p ON p.id_usuario = u.id_usuario
     LEFT JOIN medicos m ON m.id_usuario = u.id_usuario
     LEFT JOIN gerentes g ON g.id_usuario = u.id_usuario
     LEFT JOIN asistentes a ON a.id_usuario = u.id_usuario
     LEFT JOIN (
       SELECT m1.*
       FROM membresias m1
       INNER JOIN (
         SELECT id_usuario, MAX(id_membresia) AS id_membresia
         FROM membresias
         GROUP BY id_usuario
       ) latest ON latest.id_membresia = m1.id_membresia
     ) ms ON ms.id_usuario = u.id_usuario
     LEFT JOIN membresia_planes mp
       ON mp.id_plan = ms.id_plan OR LOWER(mp.codigo) = LOWER(ms.plan)
     WHERE u.email = :email
     LIMIT 1`,
    { email }
  )
  return rows[0] || null
}

async function findRoleIdByName(roleName) {
  const rows = await query('SELECT id_rol FROM roles WHERE nombre = :roleName LIMIT 1', { roleName })
  return rows[0]?.id_rol || null
}

async function existsUsername(username) {
  const rows = await query(
    'SELECT 1 AS ok FROM usuarios WHERE username = :username LIMIT 1',
    { username }
  )
  return Boolean(rows[0])
}

async function findEspecialidadIdByName(nombre) {
  const rows = await query(
    'SELECT id_especialidad FROM especialidades WHERE nombre = :nombre LIMIT 1',
    { nombre }
  )
  return rows[0]?.id_especialidad || null
}

async function updateUltimoLogin(idUsuario) {
  await query(
    `UPDATE usuarios
     SET ultimo_login = NOW()
     WHERE id_usuario = :idUsuario`,
    { idUsuario }
  )
}

module.exports = {
  findUserByEmail,
  findRoleIdByName,
  existsUsername,
  findEspecialidadIdByName,
  updateUltimoLogin,
}
