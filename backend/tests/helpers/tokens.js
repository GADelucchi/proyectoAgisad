const jwt = require('jsonwebtoken')

/** Header Authorization válido para el rol pedido, firmado con el secret de test. */
function authHeader(rol, overrides = {}) {
  const token = jwt.sign(
    {
      idUsuario: 10,
      rol,
      email: `${rol}@test.local`,
      username: rol,
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
  return `Bearer ${token}`
}

module.exports = { authHeader }
