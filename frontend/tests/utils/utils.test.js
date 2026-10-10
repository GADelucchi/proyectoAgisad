import { describe, expect, it } from 'vitest'
import { formatDateDdMmYyyy, formatTime24h } from '../../src/utils/dateFormat'
import { displayDateFromIso, formatDateDisplay, isoDateFromDisplay } from '../../src/utils/smartDateInput'
import { displayTimeFrom24h, formatTimeDisplay, time24hFromDisplay } from '../../src/utils/smartTimeInput'
import { getUserDisplayName, normalizeUserForUi } from '../../src/utils/userDisplay'
import { PASSWORD_HINT, validarPassword } from '../../src/utils/password'

describe('dateFormat', () => {
  it('formatea fechas ISO sin correrlas de día por la zona horaria', () => {
    expect(formatDateDdMmYyyy('2026-10-08')).toBe('08/10/2026')
    expect(formatDateDdMmYyyy('2026-01-01')).toBe('01/01/2026')
  })

  it('acepta Date y timestamps', () => {
    expect(formatDateDdMmYyyy(new Date(2026, 9, 8, 12))).toBe('08/10/2026')
    expect(formatDateDdMmYyyy('2026-10-08T15:00:00Z')).toBe('08/10/2026')
  })

  it('devuelve vacío para valores inválidos', () => {
    expect(formatDateDdMmYyyy('')).toBe('')
    expect(formatDateDdMmYyyy(null)).toBe('')
    expect(formatDateDdMmYyyy('no es fecha')).toBe('')
    expect(formatDateDdMmYyyy(new Date('x'))).toBe('')
  })

  it('formatTime24h recorta segundos de strings HH:MM:SS', () => {
    expect(formatTime24h('09:30:00')).toBe('09:30')
    expect(formatTime24h('18:05')).toBe('18:05')
  })

  it('formatTime24h formatea fechas completas en la zona de la app', () => {
    expect(formatTime24h('2026-10-08T15:00:00Z')).toBe('12:00')
    expect(formatTime24h('')).toBe('')
    expect(formatTime24h('nada')).toBe('')
  })
})

describe('smartDateInput', () => {
  it.each([
    ['0', '0'],
    ['081', '08/1'],
    ['08102026', '08/10/2026'],
    ['08/10/2026', '08/10/2026'],
    ['08-10-20261234', '08/10/2026'],
    ['ab', ''],
  ])('formatDateDisplay(%p) = %p', (input, expected) => {
    expect(formatDateDisplay(input)).toBe(expected)
  })

  it('convierte entre ISO y dd/mm/aaaa', () => {
    expect(displayDateFromIso('2026-10-08')).toBe('08/10/2026')
    expect(displayDateFromIso('')).toBe('')
    expect(displayDateFromIso('2026-10')).toBe('2026-10')
    expect(isoDateFromDisplay('08/10/2026')).toBe('2026-10-08')
    expect(isoDateFromDisplay('08/10/26')).toBe('')
  })

  it.each(['30/02/2026', '29/02/2023', '31/04/2026', '00/10/2026', '10/13/2026'])('descarta la fecha inexistente %p', (value) => {
    expect(isoDateFromDisplay(value)).toBe('')
  })

  it('acepta el 29/02 de un año bisiesto', () => {
    expect(isoDateFromDisplay('29/02/2024')).toBe('2024-02-29')
  })
})

describe('smartTimeInput', () => {
  it.each([
    ['', ''],
    ['9', '9'],
    ['09', '09'],
    ['093', '09:3'],
    ['0930', '09:30'],
    ['09:30:45', '09:30'],
  ])('formatTimeDisplay(%p) = %p', (input, expected) => {
    expect(formatTimeDisplay(input)).toBe(expected)
  })

  it.each([
    ['09:30', '09:30'],
    ['2359', '23:59'],
    ['2400', ''],
    ['1260', ''],
    ['930', ''],
  ])('time24hFromDisplay(%p) = %p', (input, expected) => {
    expect(time24hFromDisplay(input)).toBe(expected)
  })

  it('displayTimeFrom24h recorta segundos y deja pasar lo que no reconoce', () => {
    expect(displayTimeFrom24h('09:30:00')).toBe('09:30')
    expect(displayTimeFrom24h('')).toBe('')
    expect(displayTimeFrom24h('9.30')).toBe('9.30')
  })
})

describe('password (misma regla que el backend)', () => {
  it.each([
    ['', 'La contraseña debe tener al menos 8 caracteres.'],
    ['abc123', 'La contraseña debe tener al menos 8 caracteres.'],
    ['soloLetras', 'La contraseña debe incluir letras y números.'],
    ['12345678', 'La contraseña debe incluir letras y números.'],
    ['clave1234', null],
  ])('validarPassword(%p)', (value, expected) => {
    expect(validarPassword(value)).toBe(expected)
  })

  it('el hint describe la regla', () => {
    expect(PASSWORD_HINT).toMatch(/8/)
  })
})

describe('userDisplay', () => {
  it('usa nombre, nombre_completo, username o la parte local del email', () => {
    expect(getUserDisplayName({ nombre: ' Ana ' })).toBe('Ana')
    expect(getUserDisplayName({ nombre: ' ', nombre_completo: 'Ana Paz' })).toBe('Ana Paz')
    expect(getUserDisplayName({ username: 'anap' })).toBe('anap')
    expect(getUserDisplayName({ email: 'ana@x.com' })).toBe('ana')
  })

  it('usa el fallback si no hay datos', () => {
    expect(getUserDisplayName(null)).toBe('Usuario')
    expect(getUserDisplayName({}, 'Invitado')).toBe('Invitado')
    expect(getUserDisplayName('texto')).toBe('Usuario')
  })

  it('normalizeUserForUi completa el nombre y conserva el resto', () => {
    expect(normalizeUserForUi({ email: 'ana@x.com', rol: 'paciente' })).toEqual({ email: 'ana@x.com', rol: 'paciente', nombre: 'ana' })
    expect(normalizeUserForUi(null)).toBeNull()
  })
})
