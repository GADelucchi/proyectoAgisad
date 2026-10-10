// Misma regla que validatePassword del backend (backend/src/utils/validators.js):
// si cambia una, tiene que cambiar la otra.
export const PASSWORD_HINT = 'Mínimo 8, con letras y números'

/** Devuelve el mensaje de error, o null si la contraseña es válida. */
export function validarPassword(password) {
  if (!password || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'La contraseña debe incluir letras y números.'
  return null
}
