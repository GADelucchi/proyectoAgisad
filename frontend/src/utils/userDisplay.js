export function getUserDisplayName(usuario, fallback = 'Usuario') {
  if (!usuario || typeof usuario !== 'object') return fallback

  const nombre = typeof usuario.nombre === 'string' ? usuario.nombre.trim() : ''
  if (nombre) return nombre

  const nombreCompleto = typeof usuario.nombre_completo === 'string' ? usuario.nombre_completo.trim() : ''
  if (nombreCompleto) return nombreCompleto

  const username = typeof usuario.username === 'string' ? usuario.username.trim() : ''
  if (username) return username

  const email = typeof usuario.email === 'string' ? usuario.email.trim() : ''
  if (email) return email.split('@')[0]

  return fallback
}

export function normalizeUserForUi(usuario) {
  if (!usuario || typeof usuario !== 'object') return null
  return {
    ...usuario,
    nombre: getUserDisplayName(usuario, 'Usuario'),
  }
}
