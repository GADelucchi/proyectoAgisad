/**
 * Funciones de repository que abren transacciones o calculan algo antes de
 * escribir: superposición de turnos, upsert de tipos de turno, renovación de
 * membresías, etc.
 */
jest.mock('../../../src/db/query', () => ({ query: jest.fn(), pool: { getConnection: jest.fn() } }))

const { pool } = require('../../../src/db/query')
const { createFakeConnection, executedSql } = require('../../helpers/fakeConnection')
const turnosRepo = require('../../../src/modules/turnos/turnos.repository')
const medicosRepo = require('../../../src/modules/medicos/medicos.repository')
const consultoriosRepo = require('../../../src/modules/consultorios/consultorios.repository')
const adminRepo = require('../../../src/modules/admin/admin.repository')

function useConnection(responder) {
  const conn = createFakeConnection(responder)
  pool.getConnection.mockResolvedValue(conn)
  return conn
}

describe('turnos.insertTurno', () => {
  const base = { idPaciente: 1, idMedico: 2, idClinica: 3, fecha: '2026-10-20', hora: '10:00', modificadoPor: 9 }

  function connWithExisting(existing, { compartido = 0 } = {}) {
    return useConnection((sql) => {
      if (sql.includes('SELECT compartido')) return [{ compartido }]
      if (sql.includes('FOR UPDATE')) return existing
      if (sql.includes('INSERT INTO turnos (')) return { insertId: 500 }
      return {}
    })
  }

  it('inserta turno + historial y confirma la transacción', async () => {
    const conn = connWithExisting([])

    await expect(turnosRepo.insertTurno(base)).resolves.toBe(500)

    const insert = conn.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO turnos ('))
    expect(insert[1]).toMatchObject({ horaInicio: '10:00', horaFin: '10:30', motivo: null, idTipoTurno: null })

    const historial = conn.execute.mock.calls.find(([sql]) => sql.includes('turnos_historial'))
    expect(historial[1]).toEqual([500, null, 'pendiente', 9, 'Alta de turno'])
    expect(conn.commit).toHaveBeenCalled()
    expect(conn.release).toHaveBeenCalled()
  })

  it('calcula la hora de fin con la duración pedida', async () => {
    const conn = connWithExisting([])
    await turnosRepo.insertTurno({ ...base, hora: '23:30', duracionMinutos: 45 })
    const insert = conn.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO turnos ('))
    expect(insert[1].horaFin).toBe('00:15')
  })

  it.each([
    ['empieza dentro de otro', [{ hora: '09:45', hora_fin: '10:15' }]],
    ['termina dentro de otro', [{ hora: '10:15', hora_fin: '11:00' }]],
    ['otro sin hora_fin dura 30 min', [{ hora: '09:40', hora_fin: null }]],
  ])('rechaza superposición: %s', async (_caso, existing) => {
    const conn = connWithExisting(existing)

    await expect(turnosRepo.insertTurno(base)).rejects.toMatchObject({ code: 'TURNO_OVERLAP' })
    expect(conn.rollback).toHaveBeenCalled()
    expect(conn.commit).not.toHaveBeenCalled()
    expect(conn.release).toHaveBeenCalled()
  })

  it('acepta turnos contiguos', async () => {
    connWithExisting([{ hora: '09:30', hora_fin: '10:00' }, { hora: '10:30', hora_fin: '11:00' }])
    await expect(turnosRepo.insertTurno(base)).resolves.toBe(500)
  })

  it('en consultorio compartido mira la sala entera, no solo al médico', async () => {
    const conn = connWithExisting([], { compartido: 1 })
    await turnosRepo.insertTurno(base)

    const lock = conn.execute.mock.calls.find(([sql]) => sql.includes('FOR UPDATE'))
    expect(lock[0]).toContain('(id_clinica = ? OR id_medico = ?)')
    expect(lock[1]).toEqual([3, 2, '2026-10-20'])
  })

  it('en consultorio propio mira solo la agenda del médico', async () => {
    const conn = connWithExisting([])
    await turnosRepo.insertTurno(base)

    const lock = conn.execute.mock.calls.find(([sql]) => sql.includes('FOR UPDATE'))
    expect(lock[0]).toContain('WHERE id_medico = ?')
    expect(lock[1]).toEqual([2, '2026-10-20'])
  })

  it('hace rollback si falla el insert', async () => {
    const conn = useConnection((sql) => {
      if (sql.includes('INSERT INTO turnos (')) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })
      return []
    })
    await expect(turnosRepo.insertTurno(base)).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' })
    expect(conn.rollback).toHaveBeenCalled()
  })
})

describe('turnos.updateTurnoEstado', () => {
  it('devuelve null y hace rollback si el turno no existe', async () => {
    const conn = useConnection(() => [])
    await expect(turnosRepo.updateTurnoEstado({ idTurno: 1, estadoNuevo: 'confirmado' })).resolves.toBeNull()
    expect(conn.rollback).toHaveBeenCalled()
    expect(conn.commit).not.toHaveBeenCalled()
  })

  it('actualiza y registra el estado previo en el historial', async () => {
    const conn = useConnection((sql) => (sql.startsWith('SELECT') ? [{ id_turno: 1, estado: 'pendiente' }] : {}))

    await expect(
      turnosRepo.updateTurnoEstado({ idTurno: 1, estadoNuevo: 'confirmado', modificadoPor: 4, motivo: 'ok' })
    ).resolves.toEqual({ id_turno: 1, estado: 'confirmado' })

    const historial = conn.execute.mock.calls.find(([sql]) => sql.includes('turnos_historial'))
    expect(historial[1]).toEqual([1, 'pendiente', 'confirmado', 4, 'ok'])
    expect(conn.commit).toHaveBeenCalled()
  })

  it('hace rollback si falla el update', async () => {
    const conn = useConnection((sql) => {
      if (sql.startsWith('SELECT')) return [{ id_turno: 1, estado: 'pendiente' }]
      throw new Error('lock wait timeout')
    })
    await expect(turnosRepo.updateTurnoEstado({ idTurno: 1, estadoNuevo: 'confirmado' })).rejects.toThrow('lock wait')
    expect(conn.rollback).toHaveBeenCalled()
    expect(conn.release).toHaveBeenCalled()
  })
})

describe('medicos.upsertTurnosConfigByMedico', () => {
  it('actualiza los tipos existentes, inserta los nuevos y desactiva el resto', async () => {
    const conn = useConnection((sql, params) => {
      if (sql.includes('UPDATE medico_tipos_turno') && sql.includes('SET nombre')) {
        return { affectedRows: params[3] === 1 ? 1 : 0 }
      }
      if (sql.includes('INSERT INTO medico_tipos_turno')) return { insertId: 30 }
      return {}
    })

    await medicosRepo.upsertTurnosConfigByMedico({
      idMedico: 5,
      duracionTurnoEstandar: 20,
      tiposTurno: [
        { idTipoTurno: 1, nombre: 'Control', duracion: 20, notificarNuevo: true },
        { idTipoTurno: 99, nombre: 'Ajeno', duracion: 30, notificarNuevo: false },
        { idTipoTurno: null, nombre: 'Nuevo', duracion: 40, notificarNuevo: false },
      ],
    })

    const desactivar = conn.execute.mock.calls.find(([sql]) => sql.includes('SET activo = 0'))
    expect(desactivar[0]).toContain('NOT IN (?,?,?)')
    expect(desactivar[1]).toEqual([5, 1, 30, 30])
    expect(conn.commit).toHaveBeenCalled()
  })

  it('sin tipos desactiva todos', async () => {
    const conn = useConnection(() => ({}))
    await medicosRepo.upsertTurnosConfigByMedico({ idMedico: 5, duracionTurnoEstandar: 30, tiposTurno: [] })
    expect(executedSql(conn)).toContain('UPDATE medico_tipos_turno SET activo = 0 WHERE id_medico = ?')
  })

  it('hace rollback ante errores', async () => {
    const conn = useConnection(() => {
      throw new Error('boom')
    })
    await expect(
      medicosRepo.upsertTurnosConfigByMedico({ idMedico: 5, duracionTurnoEstandar: 30, tiposTurno: [] })
    ).rejects.toThrow('boom')
    expect(conn.rollback).toHaveBeenCalled()
  })
})

describe('medicos.createClinicaWithDisponibilidad / updateClinicaWithDisponibilidad', () => {
  const rangos = {
    rangosSemanales: [{ diaSemana: 1, inicio: '09:00:00', fin: '12:00:00', duracion: 30 }],
    rangosUnicos: [{ fecha: '2026-10-20', inicio: '15:00:00', fin: '18:00:00' }],
  }

  it('una clínica presencial guarda dirección y no link', async () => {
    const conn = useConnection((sql) => (sql.includes('INSERT INTO clinicas') ? { insertId: 12 } : {}))

    await expect(
      medicosRepo.createClinicaWithDisponibilidad({
        idMedico: 1, idCiudad: 2, nombre: 'Centro', direccion: 'Calle 1', link: '', tipo: 'presencial', ...rangos,
      })
    ).resolves.toEqual({ id_clinica: 12, tipo: 'presencial' })

    expect(conn.execute.mock.calls[0][1]).toEqual(['Centro', 2, 'Calle 1', null])
    expect(executedSql(conn).filter((s) => s.includes('INSERT INTO medico_disponibilidad (')).length).toBe(1)
    expect(executedSql(conn).filter((s) => s.includes('INSERT INTO medico_disponibilidad_excepciones')).length).toBe(1)
    expect(conn.commit).toHaveBeenCalled()
  })

  it('una clínica virtual usa la dirección como link si no hay link', async () => {
    const conn = useConnection((sql) => (sql.includes('INSERT INTO clinicas') ? { insertId: 12 } : {}))
    await medicosRepo.createClinicaWithDisponibilidad({
      idMedico: 1, idCiudad: 2, nombre: 'Online', direccion: 'https://meet', link: '', tipo: 'Virtual', ...rangos,
    })
    expect(conn.execute.mock.calls[0][1]).toEqual(['Online', 2, null, 'https://meet'])
  })

  it('al editar reemplaza la disponibilidad semanal y las agendas únicas', async () => {
    const conn = useConnection(() => ({}))
    await medicosRepo.updateClinicaWithDisponibilidad({
      idMedico: 1, idClinica: 12, nombre: 'Centro', direccion: 'Calle 2', link: '', tipo: 'presencial', ...rangos,
    })

    const sqls = executedSql(conn)
    expect(sqls[0]).toContain('UPDATE clinicas')
    expect(sqls[1]).toContain('UPDATE medico_disponibilidad SET activo = 0')
    expect(sqls).toEqual(expect.arrayContaining([expect.stringContaining("DELETE FROM medico_disponibilidad_excepciones")]))
    expect(conn.commit).toHaveBeenCalled()
  })

  it('hace rollback si falla al crear', async () => {
    const conn = useConnection(() => {
      throw new Error('fk')
    })
    await expect(
      medicosRepo.createClinicaWithDisponibilidad({ idMedico: 1, idCiudad: 2, nombre: 'X', tipo: 'presencial', ...rangos })
    ).rejects.toThrow('fk')
    expect(conn.rollback).toHaveBeenCalled()
  })
})

describe('consultorios', () => {
  it('createClinicaForPropietario crea la clínica compartida y el vínculo', async () => {
    const conn = useConnection((sql) => (sql.includes('INSERT INTO clinicas') ? { insertId: 40 } : {}))
    await expect(
      consultoriosRepo.createClinicaForPropietario({ idPropietario: 2, nombre: 'Sala', idCiudad: 1, direccion: 'D', telefono: null })
    ).resolves.toBe(40)
    expect(conn.execute.mock.calls[1][1]).toEqual([2, 40])
    expect(conn.commit).toHaveBeenCalled()
  })

  it('replaceDisponibilidadByClinica desactiva, reinserta rangos y reemplaza excepciones', async () => {
    const conn = useConnection(() => ({}))
    await consultoriosRepo.replaceDisponibilidadByClinica({
      idClinica: 9,
      rangos: [{ diaSemana: 1, horaInicio: '09:00:00', horaFin: '12:00:00', duracionTurno: 30 }],
      excepciones: [{ fecha: '2026-10-20', horaInicio: null, horaFin: null, tipo: 'bloqueo', motivo: null }],
    })
    const sqls = executedSql(conn)
    expect(sqls[0]).toContain('UPDATE consultorio_disponibilidad SET activo = 0')
    expect(sqls[1]).toContain('INSERT INTO consultorio_disponibilidad')
    expect(sqls[2]).toContain('DELETE FROM consultorio_disponibilidad_excepciones')
    expect(sqls[3]).toContain('INSERT INTO consultorio_disponibilidad_excepciones')
    expect(conn.commit).toHaveBeenCalled()
  })

  it('aprobarSolicitud vincula al médico como inquilino y marca la solicitud', async () => {
    const conn = useConnection(() => ({}))
    await consultoriosRepo.aprobarSolicitud({ idSolicitud: 1, idClinica: 2, idMedico: 3 })
    expect(executedSql(conn)[0]).toContain('es_propietario) VALUES (?, ?, 1, 0)')
    expect(executedSql(conn)[1]).toContain("estado = 'aprobada'")
    expect(conn.commit).toHaveBeenCalled()
  })

  it('aprobarSolicitud hace rollback ante errores', async () => {
    const conn = useConnection(() => {
      throw new Error('x')
    })
    await expect(consultoriosRepo.aprobarSolicitud({ idSolicitud: 1, idClinica: 2, idMedico: 3 })).rejects.toThrow('x')
    expect(conn.rollback).toHaveBeenCalled()
  })
})

describe('admin.reactivateMembershipByUser', () => {
  const plan = { id_plan: 2, codigo: 'medio', nombre: 'Medio', vigencia_meses: 1, precio_mensual: 15000 }

  function connFor({ latest = null, plans = [plan] } = {}) {
    return useConnection((sql) => {
      if (sql.includes('FROM membresias m') && sql.includes('FOR UPDATE')) return latest ? [latest] : []
      if (sql.includes('FROM membresia_planes')) return plans
      if (sql.includes('INSERT INTO membresias')) return { insertId: 70 }
      if (sql.includes('LEFT JOIN membresia_planes')) return [{ id_membresia: latest?.id_membresia || 70, estado: 'activa' }]
      return {}
    })
  }

  it('crea la membresía si el usuario no tenía y registra el pago', async () => {
    const conn = connFor()

    await expect(
      adminRepo.reactivateMembershipByUser({ idUsuario: 1, rawPlan: 'Medio', metodo: 'transferencia', monto: null })
    ).resolves.toEqual({ id_membresia: 70, estado: 'activa' })

    const pago = conn.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO pagos_membresia'))
    expect(pago[1]).toEqual([70, 15000, 'transferencia', null])
    expect(conn.commit).toHaveBeenCalled()
  })

  it('extiende la membresía existente con el monto informado', async () => {
    const conn = connFor({ latest: { id_membresia: 8, id_plan: 2, plan: 'medio', monto_mensual: 10000 } })

    await adminRepo.reactivateMembershipByUser({ idUsuario: 1, rawPlan: null, metodo: 'manual', referenciaExterna: 'TX1', monto: 12000 })

    const update = conn.execute.mock.calls.find(([sql]) => sql.includes('UPDATE membresias'))
    expect(update[1]).toEqual([2, 'medio', 12000, 1, 1, 8])
    const pago = conn.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO pagos_membresia'))
    expect(pago[1]).toEqual([8, 12000, 'manual', 'TX1'])
  })

  it('no registra pago si no hay monto en ningún lado', async () => {
    const conn = connFor({ plans: [{ ...plan, precio_mensual: null }] })
    await adminRepo.reactivateMembershipByUser({ idUsuario: 1, rawPlan: 'medio', metodo: 'manual', monto: null })
    expect(executedSql(conn).some((s) => s.includes('pagos_membresia'))).toBe(false)
  })

  it('falla y hace rollback si no se puede resolver el plan', async () => {
    const conn = connFor({ plans: [] })
    await expect(
      adminRepo.reactivateMembershipByUser({ idUsuario: 1, rawPlan: 'inexistente', metodo: 'manual', monto: null })
    ).rejects.toThrow('No se pudo resolver un plan')
    expect(conn.rollback).toHaveBeenCalled()
  })
})
