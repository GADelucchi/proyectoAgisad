function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4)
}

export function formatTimeDisplay(value) {
  const digits = onlyDigits(value)
  const hour = digits.slice(0, 2)
  const minute = digits.slice(2, 4)
  if (!hour && !minute) return ''
  if (digits.length <= 2) return hour
  return `${hour}:${minute}`
}

export function time24hFromDisplay(displayTime) {
  const digits = onlyDigits(displayTime)
  if (digits.length !== 4) return ''
  const hour = Number(digits.slice(0, 2))
  const minute = Number(digits.slice(2, 4))
  if (Number.isNaN(hour) || Number.isNaN(minute)) return ''
  if (hour < 0 || hour > 23) return ''
  if (minute < 0 || minute > 59) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function displayTimeFrom24h(timeValue) {
  if (!timeValue) return ''
  const match = String(timeValue).match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
  if (!match) return String(timeValue)
  return `${match[1]}:${match[2]}`
}