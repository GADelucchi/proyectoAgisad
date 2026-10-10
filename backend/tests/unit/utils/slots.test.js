const {
  toMinutes,
  toTime,
  getDayOfWeek,
  fechasEntre,
  isSlotBlocked,
  unirFranjas,
  armarSlots,
  estadoDelDia,
} = require('../../../src/utils/slots')

describe('conversión de horas', () => {
  it.each([
    ['09:30', 570],
    ['09:30:00', 570],
    [null, 0],
    ['basura', 0],
  ])('toMinutes(%p) = %p', (input, expected) => {
    expect(toMinutes(input)).toBe(expected)
  })

  it('toTime arma HH:MM:SS', () => {
    expect(toTime(570)).toBe('09:30:00')
    expect(toTime(0)).toBe('00:00:00')
  })
})

describe('fechas', () => {
  it('getDayOfWeek usa la fecha local', () => {
    expect(getDayOfWeek('2026-10-19')).toBe(1)
    expect(getDayOfWeek('2026-10-25')).toBe(0)
  })

  it('fechasEntre incluye ambos extremos y cruza meses', () => {
    expect(fechasEntre('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(fechasEntre('2026-10-19', '2026-10-19')).toEqual(['2026-10-19'])
    expect(fechasEntre('2026-10-20', '2026-10-19')).toEqual([])
  })
})

describe('isSlotBlocked', () => {
  it('un bloqueo sin horas cubre el día', () => {
    expect(isSlotBlocked({ slotHora: '09:00:00', bloqueos: [{ hora_inicio: null, hora_fin: null }] })).toBe(true)
  })

  it('un bloqueo con horas cubre [inicio, fin)', () => {
    const bloqueos = [{ hora_inicio: '10:00', hora_fin: '11:00' }]
    expect(isSlotBlocked({ slotHora: '10:30:00', bloqueos })).toBe(true)
    expect(isSlotBlocked({ slotHora: '11:00:00', bloqueos })).toBe(false)
    expect(isSlotBlocked({ slotHora: '09:30:00', bloqueos })).toBe(false)
  })
})

describe('armarSlots', () => {
  const franjas = [{ id_disponibilidad: 5, hora_inicio: '09:00', hora_fin: '10:30' }]

  it('recorre la franja de a `paso` minutos sin pasarse del fin', () => {
    const slots = armarSlots({ franjas, paso: 30, duracionPedida: 30, ocupados: [], bloqueos: [] })
    expect(slots.map((s) => s.hora)).toEqual(['09:00:00', '09:30:00', '10:00:00'])
    expect(slots.every((s) => s.libre && s.id_disponibilidad === 5)).toBe(true)
  })

  it('marca ocupados los slots que pisan un turno según la duración pedida', () => {
    const ocupados = [{ start: toMinutes('10:00'), end: toMinutes('10:30') }]
    const conDuracionCorta = armarSlots({ franjas, paso: 30, duracionPedida: 30, ocupados, bloqueos: [] })
    expect(conDuracionCorta.map((s) => s.libre)).toEqual([true, true, false])

    const conDuracionLarga = armarSlots({ franjas, paso: 30, duracionPedida: 60, ocupados, bloqueos: [] })
    expect(conDuracionLarga.map((s) => s.libre)).toEqual([true, false, false])
  })

  it('un slot bloqueado no está libre', () => {
    const slots = armarSlots({ franjas, paso: 30, duracionPedida: 30, ocupados: [], bloqueos: [{ hora_inicio: '09:30', hora_fin: '10:00' }] })
    expect(slots[1]).toMatchObject({ bloqueado: true, libre: false })
  })
})

describe('unirFranjas', () => {
  it('une franjas contiguas o superpuestas y ordena', () => {
    expect(unirFranjas([
      { hora_inicio: '14:00', hora_fin: '16:00' },
      { hora_inicio: '09:00', hora_fin: '11:00' },
      { hora_inicio: '11:00', hora_fin: '12:00' },
      { hora_inicio: '15:00', hora_fin: '17:00' },
    ])).toEqual([
      { inicio: toMinutes('09:00'), fin: toMinutes('12:00') },
      { inicio: toMinutes('14:00'), fin: toMinutes('17:00') },
    ])
  })
})

describe('el turno tiene que terminar dentro del horario de atención', () => {
  // Atiende hasta las 11:30, grilla de 30 minutos, turno de 120 minutos.
  const franjas = [{ id_disponibilidad: 1, hora_inicio: '09:00', hora_fin: '11:30' }]
  const slots = armarSlots({ franjas, paso: 30, duracionPedida: 120, ocupados: [], bloqueos: [] })
  const slot = (hora) => slots.find((s) => s.hora === hora)

  it('a las 10:30 no se puede: terminaría 12:30', () => {
    expect(slot('10:30:00')).toMatchObject({ excede_horario: true, libre: false, bloqueado: false })
  })

  it('a las 09:30 sí: termina justo a las 11:30', () => {
    expect(slot('09:30:00')).toMatchObject({ excede_horario: false, libre: true })
  })

  it('con franjas contiguas la atención es continua', () => {
    const conTarde = armarSlots({
      franjas: [...franjas, { id_disponibilidad: 2, hora_inicio: '11:30', hora_fin: '13:00' }],
      paso: 30,
      duracionPedida: 120,
      ocupados: [],
      bloqueos: [],
    })
    expect(conTarde.find((s) => s.hora === '10:30:00')).toMatchObject({ excede_horario: false, libre: true })
    expect(conTarde.find((s) => s.hora === '11:30:00')).toMatchObject({ excede_horario: true, libre: false })
  })

  it('con un hueco entre franjas no se puede cruzar el hueco', () => {
    const conHueco = armarSlots({
      franjas: [...franjas, { id_disponibilidad: 2, hora_inicio: '14:00', hora_fin: '18:00' }],
      paso: 30,
      duracionPedida: 120,
      ocupados: [],
      bloqueos: [],
    })
    expect(conHueco.find((s) => s.hora === '10:30:00').excede_horario).toBe(true)
  })

  it('un día donde ningún turno entra queda sin horarios', () => {
    const corto = armarSlots({ franjas: [{ hora_inicio: '09:00', hora_fin: '10:00' }], paso: 30, duracionPedida: 120, ocupados: [], bloqueos: [] })
    expect(estadoDelDia(corto)).toBe('sin-horarios')
  })
})

describe('estadoDelDia', () => {
  it.each([
    [[{ libre: true, bloqueado: false }, { libre: false, bloqueado: true }], 'disponible'],
    [[{ libre: false, bloqueado: true }], 'bloqueada'],
    [[{ libre: false, bloqueado: false }], 'sin-horarios'],
    [[], 'sin-horarios'],
  ])('%#: %p', (slots, estado) => {
    expect(estadoDelDia(slots)).toBe(estado)
  })
})
