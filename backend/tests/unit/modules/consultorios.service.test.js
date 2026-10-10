jest.mock('../../../src/modules/consultorios/consultorios.repository')
jest.mock('../../../src/modules/turnos/turnos.repository')
jest.mock('../../../src/modules/membresias/membresias.service')
jest.mock('../../../src/utils/mailer', () => require('../../mocks/mailer'))

const repo = require('../../../src/modules/consultorios/consultorios.repository')
const turnosRepo = require('../../../src/modules/turnos/turnos.repository')
const membresias = require('../../../src/modules/membresias/membresias.service')
const mailer = require('../../../src/utils/mailer')
const HttpError = require('../../../src/utils/httpError')
const service = require('../../../src/modules/consultorios/consultorios.service')

const medico = { requesterIdUsuario: 60, requesterRol: 'medico' }
const propietario = { requesterIdUsuario: 70, requesterRol: 'propietario' }
const LUNES = '2026-10-19'

beforeEach(() => {
  repo.findMedicoByUserId.mockResolvedValue({ id_medico: 3, nombre: 'Ana', apellido: 'Paz' })
  repo.findPropietarioByUserId.mockResolvedValue({ id_propietario: 5 })
  repo.isClinicaOwnedByMedico.mockResolvedValue(true)
  repo.isClinicaOwnedByPropietario.mockResolvedValue(true)
  repo.findAdicionalByMedico.mockResolvedValue({ id_adicional: 1, estado: 'activo', max_consultorios: 2, monto_mensual: 20000 })
  repo.contarPublicadosByMedico.mockResolvedValue(0)
  repo.listClinicasByPropietario.mockResolvedValue([{ id_clinica: 11 }, { id_clinica: 12 }])
  repo.listClinicasCompartidasByMedicoDueno.mockResolvedValue([{ id_clinica: 21 }])
  repo.findDisponibilidadByClinicaDia.mockResolvedValue([])
  repo.findExcepcionesByClinicaFecha.mockResolvedValue([])
  membresias.assertOwnMembershipActive.mockResolvedValue({})
  membresias.assertMedicoFeatureByMedicoId.mockResolvedValue({})
  turnosRepo.findTurnosTomadosPorClinica.mockResolvedValue([])
  mailer.sendSolicitudConsultorioEmail.mockResolvedValue()
  mailer.sendSolicitudResueltaEmail.mockResolvedValue()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('dueño del consultorio', () => {
  // getDisponibilidadConfig es el endpoint más simple que pasa por resolveDuenoOrThrow.
  it('un propietario dueño puede operar', async () => {
    repo.listDisponibilidadByClinica.mockResolvedValue({ rangos: [], excepciones: [] })
    await expect(service.getDisponibilidadConfig({ idClinica: '11', ...propietario })).resolves.toEqual({ rangos: [], excepciones: [] })
    expect(repo.isClinicaOwnedByPropietario).toHaveBeenCalledWith({ idPropietario: 5, idClinica: 11 })
  })

  it('un médico dueño puede operar', async () => {
    await service.getDisponibilidadConfig({ idClinica: 21, ...medico })
    expect(repo.isClinicaOwnedByMedico).toHaveBeenCalledWith({ idMedico: 3, idClinica: 21 })
  })

  it.each([
    ['propietario sin perfil', propietario, () => repo.findPropietarioByUserId.mockResolvedValue(null), 404],
    ['propietario no dueño', propietario, () => repo.isClinicaOwnedByPropietario.mockResolvedValue(false), 403],
    ['médico sin perfil', medico, () => repo.findMedicoByUserId.mockResolvedValue(null), 404],
    ['médico no dueño', medico, () => repo.isClinicaOwnedByMedico.mockResolvedValue(false), 403],
    ['otro rol', { requesterIdUsuario: 1, requesterRol: 'gerente' }, () => {}, 403],
  ])('%s → %s', async (_caso, who, setup, status) => {
    setup()
    await expect(service.getDisponibilidadConfig({ idClinica: 11, ...who })).rejects.toMatchObject({ status })
  })
})

describe('listados', () => {
  it('listPublicos delega en el repositorio', async () => {
    repo.listConsultoriosPublicos.mockResolvedValue(['c'])
    await expect(service.listPublicos()).resolves.toEqual(['c'])
  })

  it('listMisConsultorios depende del rol', async () => {
    await expect(service.listMisConsultorios(propietario)).resolves.toEqual([{ id_clinica: 11 }, { id_clinica: 12 }])
    await expect(service.listMisConsultorios(medico)).resolves.toEqual([{ id_clinica: 21 }])
    await expect(service.listMisConsultorios({ requesterRol: 'paciente' })).rejects.toMatchObject({ status: 403 })

    repo.findPropietarioByUserId.mockResolvedValue(null)
    await expect(service.listMisConsultorios(propietario)).rejects.toMatchObject({ status: 404 })
    repo.findMedicoByUserId.mockResolvedValue(null)
    await expect(service.listMisConsultorios(medico)).rejects.toMatchObject({ status: 404 })
  })

  it('listSolicitudesRecibidas junta las de todos los consultorios propios', async () => {
    repo.listSolicitudesByClinicas.mockResolvedValue(['s'])
    await expect(service.listSolicitudesRecibidas(propietario)).resolves.toEqual(['s'])
    expect(repo.listSolicitudesByClinicas).toHaveBeenCalledWith([11, 12])
  })

  it('listMisSolicitudes es solo para médicos', async () => {
    repo.listSolicitudesByMedico.mockResolvedValue(['s'])
    await expect(service.listMisSolicitudes(medico)).resolves.toEqual(['s'])
    await expect(service.listMisSolicitudes(propietario)).rejects.toMatchObject({ status: 403 })
  })

  it('listMedicosVinculados y desvincularMedico validan dueño', async () => {
    repo.listMedicosVinculados.mockResolvedValue(['m'])
    await expect(service.listMedicosVinculados({ idClinica: '11', ...propietario })).resolves.toEqual(['m'])

    await service.desvincularMedico({ idClinica: '11', idMedico: '3', ...propietario })
    expect(repo.desvincularMedico).toHaveBeenCalledWith({ idClinica: 11, idMedico: 3 })
  })
})

describe('crearConsultorio', () => {
  const input = { nombre: 'Sala 1', direccion: 'Calle 1', id_ciudad: '4' }

  it('solo lo usan propietarios con perfil', async () => {
    await expect(service.crearConsultorio({ input, ...medico })).rejects.toMatchObject({ status: 403 })
    repo.findPropietarioByUserId.mockResolvedValue(null)
    await expect(service.crearConsultorio({ input, ...propietario })).rejects.toMatchObject({ status: 404 })
  })

  it('valida nombre, dirección y ciudad', async () => {
    await expect(service.crearConsultorio({ input: { ...input, nombre: '' }, ...propietario })).rejects.toMatchObject({ status: 400 })
    await expect(service.crearConsultorio({ input: { ...input, direccion: '' }, ...propietario })).rejects.toMatchObject({ status: 400 })
    await expect(service.crearConsultorio({ input: { ...input, id_ciudad: 'x' }, ...propietario })).rejects.toMatchObject({
      status: 400,
      message: 'id_ciudad es obligatorio',
    })
  })

  it('crea el consultorio', async () => {
    repo.createClinicaForPropietario.mockResolvedValue(40)
    await expect(service.crearConsultorio({ input, ...propietario })).resolves.toEqual({ id_clinica: 40, nombre: 'Sala 1' })
    expect(repo.createClinicaForPropietario).toHaveBeenCalledWith({ idPropietario: 5, nombre: 'Sala 1', idCiudad: 4, direccion: 'Calle 1', telefono: null })
  })
})

describe('publicarConsultorio', () => {
  it('solo lo usa un médico dueño', async () => {
    await expect(service.publicarConsultorio({ idClinica: 21, publicar: true, ...propietario })).rejects.toMatchObject({ status: 403 })
    repo.findMedicoByUserId.mockResolvedValueOnce(null)
    await expect(service.publicarConsultorio({ idClinica: 21, publicar: true, ...medico })).rejects.toMatchObject({ status: 404 })
    repo.isClinicaOwnedByMedico.mockResolvedValueOnce(false)
    await expect(service.publicarConsultorio({ idClinica: 21, publicar: true, ...medico })).rejects.toMatchObject({ status: 403 })
  })

  it('publicar exige membresía propia', async () => {
    membresias.assertOwnMembershipActive.mockRejectedValue(new HttpError(402, 'vencida'))
    await expect(service.publicarConsultorio({ idClinica: 21, publicar: true, ...medico })).rejects.toMatchObject({ status: 402 })
  })

  it('publicar exige el adicional activo', async () => {
    repo.findAdicionalByMedico.mockResolvedValue({ estado: 'cancelado' })
    await expect(service.publicarConsultorio({ idClinica: 21, publicar: true, ...medico })).rejects.toMatchObject({
      status: 402,
      details: { code: 'ADICIONAL_REQUERIDO' },
    })
  })

  it('respeta el tope del adicional', async () => {
    repo.contarPublicadosByMedico.mockResolvedValue(2)
    await expect(service.publicarConsultorio({ idClinica: 21, publicar: true, ...medico })).rejects.toMatchObject({
      status: 409,
      details: { code: 'ADICIONAL_TOPE' },
    })
  })

  it('usa el tope por defecto (2) si el adicional no trae uno', async () => {
    repo.findAdicionalByMedico.mockResolvedValue({ estado: 'activo', max_consultorios: null })
    repo.contarPublicadosByMedico.mockResolvedValue(1)
    await expect(service.publicarConsultorio({ idClinica: 21, publicar: true, ...medico })).resolves.toEqual({ id_clinica: 21, compartido: true })
  })

  it('despublicar no pide adicional ni membresía', async () => {
    repo.findAdicionalByMedico.mockResolvedValue(null)
    await expect(service.publicarConsultorio({ idClinica: '21', publicar: false, ...medico })).resolves.toEqual({ id_clinica: 21, compartido: false })
    expect(membresias.assertOwnMembershipActive).not.toHaveBeenCalled()
    expect(repo.marcarClinicaCompartida).toHaveBeenCalledWith({ idClinica: '21', compartido: false })
  })
})

describe('guardarDisponibilidad', () => {
  const args = { idClinica: '11', ...propietario }

  it('rechaza rangos con fin antes del inicio', async () => {
    await expect(
      service.guardarDisponibilidad({ ...args, input: { rangos: [{ dias: ['Lun'], inicio: '12:00', fin: '09:00' }] } })
    ).rejects.toMatchObject({ status: 400, message: 'La hora de fin debe ser posterior a la de inicio' })
  })

  it('exige al menos un horario', async () => {
    await expect(service.guardarDisponibilidad({ ...args, input: {} })).rejects.toMatchObject({ status: 400 })
  })

  it('normaliza rangos y excepciones', async () => {
    repo.listDisponibilidadByClinica.mockResolvedValue('nueva')

    await expect(
      service.guardarDisponibilidad({
        ...args,
        input: {
          rangos: [
            { dias: ['Lun', 'Mar', '???'], inicio: '09:00', fin: '13:00', duracion: 40 },
            { dia: 'Sab', inicio: '10:00', fin: '12:00', duracion: 'x' },
            { dias: ['Dom'], inicio: '', fin: '' },
          ],
          excepciones: [
            { fecha: '2026-12-25', tipo: 'bloqueo' },
            { fecha: '2026-12-26T00:00:00', tipo: 'extra', inicio: '10:00', fin: '12:00', motivo: 'Guardia' },
            { fecha: '2026-12-27', tipo: 'extra' },
            { tipo: 'bloqueo' },
          ],
        },
      })
    ).resolves.toBe('nueva')

    expect(repo.replaceDisponibilidadByClinica).toHaveBeenCalledWith({
      idClinica: 11,
      rangos: [
        { diaSemana: 1, horaInicio: '09:00:00', horaFin: '13:00:00', duracionTurno: 40 },
        { diaSemana: 2, horaInicio: '09:00:00', horaFin: '13:00:00', duracionTurno: 40 },
        { diaSemana: 6, horaInicio: '10:00:00', horaFin: '12:00:00', duracionTurno: 30 },
      ],
      excepciones: [
        { fecha: '2026-12-25', horaInicio: null, horaFin: null, tipo: 'bloqueo', motivo: null },
        { fecha: '2026-12-26', horaInicio: '10:00:00', horaFin: '12:00:00', tipo: 'extra', motivo: 'Guardia' },
      ],
    })
  })
})

describe('getDisponibilidadCompartida', () => {
  it('exige clínica y fecha', async () => {
    await expect(service.getDisponibilidadCompartida({ idClinica: 11 })).rejects.toMatchObject({ status: 400 })
  })

  it('sin franjas devuelve una lista vacía', async () => {
    await expect(service.getDisponibilidadCompartida({ idClinica: 11, fecha: LUNES })).resolves.toEqual({ fecha: LUNES, dia_semana: 1, duracion_minutos: 30, slots: [] })
  })

  it('cruza la ocupación de todos los médicos y los bloqueos del consultorio', async () => {
    repo.findDisponibilidadByClinicaDia.mockResolvedValue([{ id_disponibilidad: 2, hora_inicio: '09:00', hora_fin: '10:30', duracion_turno: 30 }])
    repo.findExcepcionesByClinicaFecha.mockImplementation(async ({ tipo }) =>
      tipo === 'bloqueo' ? [{ hora_inicio: '10:00', hora_fin: '10:30' }] : [{ hora_inicio: '17:00', hora_fin: '17:30' }]
    )
    turnosRepo.findTurnosTomadosPorClinica.mockResolvedValue([{ hora: '09:30', hora_fin: null }])

    const { slots } = await service.getDisponibilidadCompartida({ idClinica: '11', fecha: LUNES })

    expect(slots).toEqual([
      { hora: '09:00:00', id_disponibilidad: 2, bloqueado: false, excede_horario: false, libre: true },
      { hora: '09:30:00', id_disponibilidad: 2, bloqueado: false, excede_horario: false, libre: false },
      { hora: '10:00:00', id_disponibilidad: 2, bloqueado: true, excede_horario: false, libre: false },
      { hora: '17:00:00', id_disponibilidad: null, bloqueado: false, excede_horario: false, libre: true },
    ])
    expect(turnosRepo.findTurnosTomadosPorClinica).toHaveBeenCalledWith({ idClinica: 11, fecha: LUNES })
  })

  it('una duración pedida más larga choca con el turno siguiente', async () => {
    repo.findDisponibilidadByClinicaDia.mockResolvedValue([{ id_disponibilidad: 2, hora_inicio: '09:00', hora_fin: '10:00', duracion_turno: 0 }])
    turnosRepo.findTurnosTomadosPorClinica.mockResolvedValue([{ hora: '09:30', hora_fin: '10:00' }])

    const { slots } = await service.getDisponibilidadCompartida({ idClinica: 11, fecha: LUNES, duracionMinutos: '60' })
    expect(slots[0]).toMatchObject({ hora: '09:00:00', libre: false })
  })
})

describe('crearSolicitud', () => {
  const args = { idClinica: '11', mensaje: 'Hola', ...medico }

  beforeEach(() => {
    repo.findClinicaById.mockResolvedValue({ id_clinica: 11, activo: 1, compartido: 1, nombre: 'Sala' })
    repo.isMedicoVinculado.mockResolvedValue(false)
    repo.findSolicitudActiva.mockResolvedValue(null)
    repo.createSolicitud.mockResolvedValue(77)
    repo.findOwnerEmailByClinica.mockResolvedValue({ email: 'dueno@x.com' })
  })

  it('solo la hace un médico', async () => {
    await expect(service.crearSolicitud({ ...args, ...propietario })).rejects.toMatchObject({ status: 403 })
  })

  it.each([
    ['inexistente', null, 404],
    ['inactivo', { id_clinica: 11, activo: 0, compartido: 1 }, 404],
    ['no publicado', { id_clinica: 11, activo: 1, compartido: 0 }, 400],
  ])('rechaza un consultorio %s', async (_caso, clinica, status) => {
    repo.findClinicaById.mockResolvedValue(clinica)
    await expect(service.crearSolicitud(args)).rejects.toMatchObject({ status })
  })

  it('rechaza si ya está vinculado o con solicitud pendiente', async () => {
    repo.isMedicoVinculado.mockResolvedValueOnce(true)
    await expect(service.crearSolicitud(args)).rejects.toMatchObject({ status: 409, message: 'Ya estás vinculado a ese consultorio' })

    repo.findSolicitudActiva.mockResolvedValueOnce({ id_solicitud: 1 })
    await expect(service.crearSolicitud(args)).rejects.toMatchObject({ status: 409 })
  })

  it('crea la solicitud y avisa al dueño', async () => {
    await expect(service.crearSolicitud(args)).resolves.toEqual({ id_solicitud: 77, estado: 'pendiente' })
    expect(repo.createSolicitud).toHaveBeenCalledWith({ idClinica: 11, idMedico: 3, mensaje: 'Hola' })
    expect(mailer.sendSolicitudConsultorioEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'dueno@x.com', mensaje: 'Hola' }))
  })

  it('no avisa si el dueño no tiene email, y un fallo del mail no rompe la solicitud', async () => {
    repo.findOwnerEmailByClinica.mockResolvedValueOnce(null)
    await service.crearSolicitud(args)
    expect(mailer.sendSolicitudConsultorioEmail).not.toHaveBeenCalled()

    mailer.sendSolicitudConsultorioEmail.mockRejectedValueOnce(new Error('caído'))
    await expect(service.crearSolicitud(args)).resolves.toMatchObject({ estado: 'pendiente' })
  })
})

describe('resolverSolicitud', () => {
  const solicitud = {
    id_solicitud: 9, id_clinica: 11, id_medico: 3, estado: 'pendiente',
    medico_email: 'doc@x.com', medico_nombre: 'Ana', medico_apellido: 'Paz', clinica_nombre: 'Sala',
  }

  beforeEach(() => {
    repo.findSolicitudById.mockResolvedValue(solicitud)
  })

  it('responde 404 o 409 si no se puede resolver', async () => {
    repo.findSolicitudById.mockResolvedValueOnce(null)
    await expect(service.resolverSolicitud({ idSolicitud: 9, aprobar: true, ...propietario })).rejects.toMatchObject({ status: 404 })

    repo.findSolicitudById.mockResolvedValueOnce({ ...solicitud, estado: 'aprobada' })
    await expect(service.resolverSolicitud({ idSolicitud: 9, aprobar: true, ...propietario })).rejects.toMatchObject({ status: 409 })
  })

  it('solo la resuelve el dueño', async () => {
    repo.isClinicaOwnedByPropietario.mockResolvedValue(false)
    await expect(service.resolverSolicitud({ idSolicitud: 9, aprobar: true, ...propietario })).rejects.toMatchObject({ status: 403 })
  })

  it('aprueba y avisa al médico', async () => {
    await expect(service.resolverSolicitud({ idSolicitud: '9', aprobar: true, ...propietario })).resolves.toEqual({ id_solicitud: 9, estado: 'aprobada' })
    expect(repo.aprobarSolicitud).toHaveBeenCalledWith({ idSolicitud: 9, idClinica: 11, idMedico: 3 })
    expect(mailer.sendSolicitudResueltaEmail).toHaveBeenCalledWith(expect.objectContaining({ aprobada: true, motivo: null }))
  })

  it('rechaza con motivo y avisa al médico', async () => {
    await expect(
      service.resolverSolicitud({ idSolicitud: 9, aprobar: false, motivo: 'Sin lugar', ...propietario })
    ).resolves.toEqual({ id_solicitud: 9, estado: 'rechazada' })
    expect(repo.rechazarSolicitud).toHaveBeenCalledWith({ idSolicitud: 9, motivo: 'Sin lugar' })
    expect(mailer.sendSolicitudResueltaEmail).toHaveBeenCalledWith(expect.objectContaining({ aprobada: false, motivo: 'Sin lugar' }))
  })

  it('un fallo del mail no rompe la resolución', async () => {
    mailer.sendSolicitudResueltaEmail.mockRejectedValue(new Error('caído'))
    await expect(service.resolverSolicitud({ idSolicitud: 9, aprobar: true, ...propietario })).resolves.toMatchObject({ estado: 'aprobada' })
  })

  it('no manda mail si el médico no tiene email', async () => {
    repo.findSolicitudById.mockResolvedValue({ ...solicitud, medico_email: null })
    await service.resolverSolicitud({ idSolicitud: 9, aprobar: true, ...propietario })
    expect(mailer.sendSolicitudResueltaEmail).not.toHaveBeenCalled()
  })
})

describe('reporteUso', () => {
  it('exige rango de fechas', async () => {
    await expect(service.reporteUso({ idClinica: 11, desde: '2026-10-01', ...propietario })).rejects.toMatchObject({ status: 400 })
  })

  it('suma las horas de todos los médicos', async () => {
    turnosRepo.reporteUsoPorClinica.mockResolvedValue([{ id_medico: 1, horas: '2.5' }, { id_medico: 2, horas: 1 }, { id_medico: 3, horas: null }])
    await expect(
      service.reporteUso({ idClinica: '11', desde: '2026-10-01', hasta: '2026-10-31', ...propietario })
    ).resolves.toMatchObject({ total_horas: 3.5, desde: '2026-10-01', hasta: '2026-10-31' })
  })
})

describe('adicional de consultorios', () => {
  it('getEstadoAdicional informa si el plan lo habilita y cuántos quedan', async () => {
    repo.contarPublicadosByMedico.mockResolvedValue(1)
    await expect(service.getEstadoAdicional(medico)).resolves.toMatchObject({
      plan_habilita: true,
      estado: 'activo',
      monto_mensual: 20000,
      max_consultorios: 2,
      publicados: 1,
      puede_publicar: true,
    })
  })

  it('getEstadoAdicional sin adicional ni plan habilitado', async () => {
    membresias.assertMedicoFeatureByMedicoId.mockRejectedValue(new HttpError(403, 'no'))
    repo.findAdicionalByMedico.mockResolvedValue(null)

    await expect(service.getEstadoAdicional(medico)).resolves.toMatchObject({
      plan_habilita: false,
      estado: null,
      monto_mensual: 20000,
      max_consultorios: 2,
      puede_publicar: false,
      solicitado_en: null,
      activado_en: null,
    })
  })

  it('solicitarAdicional exige plan que lo permita', async () => {
    membresias.assertMedicoFeatureByMedicoId.mockRejectedValue(new HttpError(403, 'Tu plan actual no permite'))
    await expect(service.solicitarAdicional(medico)).rejects.toMatchObject({ status: 403 })
  })

  it('solicitarAdicional rechaza si ya está activo', async () => {
    await expect(service.solicitarAdicional(medico)).rejects.toMatchObject({ status: 409 })
  })

  it('solicitarAdicional lo activa en el acto', async () => {
    repo.findAdicionalByMedico.mockResolvedValue({ estado: 'cancelado' })
    repo.createAdicionalActivo.mockResolvedValue(15)

    await expect(service.solicitarAdicional(medico)).resolves.toEqual({ id_adicional: 15, estado: 'activo', monto_mensual: 20000, max_consultorios: 2 })
    expect(repo.createAdicionalActivo).toHaveBeenCalledWith({ idMedico: 3, montoMensual: 20000, maxConsultorios: 2 })
  })

  it('cancelarAdicional responde 404 si no hay adicional', async () => {
    repo.findAdicionalByMedico.mockResolvedValue(null)
    await expect(service.cancelarAdicional(medico)).rejects.toMatchObject({ status: 404 })
  })

  it('cancelarAdicional despublica los consultorios propios', async () => {
    repo.listClinicasCompartidasByMedicoDueno.mockResolvedValue([{ id_clinica: 21 }, { id_clinica: 22 }])

    await expect(service.cancelarAdicional(medico)).resolves.toEqual({ estado: 'cancelado', despublicados: 2 })
    expect(repo.marcarClinicaCompartida).toHaveBeenCalledWith({ idClinica: 21, compartido: false })
    expect(repo.marcarClinicaCompartida).toHaveBeenCalledWith({ idClinica: 22, compartido: false })
    expect(repo.cancelarAdicional).toHaveBeenCalledWith(1)
  })
})

describe('getResumenDisponibilidadCompartida', () => {
  it('calcula cada día con la ocupación de todos los médicos en 2 consultas', async () => {
    repo.listDisponibilidadByClinica.mockResolvedValue({
      rangos: [{ id_disponibilidad: 2, dia_semana: 1, hora_inicio: '09:00', hora_fin: '10:00', duracion_turno: 60 }],
      excepciones: [
        { fecha: '2026-10-26', tipo: 'bloqueo', hora_inicio: null, hora_fin: null },
        { fecha: '2026-10-24', tipo: 'extra', hora_inicio: '10:00', hora_fin: '11:00' },
      ],
    })
    turnosRepo.findTurnosTomadosPorClinicaRango.mockResolvedValue([{ fecha: '2026-10-19', hora: '09:00', hora_fin: '10:00' }])

    const fechas = ['2026-10-19', '2026-10-24', '2026-10-26', '2026-10-27']
    await expect(
      service.getResumenDisponibilidadCompartida({ idClinica: '11', desde: '2026-10-19', hasta: '2026-10-27', fechas })
    ).resolves.toEqual({
      desde: '2026-10-19',
      hasta: '2026-10-27',
      dias: [
        { fecha: '2026-10-19', estado: 'sin-horarios' },
        { fecha: '2026-10-24', estado: 'disponible' },
        { fecha: '2026-10-26', estado: 'bloqueada' },
        { fecha: '2026-10-27', estado: 'sin-horarios' },
      ],
    })
    expect(turnosRepo.findTurnosTomadosPorClinicaRango).toHaveBeenCalledWith({ idClinica: 11, desde: '2026-10-19', hasta: '2026-10-27' })
  })
})
