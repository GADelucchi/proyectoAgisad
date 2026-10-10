function onlyDigits(value) {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function formatDateDisplay(value) {
  const digits = onlyDigits(value)
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  const parts = []
  if (day) parts.push(day)
  if (month) parts.push(month)
  if (year) parts.push(year)
  return parts.join('/')
}

export function displayDateFromIso(isoDate) {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}

/** dd/mm/aaaa → aaaa-mm-dd, o '' si la fecha está incompleta o no existe (ej. 30/02). */
export function isoDateFromDisplay(displayDate) {
  const digits = onlyDigits(displayDate)
  if (digits.length !== 8) return ''
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)

  const date = new Date(Number(year), Number(month) - 1, Number(day))
  const existe = date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day)
  return existe ? `${year}-${month}-${day}` : ''
}
