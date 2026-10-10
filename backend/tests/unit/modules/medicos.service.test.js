// El automock de los services importa el mailer real; se reemplaza para no cargarlo.
jest.mock('../../../src/utils/mailer', () => require('../../mocks/mailer'))
jest.mock('../../../src/modules/medicos/medicos.repository')
jest.mock('../../../src/modules/membresias/membresias.service')
jest.mock('../../../src/modules/consultorios/consultorios.service')

const repo = require('../../../src/modules/medicos/medicos.repository')
const membresias = require('../../../src/modules/membresias/membresias.service')
const consultoriosService = require('../../../src/modules/consultorios/consultorios.service')
const HttpError = require('../../../src/utils/httpError')
const service = require('../../../src/modules/medicos/medicos.service')

const yo = { requesterIdUsuario: 60, requesterRol: 'medico' }
// 2026-10-19 es lunes (dia_semana = 1)
const LUNES = '2026-10-19'

beforeEach(() => {
  repo.findMedicoByUserId.mockResolvedValue({ id_medico: 3, id_ciudad: 4 })
  repo.findMedicoIdByUserId.mockResolvedValue(3)
  repo.ensureMedicoHasClinica.mockResolvedValue(true)
  repo.findClinicaCompartida.mockResolvedValue({ compartido: 0 })
  repo.findTurnosConfigByMedico.mockResolvedValue({
    config: { duracion_turno_estandar: 30 },
    tipos: [{ id_tipo_turno: 1, nombre: 'Primera vez', duracion_minutos: 60 }],
  })
  repo.findDisponibilidadByMedicoClinicaDia.mockResolvedValue([])
  repo.findExtraDisponibilidadByMedicoClinicaFecha.mockResolvedValue([])
  repo.findTurnosTomados.mockResolvedValue([])
  repo.listBloqueosByMedico.mockResolvedValue([])
  repo.listClinicasByMedico.mockResolvedValue({ clinics: [], disponibilidad: [], disponibilidadUnica: [] })
  membresias.assertUserFeatureByUserId.mockResolvedValue({})
  membresias.assertOwnMembershipActive.mockResolvedValue({})
})

describe('permisos comunes de los endpoints /me', () => {
  it.each([
    ['getMyDisponibilidad', { idClinica: 8, fecha: LUNES }],
    ['getMyTurnosConfig', {}],
    ['saveMyTurnosConfig', { input: {} }],
    ['listMyClinicas', {}],
    ['createMyClinica', { input: {} }],
    ['listMyBloqueos', {}],
    ['createMyBloqueo', { input: {} }],
  ])('%s exige rol médico, perfil y plan con turnos', async (fn, extra) => {
    await expect(service[fn]({ ...extra, requesterIdUsuario: 1, requesterRol: 'paciente' })).rejects.toMatchObject({ status: 403 })

    repo.findMedicoByUserId.mockResolvedValueOnce(null)
    await expect(service[fn]({ ...extra, ...yo })).rejects.toMatchObject({ status: 404 })

    membresias.assertUserFeatureByUserId.mockRejectedValueOnce(new HttpError(403, 'sin turnos'))
    await expect(service[fn]({ ...extra, ...yo })).rejects.toMatchObject({ status: 403, message: 'sin turnos' })
  })
})

describe('listMedicos', () => {
  it('delega los filtros al repositorio', async () => {
    repo.listMedicos.mockResolvedValue([{ id_medico: 1 }])
    await expect(service.listMedicos({ q: 'paz' })).resolves.toEqual([{ id_medico: 1 }])
    expect(repo.listMedicos).toHaveBeenCalledWith({ q: 'paz' })
  })
})

describe('getDisponibilidad', () => {
  const args = { idMedico: 3, idClinica: 8, fecha: LUNES }

  it('exige médico, clínica y fecha', async () => {
    await expect(service.getDisponibilidad({ idMedico: 3, fecha: LUNES })).rejects.toMatchObject({ status: 400 })
  })

  it('en un consultorio compartido delega en la disponibilidad del consultorio', async () => {
    repo.findClinicaCompartida.mockResolvedValue({ compartido: 1 })
    consultoriosService.getDisponibilidadCompartida.mockResolvedValue({ slots: ['x'] })

    await expect(service.getDisponibilidad({ ...args, duracionMinutos: 45 })).resolves.toEqual({ slots: ['x'] })
    expect(consultoriosService.getDisponibilidadCompartida).toHaveBeenCalledWith({ idClinica: 8, fecha: LUNES, duracionMinutos: 45 })
  })

  it('sin franjas ese día devuelve una lista vacía', async () => {
    await expect(service.getDisponibilidad(args)).resolves.toEqual({ fecha: LUNES, dia_semana: 1, duracion_minutos: 30, slots: [] })
    expect(repo.findTurnosTomados).not.toHaveBeenCalled()
  })

  it('arma la grilla marcando turnos tomados y bloqueos del día', async () => {
    repo.findDisponibilidadByMedicoClinicaDia.mockResolvedValue([
      { id_disponibilidad: 5, hora_inicio: '09:00:00', hora_fin: '11:00:00' },
    ])
    // Un turno "Primera vez" sin hora_fin dura 60 min según el tipo
    repo.findTurnosTomados.mockResolvedValue([{ hora: '09:30', hora_fin: null, motivo_consulta: 'primera VEZ' }])
    repo.listBloqueosByMedico.mockResolvedValue([
      { fecha: LUNES, hora_inicio: '10:30', hora_fin: '11:00' },
      { fecha: '2026-10-20', hora_inicio: null, hora_fin: null },
    ])

    const { slots } = await service.getDisponibilidad(args)

    expect(slots).toEqual([
      { hora: '09:00:00', id_disponibilidad: 5, bloqueado: false, excede_horario: false, libre: true },
      { hora: '09:30:00', id_disponibilidad: 5, bloqueado: false, excede_horario: false, libre: false },
      { hora: '10:00:00', id_disponibilidad: 5, bloqueado: false, excede_horario: false, libre: false },
      { hora: '10:30:00', id_disponibilidad: 5, bloqueado: true, excede_horario: false, libre: false },
    ])
  })

  it('un bloqueo sin horas cubre el día entero', async () => {
    repo.findDisponibilidadByMedicoClinicaDia.mockResolvedValue([{ id_disponibilidad: 5, hora_inicio: '09:00', hora_fin: '10:00' }])
    repo.listBloqueosByMedico.mockResolvedValue([{ fecha: LUNES, hora_inicio: null, hora_fin: null }])

    const { slots } = await service.getDisponibilidad(args)
    expect(slots.every((s) => s.bloqueado && !s.libre)).toBe(true)
  })

  it('con una duración pedida mayor, un slot choca con el turno siguiente', async () => {
    repo.findDisponibilidadByMedicoClinicaDia.mockResolvedValue([{ id_disponibilidad: 5, hora_inicio: '09:00', hora_fin: '10:00' }])
    repo.findTurnosTomados.mockResolvedValue([{ hora: '09:30', hora_fin: '10:00' }])

    const { slots } = await service.getDisponibilidad({ ...args, duracionMinutos: 60 })
    expect(slots[0]).toMatchObject({ hora: '09:00:00', libre: false })
  })

  it('suma las agendas de única vez del día', async () => {
    repo.findExtraDisponibilidadByMedicoClinicaFecha.mockResolvedValue([{ hora_inicio: '15:00', hora_fin: '16:00' }])

    const { slots } = await service.getDisponibilidad(args)
    expect(slots.map((s) => s.hora)).toEqual(['15:00:00', '15:30:00'])
    expect(slots[0].id_disponibilidad).toBeNull()
  })

  it('usa 30 minutos si el médico no configuró una duración', async () => {
    repo.findTurnosConfigByMedico.mockResolvedValue({ config: null, tipos: null })
    repo.findDisponibilidadByMedicoClinicaDia.mockResolvedValue([{ id_disponibilidad: 1, hora_inicio: '08:00', hora_fin: '09:00' }])

    const { slots } = await service.getDisponibilidad(args)
    expect(slots).toHaveLength(2)
  })
})

describe('getMyDisponibilidad', () => {
  it('exige clínica y fecha', async () => {
    await expect(service.getMyDisponibilidad({ ...yo, fecha: LUNES })).rejects.toMatchObject({ status: 400 })
  })

  it('no deja consultar consultorios ajenos', async () => {
    repo.ensureMedicoHasClinica.mockResolvedValue(false)
    await expect(service.getMyDisponibilidad({ ...yo, idClinica: 8, fecha: LUNES })).rejects.toMatchObject({ status: 403 })
  })

  it('devuelve la disponibilidad propia', async () => {
    await expect(service.getMyDisponibilidad({ ...yo, idClinica: '8', fecha: LUNES })).resolves.toMatchObject({ fecha: LUNES })
    expect(repo.ensureMedicoHasClinica).toHaveBeenCalledWith({ idMedico: 3, idClinica: 8 })
  })
})

describe('configuración de turnos', () => {
  it('getTurnosConfigByMedico exige id y aplica defaults', async () => {
    await expect(service.getTurnosConfigByMedico({})).rejects.toMatchObject({ status: 400 })

    repo.findTurnosConfigByMedico.mockResolvedValue({ config: null, tipos: undefined })
    await expect(service.getTurnosConfigByMedico({ idMedico: 3 })).resolves.toEqual({
      duracion_turno_estandar: 30,
      tipos_turno: [],
    })
  })

  it('getMyTurnosConfig devuelve la config del médico autenticado', async () => {
    await expect(service.getMyTurnosConfig(yo)).resolves.toMatchObject({ duracion_turno_estandar: 30 })
    expect(repo.findTurnosConfigByMedico).toHaveBeenCalledWith(3)
  })

  it('rechaza duraciones inválidas', async () => {
    await expect(service.saveMyTurnosConfig({ ...yo, input: { duracion_turno_estandar: 12.5 } })).rejects.toMatchObject({ status: 400 })
    await expect(service.saveMyTurnosConfig({ ...yo, input: { duracion_turno_estandar: -5 } })).rejects.toMatchObject({ status: 400 })
    await expect(
      service.saveMyTurnosConfig({ ...yo, input: { tipos_turno: [{ nombre: 'Control', duracion_minutos: 0 }] } })
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/tipo de turno/) })
  })

  it('guarda los tipos con nombre y descarta los vacíos', async () => {
    await service.saveMyTurnosConfig({
      ...yo,
      input: {
        duracion_turno_estandar: 30,
        tipos_turno: [
          { id_tipo_turno: '1', nombre: ' Control ', duracion_minutos: '20', notificar_nuevo: 1 },
          { nombre: '', duracion_minutos: 0 },
          { nombre: 'Nuevo', duracion: 45 },
        ],
      },
    })

    expect(repo.upsertTurnosConfigByMedico).toHaveBeenCalledWith({
      idMedico: 3,
      duracionTurnoEstandar: 30,
      tiposTurno: [
        { idTipoTurno: 1, nombre: 'Control', duracion: 20, notificarNuevo: true },
        { idTipoTurno: null, nombre: 'Nuevo', duracion: 45, notificarNuevo: false },
      ],
    })
  })

  describe('al cambiar la duración estándar', () => {
    beforeEach(() => {
      repo.findTurnosFuturosByMedico.mockResolvedValue([
        { id_turno: 1, hora: '09:15', hora_fin: '09:45', fecha_iso: LUNES, id_clinica: 8 },
        { id_turno: 2, hora: '10:00', hora_fin: '10:20', fecha_iso: LUNES, id_clinica: 8 },
      ])
      repo.listClinicasByMedico.mockResolvedValue({
        clinics: [],
        disponibilidad: [{ id_clinica: 8, dia_semana: 1, hora_inicio: '09:00', hora_fin: '12:00' }],
        disponibilidadUnica: [],
      })
    })

    it('frena con 409 si hay turnos que quedarían fuera de la grilla', async () => {
      await expect(service.saveMyTurnosConfig({ ...yo, input: { duracion_turno_estandar: 20 } })).rejects.toMatchObject({
        status: 409,
        details: { turnos_afectados: [expect.objectContaining({ id_turno: 1 })] },
      })
      expect(repo.upsertTurnosConfigByMedico).not.toHaveBeenCalled()
    })

    it('guarda igual si el médico confirma', async () => {
      await service.saveMyTurnosConfig({ ...yo, input: { duracion_turno_estandar: 20, confirmar: '1' } })
      expect(repo.upsertTurnosConfigByMedico).toHaveBeenCalled()
    })

    it('guarda si todos los turnos siguen alineados', async () => {
      repo.findTurnosFuturosByMedico.mockResolvedValue([{ hora: '10:00', hora_fin: '10:15', fecha_iso: LUNES, id_clinica: 8 }])
      await service.saveMyTurnosConfig({ ...yo, input: { duracion_turno_estandar: 15 } })
      expect(repo.upsertTurnosConfigByMedico).toHaveBeenCalled()
    })

    it('considera las agendas de única vez', async () => {
      repo.findTurnosFuturosByMedico.mockResolvedValue([{ hora: '16:00', hora_fin: null, fecha_iso: '2026-10-21', id_clinica: 8 }])
      repo.listClinicasByMedico.mockResolvedValue({
        clinics: [],
        disponibilidad: [],
        disponibilidadUnica: [{ id_clinica: 8, fecha: '2026-10-21', hora_inicio: '15:00', hora_fin: '18:00' }],
      })
      await service.saveMyTurnosConfig({ ...yo, input: { duracion_turno_estandar: 20 } })
      expect(repo.upsertTurnosConfigByMedico).toHaveBeenCalled()
    })

    it('no revisa turnos si no hay agendados', async () => {
      repo.findTurnosFuturosByMedico.mockResolvedValue([])
      await service.saveMyTurnosConfig({ ...yo, input: { duracion_turno_estandar: 20 } })
      expect(repo.listClinicasByMedico).not.toHaveBeenCalled()
    })
  })
})

describe('términos y condiciones', () => {
  it('solo los consulta un médico con perfil', async () => {
    await expect(service.getMyTyc({ requesterRol: 'paciente' })).rejects.toMatchObject({ status: 403 })
    repo.findMedicoIdByUserId.mockResolvedValueOnce(null)
    await expect(service.getMyTyc(yo)).rejects.toMatchObject({ status: 404 })
  })

  it('devuelve los TyC activos o null', async () => {
    repo.findActiveTycByMedico.mockResolvedValueOnce({ id_tyc: 1 })
    await expect(service.getMyTyc(yo)).resolves.toEqual({ id_tyc: 1 })
    repo.findActiveTycByMedico.mockResolvedValueOnce(undefined)
    await expect(service.getMyTyc(yo)).resolves.toBeNull()
  })

  it('al guardar valida rol, texto y perfil', async () => {
    await expect(service.saveMyTyc({ texto: 'x', requesterRol: 'asistente' })).rejects.toMatchObject({ status: 403 })
    await expect(service.saveMyTyc({ texto: '   ', ...yo })).rejects.toMatchObject({ status: 400 })
    repo.findMedicoIdByUserId.mockResolvedValueOnce(null)
    await expect(service.saveMyTyc({ texto: 'x', ...yo })).rejects.toMatchObject({ status: 404 })
  })

  it('no crea versión nueva si el texto no cambió', async () => {
    repo.findActiveTycByMedico.mockResolvedValue({ id_tyc: 1, version: 2, texto: 'Mis términos' })
    await expect(service.saveMyTyc({ texto: ' Mis términos ', ...yo })).resolves.toMatchObject({ id_tyc: 1 })
    expect(repo.insertMedicoTyc).not.toHaveBeenCalled()
  })

  it('crea la versión siguiente y desactiva la anterior', async () => {
    repo.findActiveTycByMedico.mockResolvedValue({ id_tyc: 1, version: 2, texto: 'Viejos' })
    repo.insertMedicoTyc.mockResolvedValue({ id_tyc: 2, version: 3 })

    await expect(service.saveMyTyc({ texto: 'Nuevos', ...yo })).resolves.toEqual({ id_tyc: 2, version: 3 })
    expect(repo.deactivateTycByMedico).toHaveBeenCalledWith(3)
    expect(repo.insertMedicoTyc).toHaveBeenCalledWith({ idMedico: 3, version: 3, texto: 'Nuevos' })
  })

  it('la primera versión es la 1', async () => {
    repo.findActiveTycByMedico.mockResolvedValue(null)
    await service.saveMyTyc({ texto: 'Primeros', ...yo })
    expect(repo.insertMedicoTyc).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }))
  })
})

describe('clínicas', () => {
  it('listClinicasByMedico exige id y agrupa rangos por clínica', async () => {
    await expect(service.listClinicasByMedico({})).rejects.toMatchObject({ status: 400 })

    repo.listClinicasByMedico.mockResolvedValue({
      clinics: [
        { id_clinica: 8, nombre: 'Centro', direccion: 'Calle 1', link: null, ciudad: 'La Plata' },
        { id_clinica: 9, nombre: 'Consulta Virtual', direccion: null, link: null, ciudad: null },
        { id_clinica: 10, nombre: 'Zoom', direccion: null, link: 'https://zoom', ciudad: null },
      ],
      disponibilidad: [
        { id_clinica: 8, dia_semana: 1, hora_inicio: '09:00', hora_fin: '12:00' },
        { id_clinica: 8, dia_semana: 3, hora_inicio: '14:00', hora_fin: '18:00' },
      ],
      disponibilidadUnica: [{ id_clinica: 8, fecha: '2026-10-25', hora_inicio: '10:00', hora_fin: '12:00' }],
    })

    const [centro, virtualPorNombre, virtualPorLink] = await service.listClinicasByMedico({ idMedico: 3 })

    expect(centro).toMatchObject({ id: 8, tipo: 'presencial', ciudad: 'La Plata', direccion: 'Calle 1', link: 'Calle 1' })
    expect(centro.rangos).toEqual([
      expect.objectContaining({ id: 81, dia: 'Lun', dias: ['Lun'], inicio: '09:00', fin: '12:00', frecuencia: 'semanal' }),
      expect.objectContaining({ id: 82, dia: 'Mie' }),
    ])
    expect(centro.rangos_unicos).toEqual([{ id: 891, frecuencia: 'unica', fecha: '2026-10-25', inicio: '10:00', fin: '12:00' }])
    expect(virtualPorNombre.tipo).toBe('virtual')
    expect(virtualPorLink).toMatchObject({ tipo: 'virtual', direccion: 'https://zoom' })
  })

  it('createMyClinica exige membresía propia (no la de un gerente)', async () => {
    membresias.assertOwnMembershipActive.mockRejectedValue(new HttpError(402, 'vencida'))
    await expect(service.createMyClinica({ ...yo, input: { nombre: 'X' } })).rejects.toMatchObject({ status: 402 })
    expect(membresias.assertOwnMembershipActive).toHaveBeenCalledWith(60, 'Agregar una clínica propia')
  })

  it('createMyClinica valida nombre y rangos', async () => {
    await expect(service.createMyClinica({ ...yo, input: { nombre: ' ' } })).rejects.toMatchObject({ status: 400 })
    await expect(service.createMyClinica({ ...yo, input: { nombre: 'Centro', rangos: [] } })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/al menos un rango/),
    })
  })

  it('createMyClinica normaliza rangos semanales y de única vez', async () => {
    await service.createMyClinica({
      ...yo,
      input: {
        nombre: ' Centro ',
        direccion: ' Calle 1 ',
        tipo: 'presencial',
        rangos: [
          { dias: ['Lun', 'Mie', 'Xyz'], inicio: '09:00', fin: '12:00', duracion: 20 },
          { dia: 'Vie', inicio: '14:00', fin: '16:00', duracion: -1 },
          { frecuencia: 'unica', fecha: '2026-10-25', inicio: '10:00', fin: '11:00' },
          { dias: ['Mar'], inicio: '', fin: '12:00' },
        ],
      },
    })

    expect(repo.createClinicaWithDisponibilidad).toHaveBeenCalledWith(
      expect.objectContaining({
        idMedico: 3,
        idCiudad: 4,
        nombre: 'Centro',
        direccion: 'Calle 1',
        tipo: 'presencial',
        rangosSemanales: [
          { diaSemana: 1, inicio: '09:00:00', fin: '12:00:00', duracion: 20 },
          { diaSemana: 3, inicio: '09:00:00', fin: '12:00:00', duracion: 20 },
          { diaSemana: 5, inicio: '14:00:00', fin: '16:00:00', duracion: 30 },
        ],
        rangosUnicos: [{ fecha: '2026-10-25', inicio: '10:00:00', fin: '11:00:00' }],
      })
    )
  })

  it('createMyClinica busca una ciudad si el médico no tiene', async () => {
    repo.findMedicoByUserId.mockResolvedValue({ id_medico: 3, id_ciudad: null })
    repo.findAnyCityId.mockResolvedValue(null)
    await expect(
      service.createMyClinica({ ...yo, input: { nombre: 'Centro', rangos: [{ dia: 'Lun', inicio: '09:00', fin: '10:00' }] } })
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/ciudad/) })

    repo.findAnyCityId.mockResolvedValue(7)
    await service.createMyClinica({ ...yo, input: { nombre: 'Centro', tipo_virtual: true, rangos: [{ dia: 'Lun', inicio: '09:00', fin: '10:00' }] } })
    expect(repo.createClinicaWithDisponibilidad).toHaveBeenCalledWith(expect.objectContaining({ idCiudad: 7, tipo: 'virtual' }))
  })

  it.each(['updateMyClinica', 'deleteMyClinica'])('%s exige id y que la clínica sea propia', async (fn) => {
    await expect(service[fn]({ ...yo, input: {} })).rejects.toMatchObject({ status: 400 })
    repo.ensureMedicoHasClinica.mockResolvedValue(false)
    await expect(service[fn]({ ...yo, idClinica: 8, input: {} })).rejects.toMatchObject({ status: 403 })
  })

  it('updateMyClinica valida y guarda', async () => {
    await expect(service.updateMyClinica({ ...yo, idClinica: 8, input: { nombre: 'X' } })).rejects.toMatchObject({ status: 400 })
    await expect(service.updateMyClinica({ ...yo, idClinica: 8, input: { rangos: [{ dia: 'Lun', inicio: '09:00', fin: '10:00' }] } })).rejects.toMatchObject({ status: 400 })

    await service.updateMyClinica({
      ...yo,
      idClinica: 8,
      input: { nombre: 'Centro', link: ' https://x ', tipo: 'virtual', rangos: [{ dia: 'Lun', inicio: '09:00', fin: '10:00' }] },
    })
    expect(repo.updateClinicaWithDisponibilidad).toHaveBeenCalledWith(
      expect.objectContaining({ idClinica: 8, nombre: 'Centro', link: 'https://x', tipo: 'virtual' })
    )
  })

  it('deleteMyClinica desactiva la clínica', async () => {
    await expect(service.deleteMyClinica({ ...yo, idClinica: '8' })).resolves.toEqual({ ok: true })
    expect(repo.deleteClinicaByMedico).toHaveBeenCalledWith({ idMedico: 3, idClinica: 8 })
  })
})

describe('bloqueos', () => {
  it('listMyBloqueos valida la clínica si se filtra', async () => {
    repo.listBloqueosByMedico.mockResolvedValue(['b'])
    await expect(service.listMyBloqueos(yo)).resolves.toEqual(['b'])
    expect(repo.ensureMedicoHasClinica).not.toHaveBeenCalled()

    repo.ensureMedicoHasClinica.mockResolvedValue(false)
    await expect(service.listMyBloqueos({ ...yo, idClinica: 8 })).rejects.toMatchObject({ status: 403 })
  })

  it('createMyBloqueo valida los datos', async () => {
    await expect(service.createMyBloqueo({ ...yo, input: { fecha: LUNES } })).rejects.toMatchObject({ status: 400, message: 'id_clinica es obligatorio' })
    await expect(service.createMyBloqueo({ ...yo, input: { id_clinica: 8 } })).rejects.toMatchObject({ status: 400 })
    await expect(
      service.createMyBloqueo({ ...yo, input: { id_clinica: 8, fecha_desde: '2026-10-22', fecha_hasta: '2026-10-20' } })
    ).rejects.toMatchObject({ status: 400, message: 'Rango de fechas invalido' })

    repo.ensureMedicoHasClinica.mockResolvedValue(false)
    await expect(service.createMyBloqueo({ ...yo, input: { id_clinica: 8, fecha: LUNES } })).rejects.toMatchObject({ status: 403 })
  })

  it('createMyBloqueo crea un bloqueo por cada día del rango', async () => {
    await service.createMyBloqueo({
      ...yo,
      input: { id_clinica: '8', fecha_desde: '2026-10-30', fecha_hasta: '2026-11-02', hora_inicio: '09:00', hora_fin: '12:00:00', motivo: ' Congreso ' },
    })

    expect(repo.createBloqueo.mock.calls.map(([b]) => b.fecha)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(repo.createBloqueo).toHaveBeenCalledWith({
      idMedico: 3, idClinica: 8, fecha: '2026-10-30', horaInicio: '09:00:00', horaFin: '12:00:00', motivo: 'Congreso',
    })
  })

  it('updateMyBloqueo y deleteMyBloqueo exigen id y bloqueo propio', async () => {
    for (const fn of ['updateMyBloqueo', 'deleteMyBloqueo']) {
      await expect(service[fn]({ ...yo, input: {} })).rejects.toMatchObject({ status: 400 })
      repo.findBloqueoById.mockResolvedValueOnce({ id_medico: 99 })
      await expect(service[fn]({ ...yo, idExcepcion: 1, input: {} })).rejects.toMatchObject({ status: 404 })
    }
  })

  it('updateMyBloqueo exige fecha y actualiza', async () => {
    repo.findBloqueoById.mockResolvedValue({ id_medico: 3, id_clinica: 8 })
    await expect(service.updateMyBloqueo({ ...yo, idExcepcion: 1, input: {} })).rejects.toMatchObject({ status: 400, message: 'fecha es obligatoria' })

    await service.updateMyBloqueo({ ...yo, idExcepcion: '1', input: { fecha: LUNES } })
    expect(repo.updateBloqueo).toHaveBeenCalledWith({ idExcepcion: 1, idClinica: 8, fecha: LUNES, horaInicio: null, horaFin: null, motivo: null })
  })

  it('deleteMyBloqueo borra el bloqueo propio', async () => {
    repo.findBloqueoById.mockResolvedValue({ id_medico: 3 })
    await expect(service.deleteMyBloqueo({ ...yo, idExcepcion: '1' })).resolves.toEqual({ ok: true })
    expect(repo.deleteBloqueo).toHaveBeenCalledWith(1)
  })
})

describe('configuración de mails', () => {
  it('valida rol y perfil', async () => {
    for (const fn of ['getMyMailConfig', 'saveMyMailConfig']) {
      await expect(service[fn]({ requesterRol: 'paciente' })).rejects.toMatchObject({ status: 403 })
      repo.findMedicoMailConfigByUserId.mockResolvedValueOnce(null)
      await expect(service[fn]({ ...yo, input: {} })).rejects.toMatchObject({ status: 404 })
    }
  })

  it('devuelve y guarda booleanos', async () => {
    repo.findMedicoMailConfigByUserId.mockResolvedValue({ id_medico: 3, enviar_recetas_mail: 1, notif_turno_nuevo: 0, notif_cancelacion: 1 })
    await expect(service.getMyMailConfig(yo)).resolves.toEqual({ enviar_recetas_mail: true, notif_turno_nuevo: false, notif_cancelacion: true })

    await expect(service.saveMyMailConfig({ ...yo, input: { enviar_recetas_mail: 1 } })).resolves.toEqual({
      enviar_recetas_mail: true,
      notif_turno_nuevo: false,
      notif_cancelacion: false,
    })
    expect(repo.updateMedicoMailConfig).toHaveBeenCalledWith({ idMedico: 3, enviarRecetasMail: true, notifTurnoNuevo: false, notifCancelacion: false })
  })
})

describe('solicitudes de recetas', () => {
  it('valida rol y perfil', async () => {
    for (const fn of ['listMyRecetasSolicitudes', 'updateMyRecetaSolicitudEstado']) {
      await expect(service[fn]({ requesterRol: 'paciente' })).rejects.toMatchObject({ status: 403 })
      repo.findMedicoByUserId.mockResolvedValueOnce(null)
      await expect(service[fn](yo)).rejects.toMatchObject({ status: 404 })
    }
  })

  it('parsea items_json de forma tolerante', async () => {
    repo.listRecetaSolicitudesByMedico.mockResolvedValue([
      { id: 1, items_json: '[{"medicamento":"Ibuprofeno"}]' },
      { id: 2, items_json: [{ medicamento: 'Paracetamol' }] },
      { id: 3, items_json: '{roto' },
      { id: 4, items_json: '{"no":"array"}' },
    ])

    const rows = await service.listMyRecetasSolicitudes(yo)
    expect(rows.map((r) => r.items)).toEqual([[{ medicamento: 'Ibuprofeno' }], [{ medicamento: 'Paracetamol' }], [], []])
  })

  it('normaliza el estado a resuelta o enviada', async () => {
    repo.updateRecetaSolicitudEstadoByMedico.mockResolvedValue(true)
    await expect(service.updateMyRecetaSolicitudEstado({ ...yo, idSolicitud: '5', estado: ' RESUELTA ' })).resolves.toEqual({
      ok: true,
      id_solicitud: 5,
      estado: 'resuelta',
    })
    await expect(service.updateMyRecetaSolicitudEstado({ ...yo, idSolicitud: 5, estado: 'otra' })).resolves.toMatchObject({ estado: 'enviada' })
  })

  it('responde 404 si la solicitud no es del médico', async () => {
    repo.updateRecetaSolicitudEstadoByMedico.mockResolvedValue(false)
    await expect(service.updateMyRecetaSolicitudEstado({ ...yo, idSolicitud: 5, estado: 'resuelta' })).rejects.toMatchObject({ status: 404 })
  })
})

describe('verificarHorarioDisponible', () => {
  // Atiende de 9 a 11:30; turno de 10 a 10:30 tomado; bloqueado 11 a 11:30.
  beforeEach(() => {
    repo.findDisponibilidadByMedicoClinicaDia.mockResolvedValue([{ id_disponibilidad: 5, hora_inicio: '09:00', hora_fin: '11:30' }])
    repo.findTurnosTomados.mockResolvedValue([{ hora: '10:00', hora_fin: '10:30' }])
    repo.listBloqueosByMedico.mockResolvedValue([{ fecha: LUNES, hora_inicio: '11:00', hora_fin: '11:30' }])
  })

  const pedir = (hora, duracionMinutos) => service.verificarHorarioDisponible({ idMedico: 3, idClinica: 8, fecha: LUNES, hora, duracionMinutos })

  it('acepta un horario libre que entra y devuelve la duración a guardar', async () => {
    await expect(pedir('09:00', 60)).resolves.toEqual({ duracionMinutos: 60 })
    await expect(pedir('10:30:00', null)).resolves.toEqual({ duracionMinutos: 30 })
  })

  it('rechaza un turno que termina después del horario de atención', async () => {
    repo.listBloqueosByMedico.mockResolvedValue([])
    repo.findTurnosTomados.mockResolvedValue([])
    await expect(pedir('10:30', 120)).rejects.toMatchObject({
      status: 409,
      message: 'Un turno de 120 minutos a las 10:30 termina después del horario de atención',
      details: { code: 'EXCEDE_HORARIO' },
    })
  })

  it('rechaza horarios fuera de la grilla, bloqueados u ocupados', async () => {
    await expect(pedir('09:10', 30)).rejects.toMatchObject({ status: 409, details: { code: 'FUERA_DE_AGENDA' } })
    await expect(pedir('11:00', 30)).rejects.toMatchObject({ status: 409, details: { code: 'HORARIO_BLOQUEADO' } })
    await expect(pedir('09:30', 60)).rejects.toMatchObject({ status: 409, details: { code: 'TURNO_OVERLAP' } })
  })

  it('un día sin agenda no tiene horarios', async () => {
    repo.findDisponibilidadByMedicoClinicaDia.mockResolvedValue([])
    await expect(pedir('09:00', 30)).rejects.toMatchObject({ details: { code: 'FUERA_DE_AGENDA' } })
  })
})

describe('getMedicoPublico', () => {
  it('devuelve el médico o 404', async () => {
    repo.listMedicos.mockResolvedValueOnce([{ id_medico: 3, nombre: 'Juan' }])
    await expect(service.getMedicoPublico({ idMedico: '3' })).resolves.toEqual({ id_medico: 3, nombre: 'Juan' })
    expect(repo.listMedicos).toHaveBeenCalledWith({ idMedico: 3 })

    repo.listMedicos.mockResolvedValueOnce([])
    await expect(service.getMedicoPublico({ idMedico: 3 })).rejects.toMatchObject({ status: 404 })
    await expect(service.getMedicoPublico({})).rejects.toMatchObject({ status: 400 })
  })
})

describe('getResumenDisponibilidad', () => {
  const rango = { idMedico: 3, idClinica: 8, desde: '2026-10-19', hasta: '2026-10-25' }

  // Lunes 9-11 y miércoles 9-10; un turno el lunes 19 a las 9, el miércoles
  // 21 lleno, el lunes 26 fuera de rango; bloqueado todo el jueves 22;
  // agenda extra el sábado 24.
  const franjasSemana = [
    { id_disponibilidad: 5, dia_semana: 1, hora_inicio: '09:00', hora_fin: '11:00' },
    { id_disponibilidad: 6, dia_semana: 3, hora_inicio: '09:00', hora_fin: '10:00' },
    { id_disponibilidad: 7, dia_semana: 4, hora_inicio: '09:00', hora_fin: '10:00' },
  ]
  const extras = [{ fecha: '2026-10-24', hora_inicio: '15:00', hora_fin: '16:00' }]
  const tomados = [
    { fecha: '2026-10-19', hora: '09:00', hora_fin: '09:30' },
    { fecha: '2026-10-21', hora: '09:00', hora_fin: '10:00' },
  ]
  const bloqueos = [{ fecha: '2026-10-22', hora_inicio: null, hora_fin: null }]

  beforeEach(() => {
    repo.findDisponibilidadByMedicoClinica.mockResolvedValue(franjasSemana)
    repo.findExtraDisponibilidadByMedicoClinicaRango.mockResolvedValue(extras)
    repo.findTurnosTomadosRango.mockResolvedValue(tomados)
    repo.listBloqueosByMedico.mockResolvedValue(bloqueos)
  })

  it('valida parámetros y el tamaño del rango', async () => {
    await expect(service.getResumenDisponibilidad({ ...rango, hasta: undefined })).rejects.toMatchObject({ status: 400 })
    await expect(service.getResumenDisponibilidad({ ...rango, desde: '2026-02-30' })).rejects.toMatchObject({ status: 400 })
    await expect(service.getResumenDisponibilidad({ ...rango, desde: '2026-10-26' })).rejects.toMatchObject({ status: 400, message: 'Rango de fechas invalido' })
    await expect(service.getResumenDisponibilidad({ ...rango, hasta: '2026-12-31' })).rejects.toMatchObject({ status: 400, message: /62 días/ })
  })

  it('devuelve el estado de cada día con 4 consultas en total', async () => {
    const { dias } = await service.getResumenDisponibilidad(rango)

    expect(dias).toEqual([
      { fecha: '2026-10-19', estado: 'disponible' },
      { fecha: '2026-10-20', estado: 'sin-horarios' },
      { fecha: '2026-10-21', estado: 'sin-horarios' },
      { fecha: '2026-10-22', estado: 'bloqueada' },
      { fecha: '2026-10-23', estado: 'sin-horarios' },
      { fecha: '2026-10-24', estado: 'disponible' },
      { fecha: '2026-10-25', estado: 'sin-horarios' },
    ])
    expect(repo.findTurnosTomadosRango).toHaveBeenCalledWith({ idMedico: 3, desde: '2026-10-19', hasta: '2026-10-25' })
    expect(repo.findTurnosTomados).not.toHaveBeenCalled()
  })

  it('coincide día por día con la disponibilidad diaria', async () => {
    // La consulta diaria recibe los mismos datos filtrados por fecha.
    repo.findDisponibilidadByMedicoClinicaDia.mockImplementation(async ({ diaSemana }) =>
      franjasSemana.filter((f) => f.dia_semana === diaSemana))
    repo.findExtraDisponibilidadByMedicoClinicaFecha.mockImplementation(async ({ fecha }) => extras.filter((e) => e.fecha === fecha))
    repo.findTurnosTomados.mockImplementation(async ({ fecha }) => tomados.filter((t) => t.fecha === fecha))

    const { dias } = await service.getResumenDisponibilidad({ ...rango, duracionMinutos: 60 })
    for (const { fecha, estado } of dias) {
      const { slots } = await service.getDisponibilidad({ idMedico: 3, idClinica: 8, fecha, duracionMinutos: 60 })
      const esperado = slots.some((s) => s.libre) ? 'disponible' : slots.some((s) => s.bloqueado) ? 'bloqueada' : 'sin-horarios'
      expect([fecha, estado]).toEqual([fecha, esperado])
    }
  })

  it('en un consultorio compartido delega en el resumen del consultorio', async () => {
    repo.findClinicaCompartida.mockResolvedValue({ compartido: 1 })
    consultoriosService.getResumenDisponibilidadCompartida.mockResolvedValue({ dias: ['x'] })

    await expect(service.getResumenDisponibilidad(rango)).resolves.toEqual({ dias: ['x'] })
    expect(consultoriosService.getResumenDisponibilidadCompartida).toHaveBeenCalledWith(expect.objectContaining({
      idClinica: 8,
      desde: '2026-10-19',
      hasta: '2026-10-25',
      fechas: expect.arrayContaining(['2026-10-19', '2026-10-25']),
    }))
  })
})
