const { query } = require('../../db/query')

async function findUserByEmail(email) {
  const rows = await query(
    `SELECT u.id_usuario, u.id_rol, u.username, u.email, u.password_hash, u.activo, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
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
