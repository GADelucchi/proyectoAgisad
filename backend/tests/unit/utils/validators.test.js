const HttpError = require('../../../src/utils/httpError')
const {
  validateEmail,
  validatePassword,
  validateDNI,
  validatePhoneNumber,
  validateName,
  validateTextField,
  validateMatricula,
  validateDate,
} = require('../../../src/utils/validators')

function expectHttp400(fn, message) {
  let error
  try {
    fn()
  } catch (err) {
    error = err
  }
  expect(error).toBeInstanceOf(HttpError)
  expect(error.status).toBe(400)
  if (message) expect(error.message).toMatch(message)
}

describe('validateEmail', () => {
  it('devuelve el email sin espacios', () => {
    expect(validateEmail('  ana@mail.com ')).toBe('ana@mail.com')
  })

  it.each([
    [undefined, /obligatorio/],
    ['', /obligatorio/],
    ['sin-arroba', /formato/],
    ['a@b', /formato/],
    ['a b@c.com', /formato/],
  ])('rechaza %p', (value, message) => {
    expectHttp400(() => validateEmail(value), message)
  })

  it('rechaza emails de más de 255 caracteres', () => {
    expectHttp400(() => validateEmail(`${'a'.repeat(250)}@mail.com`), /255/)
  })
})

describe('validatePassword', () => {
  it('acepta letras + números de 8 o más caracteres', () => {
    expect(validatePassword('clave1234')).toBe('clave1234')
  })

  it.each([
    [undefined, /obligatoria/],
    [12345678, /obligatoria/],
    ['abc12', /8 caracteres/],
    ['soloLetras', /letras y números/],
    ['12345678', /letras y números/],
  ])('rechaza %p', (value, message) => {
    expectHttp400(() => validatePassword(value), message)
  })

  it('rechaza contraseñas de más de 255 caracteres', () => {
    expectHttp400(() => validatePassword(`a1${'x'.repeat(260)}`), /255/)
  })
})

describe('validateDNI', () => {
  it.each(['1234567', '12345678', ' 30111222 '])('acepta %p', (value) => {
    expect(validateDNI(value)).toBe(value.trim())
  })

  it.each([
    ['', /obligatorio/],
    ['123456', /7 u 8/],
    ['123456789', /7 u 8/],
    ['12.345.678', /7 u 8/],
  ])('rechaza %p', (value, message) => {
    expectHttp400(() => validateDNI(value), message)
  })
})

describe('validatePhoneNumber', () => {
  it('devuelve null si no es obligatorio y viene vacío', () => {
    expect(validatePhoneNumber('')).toBeNull()
    expect(validatePhoneNumber(undefined, false)).toBeNull()
  })

  it('exige el teléfono cuando es obligatorio', () => {
    expectHttp400(() => validatePhoneNumber('', true), /obligatorio/)
  })

  it.each([
    ['2214563895', '+5492214563895'],
    ['0221 15 456-3895', '+5492214563895'],
    ['+54 9 221 456 3895', '+5492214563895'],
    ['(011) 15-2345-6789', '+5491123456789'],
    ['11 15 2345 6789', '+5491123456789'],
    ['0054 9 11 2345 6789', '+5491123456789'],
    ['5491123456789', '+5491123456789'],
    ['541123456789', '+5491123456789'],
    ['+1 555 123 4567', '+15551234567'],
  ])('normaliza %p a E.164 (%p)', (input, expected) => {
    expect(validatePhoneNumber(input)).toBe(expected)
  })

  it('rechaza caracteres no numéricos', () => {
    expectHttp400(() => validatePhoneNumber('221-abc-1234'), /caracteres no válidos/)
  })

  it('rechaza teléfonos de más de 25 caracteres', () => {
    expectHttp400(() => validatePhoneNumber('1'.repeat(26)), /25 caracteres/)
  })

  it('rechaza números argentinos sin código de área completo', () => {
    expectHttp400(() => validatePhoneNumber('4563895'), /código de área/)
  })

  it('rechaza internacionales con menos de 8 dígitos', () => {
    expectHttp400(() => validatePhoneNumber('+1 234 56'), /entre 8 y 15/)
  })
})

describe('validateName', () => {
  it('acepta acentos, ñ, guiones y apóstrofes', () => {
    expect(validateName("  José María O'Higgins-Núñez ")).toBe("José María O'Higgins-Núñez")
  })

  it('usa el nombre del campo en el mensaje', () => {
    expectHttp400(() => validateName('', 'El apellido'), 'El apellido es obligatorio')
  })

  it('rechaza números y símbolos', () => {
    expectHttp400(() => validateName('Ana3'), /caracteres no válidos/)
    expectHttp400(() => validateName('Ana<script>'), /caracteres no válidos/)
  })

  it('rechaza más de 100 caracteres', () => {
    expectHttp400(() => validateName('a'.repeat(101)), /100/)
  })
})

describe('validateTextField', () => {
  it('devuelve null si es opcional y viene vacío', () => {
    expect(validateTextField('', 10)).toBeNull()
    expect(validateTextField(null, 10, 'El motivo', false)).toBeNull()
  })

  it('exige el campo cuando es obligatorio', () => {
    expectHttp400(() => validateTextField('', 10, 'El motivo', true), 'El motivo es obligatorio')
  })

  it('recorta espacios y respeta el máximo', () => {
    expect(validateTextField('  hola  ', 4)).toBe('hola')
    expectHttp400(() => validateTextField('hola!', 4, 'El asunto'), 'El asunto no puede superar 4 caracteres')
  })
})

describe('validateMatricula', () => {
  it.each(['MP-1234', '12/345', 'MN.556'])('acepta %p', (value) => {
    expect(validateMatricula(value)).toBe(value)
  })

  it.each([
    ['', /obligatoria/],
    ['a'.repeat(21), /20/],
    ['MP 1234', /no válidos/],
  ])('rechaza %p', (value, message) => {
    expectHttp400(() => validateMatricula(value), message)
  })
})

describe('validateDate', () => {
  it('acepta YYYY-MM-DD', () => {
    expect(validateDate(' 2026-10-08 ')).toBe('2026-10-08')
  })

  it.each([
    [undefined, /obligatoria/],
    ['08/10/2026', /YYYY-MM-DD/],
    ['2026-13-01', /no es una fecha válida/],
    ['2024-02-30', /no es una fecha válida/],
    ['2023-02-29', /no es una fecha válida/],
    ['2026-04-31', /no es una fecha válida/],
    ['2026-00-10', /no es una fecha válida/],
  ])('rechaza %p', (value, message) => {
    expectHttp400(() => validateDate(value), message)
  })

  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(validateDate('2024-02-29')).toBe('2024-02-29')
  })

  it('usa el nombre del campo en el mensaje', () => {
    expectHttp400(() => validateDate('', 'La fecha de nacimiento'), 'La fecha de nacimiento es obligatoria')
  })
})
