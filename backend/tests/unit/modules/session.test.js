jest.mock('../../../src/modules/auth/auth.repository')

const jwt = require('jsonwebtoken')
const authRepo = require('../../../src/modules/auth/auth.repository')
const { buildTokenPayload, buildUserPayload, issueSession } = require('../../../src/modules/auth/session')

const medico = {
  id_usuario: 5,
  id_rol: 2,
  rol: 'medico',
  username: 'doc',
  email: 'doc@x.com',
  nombre: 'Juan',
  id_membresia: 9,
  plan_codigo: 'medio',
  plan_nombre: 'Medio',
  membresia_estado: 'activa',
  membresia_pagado_hasta: '2026-11-01',
  es_trial: 0,
  membresia_activa_vigente: 1,
  permite_turnos: 1,
  permite_asistentes: 0,
  limite_asistentes: '3',
  permite_publicar_consultorio: 1,
}

describe('buildTokenPayload', () => {
  it('incluye solo datos de identidad', () => {
    expect(buildTokenPayload(medico)).toEqual({
      idUsuario: 5,
      idRol: 2,
      rol: 'medico',
      username: 'doc',
      email: 'doc@x.com',
      nombre: 'Juan',
    })
  })
})

describe('buildUserPayload', () => {
  it('agrega la membresía con tipos normalizados', () => {
    expect(buildUserPayload(medico).membresia).toEqual({
      id_membresia: 9,
      plan_codigo: 'medio',
      plan_nombre: 'Medio',
      estado: 'activa',
      pagado_hasta: '2026-11-01',
      es_trial: false,
      fecha_inicio_trial: null,
      fecha_fin_trial: null,
      activa_vigente: true,
      membresia_vencida: false,
      permite_turnos: true,
      permite_asistentes: false,
      limite_asistentes: 3,
      permite_publicar_consultorio: true,
    })
  })

  it('marca la membresía vencida solo para roles que pagan', () => {
    expect(buildUserPayload({ ...medico, membresia_activa_vigente: 0 }).membresia.membresia_vencida).toBe(true)
    expect(buildUserPayload({ ...medico, rol: 'paciente', membresia_activa_vigente: 0 }).membresia.membresia_vencida).toBe(false)
  })

  it('sin membresía deja todo en null/false', () => {
    const { membresia } = buildUserPayload({ id_usuario: 1, rol: 'medico' })
    expect(membresia).toMatchObject({ id_membresia: null, limite_asistentes: null, activa_vigente: false })
    expect(membresia.membresia_vencida).toBeFalsy()
  })
})

describe('issueSession', () => {
  it('actualiza el último login y firma un JWT con el payload', async () => {
    const { token, user } = await issueSession(medico)

    expect(authRepo.updateUltimoLogin).toHaveBeenCalledWith(5)
    expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({ idUsuario: 5, rol: 'medico' })
    expect(user.membresia.plan_codigo).toBe('medio')
  })
})
