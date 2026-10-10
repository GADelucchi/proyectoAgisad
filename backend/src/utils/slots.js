// Cálculo de la grilla de turnos de un día. Funciones puras: las usan la
// disponibilidad de un médico y la de un consultorio compartido, para un día
// o para un rango de fechas.

function toMinutes(value) {
  const [h, m] = String(value || '').slice(0, 5).split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function toTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}:00`
}

function getDayOfWeek(dateIso) {
  return new Date(`${dateIso}T00:00:00`).getDay()
}

function formatLocalDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Fechas YYYY-MM-DD desde `desde` hasta `hasta`, inclusive. */
function fechasEntre(desde, hasta) {
  const fechas = []
  const cursor = new Date(`${desde}T00:00:00`)
  const fin = new Date(`${hasta}T00:00:00`)
  while (cursor <= fin) {
    fechas.push(formatLocalDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return fechas
}

/** Un bloqueo sin horas cubre el día entero. */
function isSlotBlocked({ slotHora, bloqueos }) {
  const slot = String(slotHora).slice(0, 5)
  for (const b of bloqueos) {
    const from = b.hora_inicio ? String(b.hora_inicio).slice(0, 5) : null
    const to = b.hora_fin ? String(b.hora_fin).slice(0, 5) : null
    if (!from || !to) return true
    if (slot >= from && slot < to) return true
  }
  return false
}

/**
 * Intervalos de atención del día ({ inicio, fin } en minutos), uniendo las
 * franjas que se pisan o son contiguas: 9-11 y 11-13 es atención continua.
 */
function unirFranjas(franjas) {
  const intervalos = franjas
    .map((f) => ({ inicio: toMinutes(f.hora_inicio), fin: toMinutes(f.hora_fin) }))
    .filter((i) => i.fin > i.inicio)
    .sort((a, b) => a.inicio - b.inicio)

  const unidos = []
  for (const intervalo of intervalos) {
    const ultimo = unidos[unidos.length - 1]
    if (ultimo && intervalo.inicio <= ultimo.fin) {
      ultimo.fin = Math.max(ultimo.fin, intervalo.fin)
    } else {
      unidos.push({ ...intervalo })
    }
  }
  return unidos
}

/**
 * Slots de un día. La grilla avanza de a `paso` minutos dentro de cada franja.
 * Un slot está libre si un turno de `duracionPedida` que empiece ahí:
 * - no está bloqueado,
 * - no pisa ningún turno `ocupado` ({ start, end } en minutos),
 * - termina dentro del horario de atención (`excede_horario` si no).
 */
function armarSlots({ franjas, paso, duracionPedida, ocupados, bloqueos }) {
  const atencion = unirFranjas(franjas)
  const slots = []

  for (const franja of franjas) {
    const inicio = toMinutes(franja.hora_inicio)
    const fin = toMinutes(franja.hora_fin)

    for (let t = inicio; t + paso <= fin; t += paso) {
      const hora = toTime(t)
      const bloqueado = isSlotBlocked({ slotHora: hora, bloqueos })
      const overlaps = ocupados.some((o) => t < o.end && o.start < t + duracionPedida)
      const finAtencion = atencion.find((i) => t >= i.inicio && t < i.fin)?.fin ?? fin
      const excedeHorario = t + duracionPedida > finAtencion
      slots.push({
        hora,
        id_disponibilidad: franja.id_disponibilidad,
        bloqueado,
        excede_horario: excedeHorario,
        libre: !overlaps && !bloqueado && !excedeHorario,
      })
    }
  }
  return slots
}

/** Resumen de un día para el calendario del paciente. */
function estadoDelDia(slots) {
  if (slots.some((slot) => slot.libre)) return 'disponible'
  if (slots.some((slot) => slot.bloqueado)) return 'bloqueada'
  return 'sin-horarios'
}

module.exports = {
  toMinutes,
  toTime,
  getDayOfWeek,
  formatLocalDate,
  fechasEntre,
  isSlotBlocked,
  unirFranjas,
  armarSlots,
  estadoDelDia,
}
