jest.mock('../../../src/modules/admin/admin.repository')

const repo = require('../../../src/modules/admin/admin.repository')
const HttpError = require('../../../src/utils/httpError')
const service = require('../../../src/modules/admin/admin.service')

const base = {
  id_usuario: 5, username: 'u', email: 'u@x.com', activo: 1, email_verificado: 1, creado_en: '2026-01-01',
  id_membresia: 9, membresia_plan: 'medio', membresia_estado: 'activa', monto_mensual: '15000',
}

beforeEach(() => {
  repo.findAdicionalesActivosByMedicoUsuario.mockResolvedValue([])
  for (const fn of ['findPacienteMedicosVinculados', 'findMedicoClinicas', 'findMedicoCoberturaGerente', 'findPagosByUsuario',
    'findAsistenteMedicos', 'findAsistenteClinicas', 'findGerenteClinicas', 'findGerenteMedicos']) {
    repo[fn].mockResolvedValue([fn])
  }
})

describe('listUsuarios', () => {
  it('delega los filtros', async () => {
    repo.listUsuariosAdmin.mockResolvedValue(['u'])
    await expect(service.listUsuarios({ rol: 'medico' })).resolves.toEqual(['u'])
    expect(repo.listUsuariosAdmin).toHaveBeenCalledWith({ rol: 'medico' })
  })
})

describe('getUsuarioDetalle', () => {
  it('valida el id y la existencia', async () => {
    await expect(service.getUsuarioDetalle('abc')).rejects.toMatchObject({ status: 400 })
    repo.findUsuarioBaseById.mockResolvedValue(null)
    await expect(service.getUsuarioDetalle('5')).rejects.toMatchObject({ status: 404 })
  })

  it('un médico suma los adicionales al total a cobrar', async () => {
    repo.findUsuarioBaseById.mockResolvedValue({ ...base, rol: 'medico', id_medico: 3, medico_nombre: 'Juan' })
    repo.findAdicionalesActivosByMedicoUsuario.mockResolvedValue([{ monto_mensual: '20000', max_consultorios: 2, activado_en: '01/10/2026' }])

    const detalle = await service.getUsuarioDetalle('5')

    expect(detalle.suscripcion).toMatchObject({
      plan: 'medio',
      estado: 'activa',
      monto_adicionales: 20000,
      total_a_cobrar: 35000,
      adicionales: [{ concepto: 'Publicar consultorios (hasta 2)', monto_mensual: 20000, activado_en: '01/10/2026' }],
    })
    expect(detalle.perfil).toMatchObject({ id_medico: 3, nombre: 'Juan' })
    expect(detalle.relaciones).toEqual({
      clinicas: ['findMedicoClinicas'],
      cobertura_gerente: ['findMedicoCoberturaGerente'],
    })
    expect(detalle.pagos).toEqual(['findPagosByUsuario'])
  })

  it('un usuario sin membresía figura como inexistente', async () => {
    repo.findUsuarioBaseById.mockResolvedValue({ id_usuario: 5, rol: 'admin', username: 'root' })
    const detalle = await service.getUsuarioDetalle(5)
    expect(detalle.suscripcion).toMatchObject({ estado: 'inexistente', id_membresia: null, total_a_cobrar: 0, adicionales: [] })
    expect(detalle.perfil).toEqual({ nombre: 'root' })
    expect(repo.findAdicionalesActivosByMedicoUsuario).not.toHaveBeenCalled()
  })

  it.each([
    ['paciente', { id_paciente: 1, paciente_nombre: 'Ana' }, { medicos_vinculados: ['findPacienteMedicosVinculados'] }, []],
    ['asistente', { id_asistente: 1, asistente_nombre: 'Lu' }, { medicos: ['findAsistenteMedicos'], clinicas: ['findAsistenteClinicas'] }, []],
    ['gerente', { id_gerente: 1, gerente_nombre: 'Laura' }, { clinicas: ['findGerenteClinicas'], medicos_asociados: ['findGerenteMedicos'] }, ['findPagosByUsuario']],
  ])('arma perfil y relaciones de un %s', async (rol, extra, relaciones, pagos) => {
    repo.findUsuarioBaseById.mockResolvedValue({ ...base, rol, ...extra })
    const detalle = await service.getUsuarioDetalle(5)
    expect(detalle.perfil).toBeTruthy()
    expect(detalle.relaciones).toEqual(relaciones)
    expect(detalle.pagos).toEqual(pagos)
  })
})

describe('getFinanzas', () => {
  it('junta resumen, mensual y movimientos', async () => {
    repo.getFinanzasResumen.mockResolvedValue('r')
    repo.listFinanzasMensual.mockResolvedValue('m')
    repo.listFinanzasMovimientos.mockResolvedValue('mov')
    await expect(service.getFinanzas()).resolves.toEqual({ resumen: 'r', mensual: 'm', movimientos: 'mov' })
    expect(repo.listFinanzasMovimientos).toHaveBeenCalledWith({ limit: 150 })
  })
})

describe('reactivateMembership', () => {
  it('valida usuario, método y monto', async () => {
    await expect(service.reactivateMembership({})).rejects.toMatchObject({ status: 400, message: 'id_usuario invalido' })
    await expect(service.reactivateMembership({ id_usuario: 1, metodo: 'bitcoin' })).rejects.toMatchObject({ status: 400 })
    await expect(service.reactivateMembership({ id_usuario: 1, monto: -1 })).rejects.toMatchObject({ status: 400, message: 'monto invalido' })
    await expect(service.reactivateMembership({ id_usuario: 1, monto: 'abc' })).rejects.toMatchObject({ status: 400 })
  })

  it('reactiva con método manual por defecto y monto opcional', async () => {
    repo.reactivateMembershipByUser.mockResolvedValue({ id_membresia: 9 })

    await expect(service.reactivateMembership({ id_usuario: '1', monto: '' })).resolves.toEqual({ id_membresia: 9 })
    expect(repo.reactivateMembershipByUser).toHaveBeenCalledWith({
      idUsuario: 1, rawPlan: null, metodo: 'manual', referenciaExterna: null, monto: null,
    })

    await service.reactivateMembership({ id_usuario: 1, metodo: 'MercadoPago', monto: '15000', plan: 'medio', referencia_externa: 'MP1' })
    expect(repo.reactivateMembershipByUser).toHaveBeenLastCalledWith({
      idUsuario: 1, rawPlan: 'medio', metodo: 'mercadopago', referenciaExterna: 'MP1', monto: 15000,
    })
  })

  it('responde 500 si el repositorio no devuelve la membresía', async () => {
    repo.reactivateMembershipByUser.mockResolvedValue(null)
    await expect(service.reactivateMembership({ id_usuario: 1 })).rejects.toMatchObject({ status: 500 })
  })

  it('traduce errores del repositorio a 400 y conserva los HttpError', async () => {
    repo.reactivateMembershipByUser.mockRejectedValueOnce(new Error('No se pudo resolver un plan'))
    await expect(service.reactivateMembership({ id_usuario: 1 })).rejects.toMatchObject({ status: 400, message: 'No se pudo resolver un plan' })

    repo.reactivateMembershipByUser.mockRejectedValueOnce(new HttpError(409, 'conflicto'))
    await expect(service.reactivateMembership({ id_usuario: 1 })).rejects.toMatchObject({ status: 409 })
  })
})
