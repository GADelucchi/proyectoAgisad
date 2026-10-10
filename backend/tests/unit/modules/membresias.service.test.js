jest.mock('../../../src/db/query', () => ({ query: jest.fn() }))

const { query } = require('../../../src/db/query')
const membresias = require('../../../src/modules/membresias/membresias.service')

/**
 * Simula la base respondiendo según qué tabla consulta cada query. Así cada
 * test describe el escenario (membresía propia, cobertura de gerente) sin
 * depender del orden exacto de las llamadas.
 */
function mockDb({ propia = null, medico = { id_medico: 3 }, beneficio = null, gerente = null, idUsuarioDeMedico = 60 } = {}) {
  query.mockImplementation(async (sql, params) => {
    if (sql.includes('FROM membresias m')) {
      if (params.idUsuario === 900) return gerente ? [gerente] : []
      return propia ? [propia] : []
    }
    if (sql.includes('FROM medicos') && sql.includes('id_usuario = :idUsuario')) return medico ? [medico] : []
    if (sql.includes('FROM medicos') && sql.includes('id_medico = :idMedico')) {
      return idUsuarioDeMedico ? [{ id_usuario: idUsuarioDeMedico }] : []
    }
    if (sql.includes('gerente_medico_beneficios')) return beneficio ? [beneficio] : []
    throw new Error(`query no esperada: ${sql}`)
  })
}

const vigente = { activa_vigente: 1, permite_turnos: 1, permite_asistentes: 0 }
const vencida = { activa_vigente: 0, permite_turnos: 1, permite_asistentes: 1 }

describe('normalizePlanCode', () => {
  it.each([
    ['Starter', 'inicial'],
    ['  medium ', 'medio'],
    ['Professional', 'profesional'],
    ['gestion', 'empresarial'],
    ['Plan Especial!', 'plan_especial'],
    [null, ''],
  ])('%p -> %p', (input, expected) => {
    expect(membresias.normalizePlanCode(input)).toBe(expected)
  })
})

describe('validarPlanRegistrable', () => {
  it('sin plan devuelve null', () => {
    expect(membresias.validarPlanRegistrable(undefined, 'medico')).toBeNull()
    expect(membresias.validarPlanRegistrable('', 'gerente')).toBeNull()
  })

  it.each([
    ['Medio', 'medico', 'medio'],
    ['starter', 'medico', 'inicial'],
    ['Empresarial', 'medico', 'empresarial'],
    ['gestion', 'gerente', 'empresarial'],
    ['espacios', 'propietario', 'espacios'],
  ])('acepta %p para %p como %p', (plan, rol, codigo) => {
    expect(membresias.validarPlanRegistrable(plan, rol)).toBe(codigo)
  })

  it.each([
    ['legacy', 'medico'],
    ['pro', 'gerente'],
    ['enterprise', 'gerente'],
    ['medio', 'gerente'],
    ['empresarial', 'propietario'],
    ['medio', 'paciente'],
  ])('rechaza %p para %p', (plan, rol) => {
    expect(() => membresias.validarPlanRegistrable(plan, rol)).toThrow('El plan elegido no está disponible')
  })
})

describe('getCurrentMembershipByUserId / findUserIdByMedicoId', () => {
  it('devuelve la última membresía o null', async () => {
    mockDb({ propia: vigente })
    await expect(membresias.getCurrentMembershipByUserId(60)).resolves.toEqual(vigente)

    mockDb()
    await expect(membresias.getCurrentMembershipByUserId(60)).resolves.toBeNull()
  })

  it('resuelve el usuario de un médico', async () => {
    mockDb()
    await expect(membresias.findUserIdByMedicoId(3)).resolves.toBe(60)

    mockDb({ idUsuarioDeMedico: null })
    await expect(membresias.findUserIdByMedicoId(3)).resolves.toBeNull()
  })
})

describe('assertUserFeatureByUserId', () => {
  const args = { idUsuario: 60, feature: 'permite_turnos', denyMessage: 'Sin turnos' }

  it('con membresía vigente y feature habilitada la devuelve', async () => {
    mockDb({ propia: vigente })
    await expect(membresias.assertUserFeatureByUserId(args)).resolves.toEqual(vigente)
  })

  it('con membresía vigente pero sin la feature responde 403 con el mensaje dado', async () => {
    mockDb({ propia: vigente })
    await expect(membresias.assertUserFeatureByUserId({ ...args, feature: 'permite_asistentes' })).rejects.toMatchObject({
      status: 403,
      message: 'Sin turnos',
    })
  })

  it('sin membresía ni cobertura responde 402', async () => {
    mockDb()
    await expect(membresias.assertUserFeatureByUserId(args)).rejects.toMatchObject({
      status: 402,
      message: 'No tenes una membresia activa para acceder a este modulo',
    })
  })

  it('con membresía vencida y sin cobertura responde 402', async () => {
    mockDb({ propia: vencida })
    await expect(membresias.assertUserFeatureByUserId(args)).rejects.toMatchObject({
      status: 402,
      message: 'Tu membresia esta vencida o inactiva',
    })
  })

  it('un médico con membresía vencida usa el plan del gerente que lo cubre', async () => {
    const planGerente = { activa_vigente: 1, permite_turnos: 1, permite_asistentes: 1 }
    mockDb({ propia: vencida, beneficio: { id_usuario_gerente: 900 }, gerente: planGerente })

    await expect(membresias.assertUserFeatureByUserId({ ...args, feature: 'permite_asistentes' })).resolves.toEqual({
      ...planGerente,
      origen: 'gerente',
    })
  })

  it('no usa la cobertura si la membresía del gerente también está vencida', async () => {
    mockDb({ propia: null, beneficio: { id_usuario_gerente: 900 }, gerente: vencida })
    await expect(membresias.assertUserFeatureByUserId(args)).rejects.toMatchObject({ status: 402 })
  })

  it('un usuario sin perfil de médico no tiene cobertura', async () => {
    mockDb({ propia: null, medico: null })
    await expect(membresias.assertUserFeatureByUserId(args)).rejects.toMatchObject({ status: 402 })
  })
})

describe('assertMedicoFeatureByMedicoId', () => {
  it('responde 404 si el médico no existe', async () => {
    mockDb({ idUsuarioDeMedico: null })
    await expect(
      membresias.assertMedicoFeatureByMedicoId({ idMedico: 3, feature: 'permite_turnos' })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('delega en el usuario del médico', async () => {
    mockDb({ propia: vigente })
    await expect(membresias.assertMedicoFeatureByMedicoId({ idMedico: 3, feature: 'permite_turnos' })).resolves.toEqual(vigente)
  })

  it('usa un mensaje genérico si no se indica uno', async () => {
    mockDb({ propia: vigente })
    await expect(
      membresias.assertMedicoFeatureByMedicoId({ idMedico: 3, feature: 'permite_asistentes' })
    ).rejects.toMatchObject({ message: 'Tu plan actual no incluye este modulo' })
  })
})

describe('assertMembershipNotExpired', () => {
  it('acepta la membresía propia vigente', async () => {
    mockDb({ propia: vigente })
    await expect(membresias.assertMembershipNotExpired(60)).resolves.toEqual(vigente)
  })

  it('acepta la cobertura de un gerente', async () => {
    mockDb({ propia: vencida, beneficio: { id_usuario_gerente: 900 }, gerente: vigente })
    await expect(membresias.assertMembershipNotExpired(60)).resolves.toMatchObject({ origen: 'gerente' })
  })

  it('responde 402 con la acción en el mensaje', async () => {
    mockDb({ propia: vencida })
    await expect(membresias.assertMembershipNotExpired(60, 'Pedir recetas')).rejects.toMatchObject({
      status: 402,
      message: expect.stringMatching(/^Pedir recetas no está disponible/),
    })
  })

  it('por médico responde 404 si no existe', async () => {
    mockDb({ idUsuarioDeMedico: null })
    await expect(membresias.assertMembershipNotExpiredByMedicoId(3)).rejects.toMatchObject({ status: 404 })
  })

  it('por médico delega en su usuario', async () => {
    mockDb({ propia: vigente })
    await expect(membresias.assertMembershipNotExpiredByMedicoId(3)).resolves.toEqual(vigente)
  })
})

describe('assertOwnMembershipActive', () => {
  it('acepta solo la membresía propia vigente', async () => {
    mockDb({ propia: vigente })
    await expect(membresias.assertOwnMembershipActive(60)).resolves.toEqual(vigente)
  })

  it('ignora la cobertura del gerente', async () => {
    mockDb({ propia: vencida, beneficio: { id_usuario_gerente: 900 }, gerente: vigente })
    await expect(membresias.assertOwnMembershipActive(60, 'Agregar una clínica propia')).rejects.toMatchObject({
      status: 402,
      message: expect.stringMatching(/^Agregar una clínica propia/),
    })
  })

  it('responde 402 sin membresía', async () => {
    mockDb()
    await expect(membresias.assertOwnMembershipActive(60)).rejects.toMatchObject({ status: 402 })
  })
})
