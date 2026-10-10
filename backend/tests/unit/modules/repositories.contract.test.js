/**
 * Contrato de las consultas simples de todos los repositories: qué devuelven
 * cuando la base trae filas y cuando no trae nada. Los services dependen de
 * esos "null"/"false" para responder 404/403, así que un cambio acá rompe
 * permisos aunque el SQL siga siendo válido.
 *
 * El SQL en sí no se valida acá (eso requiere una base real).
 */
jest.mock('../../../src/db/query', () => ({ query: jest.fn(), pool: { getConnection: jest.fn() } }))

const { query } = require('../../../src/db/query')

const repos = {
  acceso: require('../../../src/modules/acceso/acceso.repository'),
  admin: require('../../../src/modules/admin/admin.repository'),
  asistentes: require('../../../src/modules/asistentes/asistentes.repository'),
  auth: require('../../../src/modules/auth/auth.repository'),
  consultorios: require('../../../src/modules/consultorios/consultorios.repository'),
  emailVerification: require('../../../src/modules/email-verification/email-verification.repository'),
  gerentes: require('../../../src/modules/gerentes/gerentes.repository'),
  medicos: require('../../../src/modules/medicos/medicos.repository'),
  pacientes: require('../../../src/modules/pacientes/pacientes.repository'),
  passwordReset: require('../../../src/modules/password-reset/password-reset.repository'),
  turnos: require('../../../src/modules/turnos/turnos.repository'),
}

const ROW = { id: 1 }

// [repo, función, argumentos, filas de la base, resultado esperado con filas, resultado esperado sin filas]
const firstRowOrNull = [
  ['acceso', 'findPermisosAsistente', [{ idUsuario: 1, idMedico: 2 }]],
  ['admin', 'findUsuarioBaseById', [1]],
  ['asistentes', 'findAsistenteById', [1]],
  ['asistentes', 'findAsistenteAccessByUserId', [1]],
  ['auth', 'findUserByEmail', ['a@x.com']],
  ['auth', 'findUserById', [1]],
  ['consultorios', 'findPropietarioByUserId', [1]],
  ['consultorios', 'findMedicoByUserId', [1]],
  ['consultorios', 'findClinicaById', [1]],
  ['consultorios', 'findSolicitudActiva', [{ idClinica: 1, idMedico: 2 }]],
  ['consultorios', 'findSolicitudById', [1]],
  ['consultorios', 'findAdicionalByMedico', [1]],
  ['emailVerification', 'findVigente', [1]],
  ['gerentes', 'findGerenteByUserId', [1]],
  ['gerentes', 'findClinicaOwnedByGerente', [{ idGerente: 1, idClinica: 2 }]],
  ['gerentes', 'findInvitacionByTokenHash', ['hash']],
  ['gerentes', 'findInvitacionPendienteById', [{ idInvitacion: 1, idGerente: 2 }]],
  ['medicos', 'findActiveTycByMedico', [1]],
  ['medicos', 'findClinicaCompartida', [1]],
  ['medicos', 'findMedicoByUserId', [1]],
  ['medicos', 'findMedicoMailConfigByUserId', [1]],
  ['medicos', 'findBloqueoById', [1]],
  ['pacientes', 'findPacienteById', [1]],
  ['pacientes', 'findPacienteByUserId', [1]],
  ['pacientes', 'findMedicoRecetaById', [1]],
  ['pacientes', 'findActiveTycByMedico', [1]],
  ['pacientes', 'findPacienteByDni', ['30111222']],
  ['passwordReset', 'findValidToken', ['hash']],
  ['turnos', 'findTurnoById', [1]],
  ['turnos', 'findTipoTurnoById', [1, 2]],
  ['turnos', 'findMedicoNotifInfoById', [1]],
  ['turnos', 'findTurnoResumenById', [1]],
]

const idFields = [
  ['acceso', 'findMedicoIdByUserId', 'id_medico'],
  ['asistentes', 'findGerenteIdByUserId', 'id_gerente'],
  ['asistentes', 'findAsistenteIdByUserId', 'id_asistente'],
  ['auth', 'findRoleIdByName', 'id_rol'],
  ['medicos', 'findMedicoIdByUserId', 'id_medico'],
  ['medicos', 'findAnyCityId', 'id_ciudad'],
  ['pacientes', 'findPrimeraClinicaByMedico', 'id_clinica'],
  ['turnos', 'findPacienteIdByUserId', 'id_paciente'],
]

const booleans = [
  ['acceso', 'gerenteTieneMedico', [{ idUsuario: 1, idMedico: 2 }]],
  ['acceso', 'medicoAtiendeEnClinica', [{ idMedico: 1, idClinica: 2 }]],
  ['asistentes', 'asistenteVinculadoAMedico', [{ idAsistente: 1, idMedico: 2 }]],
  ['auth', 'existsUsername', ['ana']],
  ['consultorios', 'isClinicaOwnedByMedico', [{ idMedico: 1, idClinica: 2 }]],
  ['consultorios', 'isClinicaOwnedByPropietario', [{ idPropietario: 1, idClinica: 2 }]],
  ['consultorios', 'isConsultorioOperativo', [1]],
  ['consultorios', 'isMedicoVinculado', [{ idClinica: 1, idMedico: 2 }]],
  ['medicos', 'ensureMedicoHasClinica', [{ idMedico: 1, idClinica: 2 }]],
  ['pacientes', 'existsObraSocial', [1]],
  ['pacientes', 'hasPacienteAcceptedTyc', [{ idPaciente: 1, idTyc: 2 }]],
  ['pacientes', 'pacienteVinculadoAMedico', [{ idPaciente: 1, idMedico: 2 }]],
]

const insertIds = [
  ['consultorios', 'createSolicitud', [{ idClinica: 1, idMedico: 2, mensaje: 'hola' }]],
  ['consultorios', 'createAdicionalActivo', [{ idMedico: 1, montoMensual: 100, maxConsultorios: 2 }]],
  ['gerentes', 'createInvitacion', [{ idGerente: 1, idClinica: 2, email: 'a@x.com', tokenHash: 'h', vigenciaDias: 7 }]],
  ['pacientes', 'ensureObraSocialByNombre', ['OSDE']],
]

describe('repositories: primera fila o null', () => {
  it.each(firstRowOrNull)('%s.%s', async (repo, fn, args) => {
    query.mockResolvedValueOnce([ROW])
    await expect(repos[repo][fn](...args)).resolves.toEqual(ROW)

    query.mockResolvedValueOnce([])
    await expect(repos[repo][fn](...args)).resolves.toBeNull()
  })
})

describe('repositories: id de la primera fila o null', () => {
  it.each(idFields)('%s.%s devuelve %s', async (repo, fn, field) => {
    query.mockResolvedValueOnce([{ [field]: 42 }])
    await expect(repos[repo][fn](1)).resolves.toBe(42)

    query.mockResolvedValueOnce([])
    await expect(repos[repo][fn](1)).resolves.toBeNull()
  })
})

describe('repositories: existencia como booleano', () => {
  it.each(booleans)('%s.%s', async (repo, fn, args) => {
    query.mockResolvedValueOnce([{ ok: 1 }])
    await expect(repos[repo][fn](...args)).resolves.toBe(true)

    query.mockResolvedValueOnce([])
    await expect(repos[repo][fn](...args)).resolves.toBe(false)
  })
})

describe('repositories: inserts devuelven el insertId', () => {
  it.each(insertIds)('%s.%s', async (repo, fn, args) => {
    query.mockResolvedValueOnce({ insertId: 99 })
    await expect(repos[repo][fn](...args)).resolves.toBe(99)
  })
})

describe('casos especiales', () => {
  it('turnos.medicoPermiteTurnos distingue médico inexistente (null) de plan sin turnos (false)', async () => {
    query.mockResolvedValueOnce([])
    await expect(repos.turnos.medicoPermiteTurnos(1)).resolves.toBeNull()

    query.mockResolvedValueOnce([{ permite_turnos: 0 }])
    await expect(repos.turnos.medicoPermiteTurnos(1)).resolves.toBe(false)

    query.mockResolvedValueOnce([{ permite_turnos: 1 }])
    await expect(repos.turnos.medicoPermiteTurnos(1)).resolves.toBe(true)
  })

  it('consultorios.contarPublicadosByMedico devuelve un número', async () => {
    query.mockResolvedValueOnce([{ total: '3' }])
    await expect(repos.consultorios.contarPublicadosByMedico(1)).resolves.toBe(3)

    query.mockResolvedValueOnce([])
    await expect(repos.consultorios.contarPublicadosByMedico(1)).resolves.toBe(0)
  })

  it('consultorios.findOwnerEmailByClinica prefiere al propietario y cae al médico dueño', async () => {
    query.mockResolvedValueOnce([{ email: 'prop@x.com' }])
    await expect(repos.consultorios.findOwnerEmailByClinica(1)).resolves.toEqual({ email: 'prop@x.com' })
    expect(query).toHaveBeenCalledTimes(1)

    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ email: 'doc@x.com' }])
    await expect(repos.consultorios.findOwnerEmailByClinica(1)).resolves.toEqual({ email: 'doc@x.com' })

    query.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await expect(repos.consultorios.findOwnerEmailByClinica(1)).resolves.toBeNull()
  })

  it('consultorios.listSolicitudesByClinicas no consulta si no hay clínicas', async () => {
    await expect(repos.consultorios.listSolicitudesByClinicas([])).resolves.toEqual([])
    expect(query).not.toHaveBeenCalled()
  })

  it('consultorios.listSolicitudesByClinicas arma un placeholder por clínica', async () => {
    query.mockResolvedValueOnce([])
    await repos.consultorios.listSolicitudesByClinicas([4, 5])
    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('IN (:id0,:id1)')
    expect(params).toEqual({ id0: 4, id1: 5 })
  })

  it('consultorios.marcarClinicaCompartida guarda 1/0', async () => {
    query.mockResolvedValue({})
    await repos.consultorios.marcarClinicaCompartida({ idClinica: 1, compartido: true })
    expect(query.mock.calls[0][1]).toEqual({ idClinica: 1, compartido: 1 })
    await repos.consultorios.marcarClinicaCompartida({ idClinica: 1, compartido: false })
    expect(query.mock.calls[1][1]).toEqual({ idClinica: 1, compartido: 0 })
  })

  it('consultorios.listDisponibilidadByClinica junta rangos y excepciones', async () => {
    query.mockResolvedValueOnce([{ dia_semana: 1 }]).mockResolvedValueOnce([{ fecha: '2026-10-20' }])
    await expect(repos.consultorios.listDisponibilidadByClinica(1)).resolves.toEqual({
      rangos: [{ dia_semana: 1 }],
      excepciones: [{ fecha: '2026-10-20' }],
    })
  })

  it('medicos.findTurnosConfigByMedico junta config y tipos activos', async () => {
    query.mockResolvedValueOnce([{ duracion_turno_estandar: 20 }]).mockResolvedValueOnce([{ id_tipo_turno: 1 }])
    await expect(repos.medicos.findTurnosConfigByMedico(1)).resolves.toEqual({
      config: { duracion_turno_estandar: 20 },
      tipos: [{ id_tipo_turno: 1 }],
    })

    query.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await expect(repos.medicos.findTurnosConfigByMedico(1)).resolves.toEqual({ config: null, tipos: [] })
  })

  it('medicos.listClinicasByMedico devuelve las tres listas', async () => {
    query.mockResolvedValueOnce(['c']).mockResolvedValueOnce(['d']).mockResolvedValueOnce(['u'])
    await expect(repos.medicos.listClinicasByMedico(1)).resolves.toEqual({
      clinics: ['c'],
      disponibilidad: ['d'],
      disponibilidadUnica: ['u'],
    })
  })

  it('medicos.insertMedicoTyc devuelve la fila recién insertada', async () => {
    query.mockResolvedValueOnce({ insertId: 7 }).mockResolvedValueOnce([{ id_tyc: 7, version: 2 }])
    await expect(repos.medicos.insertMedicoTyc({ idMedico: 1, version: 2, texto: 'tyc' })).resolves.toEqual({
      id_tyc: 7,
      version: 2,
    })
    expect(query.mock.calls[1][1]).toEqual({ idTyc: 7 })
  })

  it('medicos.createBloqueo devuelve el bloqueo creado', async () => {
    query.mockResolvedValueOnce({ insertId: 3 }).mockResolvedValueOnce([{ id_excepcion: 3 }])
    await expect(
      repos.medicos.createBloqueo({ idMedico: 1, idClinica: 2, fecha: '2026-10-20' })
    ).resolves.toEqual({ id_excepcion: 3 })
    expect(query.mock.calls[0][1]).toEqual({
      idMedico: 1,
      idClinica: 2,
      fecha: '2026-10-20',
      horaInicio: null,
      horaFin: null,
      motivo: null,
    })
  })

  it('medicos.updateRecetaSolicitudEstadoByMedico indica si actualizó algo', async () => {
    query.mockResolvedValueOnce({ affectedRows: 1 })
    await expect(repos.medicos.updateRecetaSolicitudEstadoByMedico({ idMedico: 1, idSolicitud: 2, estado: 'resuelta' })).resolves.toBe(true)

    query.mockResolvedValueOnce({ affectedRows: 0 })
    await expect(repos.medicos.updateRecetaSolicitudEstadoByMedico({ idMedico: 1, idSolicitud: 2, estado: 'resuelta' })).resolves.toBe(false)
  })

  it('medicos.listMedicos filtra por id_medico solo si se lo piden', async () => {
    query.mockResolvedValue([])
    await repos.medicos.listMedicos({ q: 'paz' })
    expect(query.mock.calls[0][1]).toMatchObject({ idMedico: null, q: 'paz' })
    await repos.medicos.listMedicos({ idMedico: 3 })
    expect(query.mock.calls[1][1]).toMatchObject({ idMedico: 3 })
    expect(query.mock.calls[1][0]).toContain(':idMedico IS NULL OR m.id_medico = :idMedico')
  })

  it.each([
    ['medicos', 'findDisponibilidadByMedicoClinica', { idMedico: 1, idClinica: 2 }],
    ['medicos', 'findExtraDisponibilidadByMedicoClinicaRango', { idMedico: 1, idClinica: 2, desde: '2026-10-01', hasta: '2026-10-31' }],
    ['medicos', 'findTurnosTomadosRango', { idMedico: 1, desde: '2026-10-01', hasta: '2026-10-31' }],
    ['turnos', 'findTurnosTomadosPorClinicaRango', { idClinica: 2, desde: '2026-10-01', hasta: '2026-10-31' }],
  ])('%s.%s devuelve las filas con los parámetros del rango', async (repo, fn, args) => {
    query.mockResolvedValueOnce([{ fecha: '2026-10-19' }])
    await expect(repos[repo][fn](args)).resolves.toEqual([{ fecha: '2026-10-19' }])
    expect(query.mock.calls[0][1]).toEqual(args)
  })

  it('las consultas de turnos tomados ignoran los cancelados', async () => {
    query.mockResolvedValue([])
    await repos.medicos.findTurnosTomadosRango({ idMedico: 1, desde: 'a', hasta: 'b' })
    await repos.turnos.findTurnosTomadosPorClinicaRango({ idClinica: 1, desde: 'a', hasta: 'b' })
    for (const [sql] of query.mock.calls) {
      expect(sql).toContain("estado NOT IN ('cancelado', 'cancelado_paciente', 'cancelado_clinica')")
    }
  })

  it('medicos.deleteClinicaByMedico desactiva vínculo y disponibilidad', async () => {
    query.mockResolvedValue({})
    await repos.medicos.deleteClinicaByMedico({ idMedico: 1, idClinica: 2 })
    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[0][0]).toContain('UPDATE medico_clinicas')
    expect(query.mock.calls[1][0]).toContain('UPDATE medico_disponibilidad')
  })

  it.each([
    ['createRecetaSolicitud', { idPaciente: 1, idMedico: 2, tipo: 'urgente', itemsJson: '[]', enviadoAEmail: 'a@x.com' }],
    ['createMensajeSolicitud', { idPaciente: 1, idMedico: 2, asunto: 'A', mensaje: 'M', enviadoAEmail: 'a@x.com' }],
  ])('pacientes.%s devuelve la solicitud en estado enviada', async (fn, args) => {
    query.mockResolvedValueOnce({ insertId: 15 })
    await expect(repos.pacientes[fn](args)).resolves.toEqual({ id_solicitud: 15, estado: 'enviada' })
  })

  it('pacientes.ensureObraSocialByNombre normaliza espacios y no inserta vacíos', async () => {
    await expect(repos.pacientes.ensureObraSocialByNombre('   ')).resolves.toBeNull()
    expect(query).not.toHaveBeenCalled()

    query.mockResolvedValueOnce({ insertId: 4 })
    await repos.pacientes.ensureObraSocialByNombre('  Swiss    Medical ')
    expect(query.mock.calls[0][1]).toEqual({ nombre: 'Swiss Medical' })
  })

  it('pacientes.updatePaciente solo toca columnas editables presentes', async () => {
    query.mockResolvedValue({})
    await repos.pacientes.updatePaciente(5, { telefono: '+549', id_obra_social: null, dni: 'x', nombre: 'x' })

    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('SET telefono = :telefono, id_obra_social = :id_obra_social')
    expect(sql).not.toContain('dni')
    expect(params).toEqual({ idPaciente: 5, telefono: '+549', id_obra_social: null })
  })

  it('pacientes.updatePaciente no ejecuta nada sin campos', async () => {
    await repos.pacientes.updatePaciente(5, { dni: 'x' })
    expect(query).not.toHaveBeenCalled()
  })

  it('pacientes.listPacientesByMedico agrega el filtro de búsqueda solo si hay texto', async () => {
    query.mockResolvedValue([])
    await repos.pacientes.listPacientesByMedico(3)
    expect(query.mock.calls[0][1]).toEqual({ idMedico: 3 })
    expect(query.mock.calls[0][0]).not.toContain(':like')

    await repos.pacientes.listPacientesByMedico(3, 'paz')
    expect(query.mock.calls[1][1]).toEqual({ idMedico: 3, like: '%paz%' })
  })

  it('pacientes.upsertPacienteVinculo usa origen manual por defecto', async () => {
    query.mockResolvedValue({})
    await repos.pacientes.upsertPacienteVinculo({ idPaciente: 1, idMedico: 2, idClinica: 3 })
    expect(query.mock.calls[0][1]).toEqual({ idPaciente: 1, idMedico: 2, idClinica: 3, origen: 'manual' })
  })

  it.each([
    [{ suscripcion: 'activa' }, 'ms.estado = :suscripcion', 'activa'],
    [{ suscripcion: 'inexistente' }, 'ms.id_membresia IS NULL', 'inexistente'],
    [{ suscripcion: 'hackeada' }, ':suscripcion IS NULL', null],
  ])('admin.listUsuariosAdmin con %p', async (filters, sqlFragment, suscripcion) => {
    query.mockResolvedValueOnce([])
    await repos.admin.listUsuariosAdmin({ q: 'ana', rol: 'medico', ...filters })
    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain(sqlFragment)
    expect(params).toEqual({ q: '%ana%', rol: 'medico', suscripcion })
  })

  it.each([
    [undefined, 'LIMIT 100'],
    [0, 'LIMIT 1'],
    [9999, 'LIMIT 500'],
    ['abc', 'LIMIT 100'],
    [25, 'LIMIT 25'],
  ])('admin.listFinanzasMovimientos acota el límite %p', async (limit, expected) => {
    query.mockResolvedValueOnce([])
    await repos.admin.listFinanzasMovimientos({ limit })
    expect(query.mock.calls[0][0]).toContain(expected)
  })

  it('admin.getFinanzasResumen devuelve ceros si no hay pagos', async () => {
    query.mockResolvedValueOnce([])
    await expect(repos.admin.getFinanzasResumen()).resolves.toEqual({
      total_ingresado: 0,
      total_pendiente: 0,
      total_reintegrado: 0,
      pagos_aprobados: 0,
    })
  })
})
