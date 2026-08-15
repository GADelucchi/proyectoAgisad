// Utilidades de validación y sanitización de inputs

const HttpError = require('./httpError')

const CODIGO_PAIS_AR = '54'
const LARGO_NACIONAL_AR = 10 // código de área + abonado, sin el 0 ni el 15

/**
 * Valida que un email tenga formato correcto
 * @param {string} email
 * @throws {HttpError} Si no es válido
 */
function validateEmail(email) {
  const trimmed = String(email || '').trim()

  if (!trimmed) {
    throw new HttpError(400, 'El email es obligatorio')
  }

  if (trimmed.length > 255) {
    throw new HttpError(400, 'El email no puede superar 255 caracteres')
  }

  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    throw new HttpError(400, 'El email no tiene un formato válido')
  }

  return trimmed
}

/**
 * Valida que una contraseña sea suficientemente fuerte
 * @param {string} password
 * @throws {HttpError} Si no es válida
 */
function validatePassword(password) {
  if (typeof password !== 'string') {
    throw new HttpError(400, 'La contraseña es obligatoria')
  }

  if (password.length < 8) {
    throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres')
  }

  if (password.length > 255) {
    throw new HttpError(400, 'La contraseña no puede superar 255 caracteres')
  }

  const hasLetter = /[A-Za-z]/.test(password)
  const hasNumber = /\d/.test(password)

  if (!hasLetter || !hasNumber) {
    throw new HttpError(400, 'La contraseña debe incluir letras y números')
  }

  return password
}

/**
 * Valida que un DNI sea válido (7-8 dígitos)
 * @param {string} dni
 * @throws {HttpError} Si no es válido
 */
function validateDNI(dni) {
  const trimmed = String(dni || '').trim()

  if (!trimmed) {
    throw new HttpError(400, 'El DNI es obligatorio')
  }

  if (!/^\d{7,8}$/.test(trimmed)) {
    throw new HttpError(400, 'El DNI debe tener 7 u 8 dígitos')
  }

  return trimmed
}

/**
 * Valida un teléfono y lo normaliza a formato E.164 (ej: +5492214563895).
 * Se guarda siempre con código de país y sin separadores.
 * @param {string} telefono
 * @param {boolean} required
 * @throws {HttpError} Si no es válido
 */
function validatePhoneNumber(telefono, required = false) {
  if (!telefono) {
    if (required) {
      throw new HttpError(400, 'El teléfono es obligatorio')
    }
    return null
  }

  const trimmed = String(telefono).trim()

  if (trimmed.length > 25) {
    throw new HttpError(400, 'El teléfono no puede superar 25 caracteres')
  }

  // Un "+" inicial para el código de país; el resto, números y separadores.
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) {
    throw new HttpError(400, 'El teléfono contiene caracteres no válidos')
  }

  const normalizado = normalizePhoneNumber(trimmed)
  const digitos = normalizado.slice(1)

  if (digitos.length < 8 || digitos.length > 15) {
    throw new HttpError(400, 'El teléfono debe tener entre 8 y 15 dígitos')
  }

  return normalizado
}

/**
 * Lleva un teléfono a E.164. Sin código de país explícito se asume Argentina móvil,
 * descartando el 0 de larga distancia y el 15 del abonado.
 * @param {string} valor - Ya validado en cuanto a caracteres permitidos
 * @returns {string} Teléfono con "+" y solo dígitos
 */
function normalizePhoneNumber(valor) {
  const traeCodigoPais = String(valor).trim().startsWith('+')
  let digitos = String(valor).replace(/\D/g, '')

  if (digitos.startsWith('00')) return `+${digitos.slice(2)}`
  if (traeCodigoPais && !digitos.startsWith(CODIGO_PAIS_AR)) return `+${digitos}`

  if (digitos.startsWith(`${CODIGO_PAIS_AR}9`)) digitos = digitos.slice(3)
  else if (digitos.startsWith(CODIGO_PAIS_AR) && digitos.length > LARGO_NACIONAL_AR) digitos = digitos.slice(2)

  digitos = digitos.replace(/^0/, '')

  // El 15 va después del código de área (2 a 4 dígitos) y sobra en el formato internacional.
  const conQuince = digitos.match(/^(\d{2,4})15(\d+)$/)
  if (conQuince && (conQuince[1] + conQuince[2]).length === LARGO_NACIONAL_AR) {
    digitos = conQuince[1] + conQuince[2]
  }

  if (digitos.length !== LARGO_NACIONAL_AR) {
    throw new HttpError(
      400,
      'Ingresá el teléfono con código de área, sin el 0 ni el 15 (ej: 2214563895), o con código de país (ej: +5492214563895)'
    )
  }

  return `+${CODIGO_PAIS_AR}9${digitos}`
}

/**
 * Valida un nombre (max 100 chars, alfanumérico + espacios)
 * @param {string} nombre
 * @param {string} fieldName - Para mensajes personalizados
 * @throws {HttpError} Si no es válido
 */
function validateName(nombre, fieldName = 'El nombre') {
  const trimmed = String(nombre || '').trim()

  if (!trimmed) {
    throw new HttpError(400, `${fieldName} es obligatorio`)
  }

  if (trimmed.length > 100) {
    throw new HttpError(400, `${fieldName} no puede superar 100 caracteres`)
  }

  // Alfanumérico, espacios, acentos, guiones (ñ, á, etc)
  if (!/^[a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s\-']+$/.test(trimmed)) {
    throw new HttpError(400, `${fieldName} contiene caracteres no válidos`)
  }

  return trimmed
}

/**
 * Valida un campo de texto con máximo de caracteres
 * @param {string} text
 * @param {number} maxLength
 * @param {string} fieldName - Para mensajes personalizados
 * @param {boolean} required
 * @throws {HttpError} Si no es válido
 */
function validateTextField(text, maxLength, fieldName = 'El campo', required = false) {
  if (!text) {
    if (required) {
      throw new HttpError(400, `${fieldName} es obligatorio`)
    }
    return null
  }

  const trimmed = String(text).trim()

  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${fieldName} no puede superar ${maxLength} caracteres`)
  }

  return trimmed
}

/**
 * Valida una matrícula (alfanumérica, max 20)
 * @param {string} matricula
 * @throws {HttpError} Si no es válida
 */
function validateMatricula(matricula) {
  const trimmed = String(matricula || '').trim()

  if (!trimmed) {
    throw new HttpError(400, 'La matrícula es obligatoria')
  }

  if (trimmed.length > 20) {
    throw new HttpError(400, 'La matrícula no puede superar 20 caracteres')
  }

  if (!/^[a-zA-Z0-9\-\/\.]+$/.test(trimmed)) {
    throw new HttpError(400, 'La matrícula contiene caracteres no válidos')
  }

  return trimmed
}

/**
 * Valida una fecha (formato YYYY-MM-DD)
 * @param {string} dateString
 * @param {string} fieldName
 * @throws {HttpError} Si no es válida
 */
function validateDate(dateString, fieldName = 'La fecha') {
  if (!dateString) {
    throw new HttpError(400, `${fieldName} es obligatoria`)
  }

  const trimmed = String(dateString).trim()

  // Formato YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new HttpError(400, `${fieldName} debe estar en formato YYYY-MM-DD`)
  }

  // Verificar que sea una fecha válida
  const date = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${fieldName} no es una fecha válida`)
  }

  return trimmed
}

/**
 * Escapa caracteres peligrosos para prevenir XSS
 * @param {string} text
 * @returns {string} Texto escapado
 */
function sanitizeHTML(text) {
  if (!text) return text

  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  }

  return String(text).replace(/[&<>"']/g, (char) => replacements[char])
}

/**
 * Sanitiza y valida un nombre de usuario
 * @param {string} username
 * @throws {HttpError} Si no es válido
 */
function validateUsername(username) {
  const trimmed = String(username || '').trim()

  if (!trimmed) {
    throw new HttpError(400, 'El usuario es obligatorio')
  }

  if (trimmed.length < 3 || trimmed.length > 50) {
    throw new HttpError(400, 'El usuario debe tener entre 3 y 50 caracteres')
  }

  if (!/^[a-zA-Z0-9_\-\.]+$/.test(trimmed)) {
    throw new HttpError(400, 'El usuario solo puede contener letras, números, guiones, puntos y guiones bajos')
  }

  return trimmed.toLowerCase()
}

module.exports = {
  validateEmail,
  validatePassword,
  validateDNI,
  validatePhoneNumber,
  validateName,
  validateTextField,
  validateMatricula,
  validateDate,
  sanitizeHTML,
  validateUsername,
}
