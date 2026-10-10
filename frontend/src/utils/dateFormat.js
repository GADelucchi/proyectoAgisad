const APP_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE
const APP_LOCALE = import.meta.env.VITE_APP_LOCALE

function parseAsDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  if (typeof value === 'string') {
    const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (ymd) {
      const [, y, m, d] = ymd
      return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0)
    }
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDateDdMmYyyy(date) {
  const value = parseAsDate(date)
  if (!value) return ''
  if (!APP_TIMEZONE || !APP_LOCALE) {
    throw new Error('Faltan VITE_APP_TIMEZONE o VITE_APP_LOCALE en el entorno del frontend')
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  }).format(value)
}

export function formatTime24h(timeOrDate) {
  if (!timeOrDate) return ''

  if (typeof timeOrDate === 'string') {
    const hhmm = timeOrDate.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
    if (hhmm) {
      return `${hhmm[1]}:${hhmm[2]}`
    }
  }

  const value = parseAsDate(timeOrDate)
  if (!value) return ''

  if (!APP_TIMEZONE || !APP_LOCALE) {
    throw new Error('Faltan VITE_APP_TIMEZONE o VITE_APP_LOCALE en el entorno del frontend')
  }

  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: APP_TIMEZONE,
  }).format(value)
}
