import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/medicos.api', () => ({
  medicosApi: {
    listMyClinicas: vi.fn(),
    listClinicasByMedico: vi.fn(),
    listMyBloqueos: vi.fn(),
    getMyTurnosConfig: vi.fn(),
    getTurnosConfigByMedico: vi.fn(),
    saveMyTurnosConfig: vi.fn(),
    createMyBloqueo: vi.fn(),
    updateMyBloqueo: vi.fn(),
    deleteMyBloqueo: vi.fn(),
    createMyClinica: vi.fn(),
    updateMyClinica: vi.fn(),
    deleteMyClinica: vi.fn(),
    getMyTyc: vi.fn(),
    saveMyTyc: vi.fn(),
    getMyMailConfig: vi.fn(),
    saveMyMailConfig: vi.fn(),
    getMyDisponibilidad: vi.fn(),
    listMyRecetasSolicitudes: vi.fn(),
    updateMyRecetaSolicitudEstado: vi.fn(),
  },
}))
vi.mock('../../src/services/pacientes.api', () => ({
  pacientesApi: {
    list: vi.fn(),
    crear: vi.fn(),
    buscarPorDni: vi.fn(),
    actualizar: vi.fn(),
    getHistorial: vi.fn(),
    listarObrasSociales: vi.fn(),
  },
}))
vi.mock('../../src/services/turnos.api', () => ({
  turnosApi: { listarPorMedico: vi.fn(), listarHistorialPorMedico: vi.fn(), cambiarEstado: vi.fn(), crear: vi.fn() },
}))
vi.mock('../../src/services/asistentes.api', () => ({
  asistentesApi: { listByMedico: vi.fn(), patchPermisos: vi.fn() },
}))
vi.mock('../../src/services/consultorios.api', () => ({
  consultoriosApi: {
    listMios: vi.fn(),
    getAdicional: vi.fn(),
    solicitarAdicional: vi.fn(),
    cancelarAdicional: vi.fn(),
    publicar: vi.fn(),
    listPublicos: vi.fn(),
    listMisSolicitudes: vi.fn(),
    solicitar: vi.fn(),
  },
}))
vi.mock('../../src/services/auth.api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), registerAsistente: vi.fn() },
}))

import { medicosApi } from '../../src/services/medicos.api'
import { pacientesApi } from '../../src/services/pacientes.api'
import { turnosApi } from '../../src/services/turnos.api'
import { asistentesApi } from '../../src/services/asistentes.api'
import { consultoriosApi } from '../../src/services/consultorios.api'
import { authApi } from '../../src/services/auth.api'
import { ApiError } from '../../src/services/apiClient'
import AltaAsistenteForm from '../../src/components/forms/AltaAsistenteForm'
import ConsultoriosPublicosPage from '../../src/pages/medico/ConsultoriosPublicosPage'
import PanelMedicoPage from '../../src/pages/medico/PanelMedicoPage'
import AgendaTab from '../../src/pages/medico/tabs/AgendaTab'
import ConfiguracionTab from '../../src/pages/medico/tabs/ConfiguracionTab'
import HistorialTab from '../../src/pages/medico/tabs/HistorialTab'
import PacientesTab from '../../src/pages/medico/tabs/PacientesTab'
import RecetasTab from '../../src/pages/medico/tabs/RecetasTab'
import { render } from '@testing-library/react'
import { renderWithProviders, usuarios } from '../helpers/render'

// Lunes 19/10/2026: el consultorio atiende los lunes de 9 a 11 en turnos de 30 min.
const HOY = new Date(2026, 9, 19, 8, 0, 0)
const consultorio = {
  id: 8,
  nombre: 'Centro',
  direccion: 'Calle 1',
  ciudad: 'La Plata',
  tipo: 'presencial',
  rangos: [{ frecuencia: 'semanal', dias: ['Lun'], inicio: '09:00', fin: '11:00' }],
  rangos_unicos: [],
}
const turnoAna = {
  id_turno: 900, id_clinica: 8, fecha_iso: '2026-10-19', hora: '09:00', hora_fin: '10:00',
  estado: 'pendiente', paciente_nombre: 'Ana', paciente_apellido: 'Paz', motivo: 'Primera vez',
}
const pacienteAna = { id_paciente: 7, nombre: 'Ana', apellido: 'Paz', dni: '30111222', telefono: '+549221', obra_social: 'OSDE' }

const renderMedico = (ui) => renderWithProviders(ui, { usuario: usuarios.medico, route: '/medico' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(HOY)
  medicosApi.listMyClinicas.mockResolvedValue([consultorio])
  medicosApi.listMyBloqueos.mockResolvedValue([])
  medicosApi.getMyTurnosConfig.mockResolvedValue({ duracion_turno_estandar: 30, tipos_turno: [] })
  turnosApi.listarPorMedico.mockResolvedValue([])
  pacientesApi.list.mockResolvedValue([pacienteAna])
  pacientesApi.listarObrasSociales.mockResolvedValue([{ id_obra_social: 2, nombre: 'OSDE' }])
})

afterEach(() => {
  vi.useRealTimers()
})

const slot = (hora) => screen.getByText(hora, { selector: '.agenda-slot-hora' }).closest('.agenda-slot')

describe('AgendaTab', () => {
  it('arma la grilla del día con turnos, continuaciones, bloqueos y libres', async () => {
    turnosApi.listarPorMedico.mockResolvedValue([turnoAna])
    medicosApi.listMyBloqueos.mockResolvedValue([{ id_clinica: 8, fecha: '2026-10-19', hora_inicio: '10:30', hora_fin: '11:00' }])
    const onResumenDia = vi.fn()
    renderMedico(<AgendaTab onResumenDia={onResumenDia} />)

    expect(await screen.findByText('Ana Paz')).toBeInTheDocument()
    expect(within(slot('09:30')).getByText('Continúa: Ana Paz')).toBeInTheDocument()
    expect(within(slot('10:00')).getByText('Libre')).toBeInTheDocument()
    await waitFor(() => expect(within(slot('10:30')).getByText('Bloqueado')).toBeInTheDocument())
    expect(screen.getByText('1 libres')).toBeInTheDocument()
    expect(onResumenDia).toHaveBeenLastCalledWith(expect.objectContaining({ turnos: 1, libres: 1, fechaIso: '2026-10-19' }))
    expect(turnosApi.listarPorMedico).toHaveBeenCalledWith({ desde: '2026-10-19', hasta: '2026-10-19' })
  })

  it('un turno en otro consultorio ocupa el horario en todos', async () => {
    medicosApi.listMyClinicas.mockResolvedValue([consultorio, { ...consultorio, id: 9, nombre: 'Sur' }])
    turnosApi.listarPorMedico.mockResolvedValue([{ ...turnoAna, clinica_nombre: 'Centro' }])
    renderMedico(<AgendaTab />)
    expect(await screen.findAllByText('Ocupado en Centro')).toHaveLength(2)
  })

  it('marca asistencia de un turno', async () => {
    turnosApi.listarPorMedico.mockResolvedValue([turnoAna])
    turnosApi.cambiarEstado.mockResolvedValue({})
    renderMedico(<AgendaTab />)

    await userEvent.click(await screen.findByRole('button', { name: 'Asistio' }))

    expect(turnosApi.cambiarEstado).toHaveBeenCalledWith(900, 'completado')
    expect(await screen.findByText('Estado actualizado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Asistio' })).toBeDisabled()
  })

  it('agenda un turno buscando al paciente', async () => {
    turnosApi.crear.mockResolvedValue({})
    renderMedico(<AgendaTab />)
    await screen.findByText('Centro')

    await userEvent.click(within(slot('10:00')).getByRole('button', { name: '+ Agendar' }))
    await userEvent.type(screen.getByPlaceholderText('Buscar por nombre, apellido o DNI...'), '3011')
    await userEvent.click(await screen.findByRole('button', { name: /Paz Ana/ }))
    expect(screen.getByText('Paz Ana')).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Motivo (opcional)'), 'Control')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(turnosApi.crear).toHaveBeenCalledWith({
      id_medico: undefined, id_paciente: 7, id_clinica: 8, fecha: '2026-10-19', hora: '10:00:00',
      duracion_minutos: 30, id_tipo_turno: null, motivo_consulta: 'Control',
    })
    expect(await screen.findByText('Turno agendado.')).toBeInTheDocument()
    expect(turnosApi.listarPorMedico).toHaveBeenCalledTimes(2)
  })

  it('la duración del tipo de turno manda sobre la del slot', async () => {
    medicosApi.getMyTurnosConfig.mockResolvedValue({ duracion_turno_estandar: 30, tipos_turno: [{ id_tipo_turno: 3, nombre: 'Primera vez', duracion_minutos: 60 }] })
    turnosApi.crear.mockResolvedValue({})
    renderMedico(<AgendaTab />)
    await screen.findByText('Centro')

    await userEvent.click(within(slot('09:00')).getByRole('button', { name: '+ Agendar' }))
    await userEvent.type(screen.getByPlaceholderText('Buscar por nombre, apellido o DNI...'), 'ana')
    await userEvent.click(await screen.findByRole('button', { name: /Paz Ana/ }))
    await userEvent.selectOptions(screen.getByRole('combobox'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(turnosApi.crear).toHaveBeenCalledWith(expect.objectContaining({ duracion_minutos: 60, id_tipo_turno: 3, motivo_consulta: 'Primera vez' }))
  })

  it('no ofrece tipos de turno que terminan después del cierre', async () => {
    // Atiende de 9 a 11: a las 10:30 entra un turno de 30 minutos pero no uno de 60.
    medicosApi.getMyTurnosConfig.mockResolvedValue({
      duracion_turno_estandar: 30,
      tipos_turno: [
        { id_tipo_turno: 1, nombre: 'Control', duracion_minutos: 30 },
        { id_tipo_turno: 3, nombre: 'Primera vez', duracion_minutos: 60 },
      ],
    })
    renderMedico(<AgendaTab />)
    await screen.findByText('Centro')

    await userEvent.click(within(slot('10:30')).getByRole('button', { name: '+ Agendar' }))
    expect(screen.getByRole('option', { name: 'Control · 30 min' })).toBeEnabled()
    expect(screen.getByRole('option', { name: 'Primera vez · 60 min (no entra antes del cierre)' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(within(slot('10:00')).getByRole('button', { name: '+ Agendar' }))
    expect(screen.getByRole('option', { name: 'Primera vez · 60 min' })).toBeEnabled()
  })

  it('crea un paciente nuevo desde la agenda y lo deja elegido', async () => {
    pacientesApi.crear.mockResolvedValue({ id_paciente: 70, nombre: 'Leo', apellido: 'Sol', dni: '40111222' })
    renderMedico(<AgendaTab />)
    await screen.findByText('Centro')

    await userEvent.click(within(slot('10:00')).getByRole('button', { name: '+ Agendar' }))
    await userEvent.click(screen.getByRole('button', { name: /Nuevo paciente/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Crear y agregar al turno' }))
    expect(screen.getByText('DNI, nombre y apellido son obligatorios.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('DNI'), '40111222')
    await userEvent.type(screen.getByLabelText('Nombre'), 'Leo')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Sol')
    await userEvent.click(screen.getByRole('button', { name: 'Crear y agregar al turno' }))

    expect(pacientesApi.crear).toHaveBeenCalledWith({ dni: '40111222', nombre: 'Leo', apellido: 'Sol', email: null, telefono: null, fecha_nac: null })
    expect(await screen.findByText('Sol Leo se creó y quedó seleccionado.')).toBeInTheDocument()
  })

  it('bloquea un horario libre', async () => {
    medicosApi.createMyBloqueo.mockResolvedValue({})
    renderMedico(<AgendaTab />)
    await screen.findByText('Centro')

    await userEvent.click(within(slot('10:00')).getByRole('button', { name: 'Bloquear' }))

    expect(medicosApi.createMyBloqueo).toHaveBeenCalledWith({
      id_clinica: 8, fecha_desde: '2026-10-19', fecha_hasta: '2026-10-19', hora_inicio: '10:00', hora_fin: '10:30', motivo: 'Bloqueado desde Agenda',
    })
    expect(await within(slot('10:00')).findByText('Bloqueado')).toBeInTheDocument()
  })

  it('navega entre días', async () => {
    renderMedico(<AgendaTab />)
    await screen.findByText('Centro')
    await userEvent.click(screen.getByRole('button', { name: '19/10/2026' }).nextElementSibling)
    await waitFor(() => expect(turnosApi.listarPorMedico).toHaveBeenLastCalledWith({ desde: '2026-10-20', hasta: '2026-10-20' }))
    expect(screen.getByText('Sin horarios configurados para este día.')).toBeInTheDocument()
  })

  it('en modo lectura (asistente) no permite agendar ni bloquear', async () => {
    medicosApi.listClinicasByMedico.mockResolvedValue([consultorio])
    medicosApi.getTurnosConfigByMedico.mockResolvedValue({ duracion_turno_estandar: 30 })
    renderWithProviders(<AgendaTab doctorId={3} readOnly />, { usuario: usuarios.asistente })

    expect(await screen.findAllByText('Vacio')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: '+ Agendar' })).not.toBeInTheDocument()
    expect(medicosApi.listClinicasByMedico).toHaveBeenCalledWith(3)
    expect(turnosApi.listarPorMedico).toHaveBeenCalledWith({ idMedico: 3, desde: '2026-10-19', hasta: '2026-10-19' })
    expect(medicosApi.listMyBloqueos).not.toHaveBeenCalled()
  })

  it('sin consultorios avisa que hay que cargarlos', async () => {
    medicosApi.listMyClinicas.mockResolvedValue([])
    renderMedico(<AgendaTab />)
    expect(await screen.findByText(/No hay consultorios cargados/)).toBeInTheDocument()
  })
})

describe('RecetasTab', () => {
  it('lista solicitudes y marca una como enviada', async () => {
    medicosApi.listMyRecetasSolicitudes.mockResolvedValue([
      { id_solicitud: 1, paciente_nombre: 'Ana', paciente_apellido: 'Paz', tipo: 'urgente', estado: 'enviada', items: [{ medicamento: 'Ibuprofeno', dosis: '400mg' }] },
    ])
    medicosApi.updateMyRecetaSolicitudEstado.mockResolvedValue({})
    renderMedico(<RecetasTab />)

    expect(await screen.findByText('Ana Paz')).toBeInTheDocument()
    expect(screen.getByText('Urgente')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox'))

    expect(medicosApi.updateMyRecetaSolicitudEstado).toHaveBeenCalledWith(1, 'resuelta')
    expect(await screen.findByText('Receta enviada')).toBeInTheDocument()
  })

  it('muestra estado vacío y errores', async () => {
    medicosApi.listMyRecetasSolicitudes.mockResolvedValueOnce([])
    const { unmount } = renderMedico(<RecetasTab />)
    expect(await screen.findByText('Todavia no hay solicitudes de recetas.')).toBeInTheDocument()
    unmount()

    medicosApi.listMyRecetasSolicitudes.mockRejectedValueOnce(new Error('Membresía vencida'))
    renderMedico(<RecetasTab />)
    expect(await screen.findByText('Membresía vencida')).toBeInTheDocument()
  })
})

describe('HistorialTab', () => {
  it('lista los eventos del mes y filtra por paciente', async () => {
    turnosApi.listarHistorialPorMedico.mockResolvedValue([
      { id_historial: 1, fecha: '19/10/2026', hora: '09:00', estado: 'completado', paciente_nombre: 'Ana', paciente_apellido: 'Paz', clinica_nombre: 'Centro', modificado_por: 4, actor_rol: 'medico', actor_username: 'doc' },
      { id_historial: 2, fecha: '19/10/2026', hora: '10:00', estado: 'cancelado_paciente', paciente_nombre: 'Leo', paciente_apellido: 'Sol', id_clinica: 9 },
    ])
    renderMedico(<HistorialTab />)

    expect(await screen.findByText('Mostrando 2 eventos')).toBeInTheDocument()
    expect(screen.getByText('Paciente asistio')).toBeInTheDocument()
    expect(screen.getByText('medico: doc')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()
    expect(screen.getByText('Consultorio 9')).toBeInTheDocument()
    expect(turnosApi.listarHistorialPorMedico).toHaveBeenCalledWith({ desde: '2026-10-01', hasta: '2026-10-31' })

    await userEvent.type(screen.getByPlaceholderText('Buscar por paciente...'), 'leo')
    expect(screen.getByText('Mostrando 1 eventos')).toBeInTheDocument()
  })
})

describe('PacientesTab', () => {
  it('lista y filtra pacientes', async () => {
    pacientesApi.list.mockResolvedValue([pacienteAna, { ...pacienteAna, id_paciente: 8, nombre: 'Leo', apellido: 'Sol', dni: '40111222' }])
    renderMedico(<PacientesTab />)
    expect(await screen.findByText('Paz Ana')).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Buscar por nombre o DNI...'), '4011')
    expect(screen.queryByText('Paz Ana')).not.toBeInTheDocument()
    expect(screen.getByText('Sol Leo')).toBeInTheDocument()
  })

  it('al dar de alta un DNI existente autocompleta sus datos', async () => {
    pacientesApi.buscarPorDni.mockResolvedValue({ nombre: 'Ana', apellido: 'Paz', email: 'paciente.30111222@sin-email.local', id_obra_social: 2 })
    pacientesApi.crear.mockResolvedValue({ ...pacienteAna, ya_existia: true })
    renderMedico(<PacientesTab />)
    await screen.findByText('Paz Ana')

    await userEvent.click(screen.getByRole('button', { name: /Nuevo paciente/ }))
    await userEvent.type(screen.getByLabelText('DNI'), '30111222')
    await userEvent.tab()

    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue('Ana'))
    expect(screen.getByLabelText('Email (opcional)')).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar paciente' }))

    expect(pacientesApi.crear).toHaveBeenCalledWith(expect.objectContaining({ dni: '30111222', nombre: 'Ana', id_obra_social: '2', obra_social: null }))
    expect(await screen.findByText(/ya estaba registrado/)).toBeInTheDocument()
  })

  it('permite cargar una obra social nueva', async () => {
    pacientesApi.buscarPorDni.mockRejectedValue(new ApiError(404, 'no'))
    pacientesApi.crear.mockResolvedValue({ id_paciente: 9, nombre: 'Leo', apellido: 'Sol' })
    renderMedico(<PacientesTab />)
    await screen.findByText('Paz Ana')

    await userEvent.click(screen.getByRole('button', { name: /Nuevo paciente/ }))
    await userEvent.type(screen.getByLabelText('DNI'), '40111222')
    await userEvent.type(screen.getByLabelText('Nombre'), 'Leo')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Sol')
    await userEvent.selectOptions(screen.getByLabelText('Obra social'), '__otra')
    await userEvent.type(screen.getByLabelText('Nombre de la obra social'), 'Swiss Medical')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar paciente' }))

    expect(pacientesApi.crear).toHaveBeenCalledWith(expect.objectContaining({ id_obra_social: null, obra_social: 'Swiss Medical' }))
    expect(await screen.findByText('Sol Leo se agregó a tu listado.')).toBeInTheDocument()
    await waitFor(() => expect(pacientesApi.listarObrasSociales).toHaveBeenCalledTimes(2))
  })

  it('agenda un turno eligiendo un horario libre', async () => {
    medicosApi.getMyDisponibilidad.mockResolvedValue({ slots: [{ hora: '10:00:00', libre: true }, { hora: '10:30:00', libre: false }] })
    turnosApi.crear.mockResolvedValue({})
    renderMedico(<PacientesTab />)
    await userEvent.click(await screen.findByRole('button', { name: /Agendar/ }))

    expect(screen.getByLabelText('Consultorio')).toHaveValue('8')
    await waitFor(() => expect(screen.getByLabelText('Horario')).toBeEnabled())
    expect(within(screen.getByLabelText('Horario')).getAllByRole('option')).toHaveLength(2)
    await userEvent.selectOptions(screen.getByLabelText('Horario'), '10:00:00')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }))

    expect(medicosApi.getMyDisponibilidad).toHaveBeenCalledWith({ idClinica: '8', fecha: '2026-10-19' })
    expect(turnosApi.crear).toHaveBeenCalledWith({ id_paciente: 7, id_clinica: 8, fecha: '2026-10-19', hora: '10:00:00', duracion_minutos: 30, motivo_consulta: null })
    expect(await screen.findByText('Turno agendado para Paz Ana.')).toBeInTheDocument()
  })

  it('edita los datos de contacto', async () => {
    pacientesApi.actualizar.mockResolvedValue({})
    renderMedico(<PacientesTab />)
    await userEvent.click(await screen.findByRole('button', { name: /Editar/ }))

    await userEvent.clear(screen.getByLabelText('Teléfono'))
    await userEvent.type(screen.getByLabelText('Teléfono'), '2214563895')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(pacientesApi.actualizar).toHaveBeenCalledWith(7, { telefono: '2214563895', fecha_nac: null, id_obra_social: null, nro_obra_social: null })
    expect(await screen.findByText('Paz Ana se actualizó correctamente.')).toBeInTheDocument()
  })

  it('muestra el historial con el médico', async () => {
    pacientesApi.getHistorial.mockResolvedValue({
      turnos: [{ id_turno: 1, fecha: '19/10/2026', hora: '09:00', estado: 'completado' }],
      recetas: [],
      mensajes: [],
    })
    renderMedico(<PacientesTab />)
    await userEvent.click(await screen.findByRole('button', { name: /Historial/ }))

    expect(await screen.findByText('Historial de Paz Ana')).toBeInTheDocument()
    expect(screen.getByText(/Paciente asistió/)).toBeInTheDocument()
    expect(screen.getByText('Sin recetas solicitadas.')).toBeInTheDocument()
    expect(screen.getByText('Sin mensajes.')).toBeInTheDocument()
  })
})

describe('ConfiguracionTab', () => {
  beforeEach(() => {
    medicosApi.getMyTyc.mockResolvedValue({ texto: 'Mis términos' })
    medicosApi.getMyMailConfig.mockResolvedValue({ enviar_recetas_mail: true, notif_turno_nuevo: false, notif_cancelacion: true })
    medicosApi.getMyTurnosConfig.mockResolvedValue({ duracion_turno_estandar: 30, tipos_turno: [{ id_tipo_turno: 1, nombre: 'Control', duracion_minutos: 30 }] })
    asistentesApi.listByMedico.mockResolvedValue([{ id_asistente: 4, nombre: 'Lu', apellido: 'Díaz', username: 'lu', agenda: 1, pacientes: 0, bloqueado: 0 }])
    consultoriosApi.listMios.mockResolvedValue([{ id_clinica: 8, compartido: 0 }])
    consultoriosApi.getAdicional.mockResolvedValue({ plan_habilita: true, estado: null, monto_mensual: 20000, max_consultorios: 2 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  const renderConfig = (props = {}) => renderMedico(<ConfiguracionTab permiteTurnos {...props} />)
  // "Centro" aparece en la tarjeta, en el select de bloqueos y en el alta de asistentes.
  const esperarCarga = () => screen.findByText('Centro', { selector: '.config-consultorio-card strong' })
  const filaAsistente = () => screen.getByText('Lu Díaz').closest('.config-asistente-row')

  it('carga la configuración actual', async () => {
    renderConfig()
    expect(await esperarCarga()).toBeInTheDocument()
    expect(screen.getByText('Medio')).toBeInTheDocument()
    expect(screen.getByLabelText('Texto de terminos')).toHaveValue('Mis términos')
    expect(screen.getByDisplayValue('Control')).toBeInTheDocument()
    expect(screen.getByText('Lu Díaz')).toBeInTheDocument()
    // El id de usuario (60) no es el id de médico: se piden los asistentes propios sin indicarlo.
    expect(asistentesApi.listByMedico).toHaveBeenCalledWith()
  })

  it('guarda la configuración de mails', async () => {
    medicosApi.saveMyMailConfig.mockImplementation(async (payload) => payload)
    renderConfig()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    expect(medicosApi.saveMyMailConfig).toHaveBeenCalledWith({ enviar_recetas_mail: true, notif_turno_nuevo: false, notif_cancelacion: true })
    expect(await screen.findByText('Configuracion guardada correctamente.')).toBeInTheDocument()
  })

  it('crea un consultorio recurrente', async () => {
    medicosApi.createMyClinica.mockResolvedValue({})
    renderConfig()
    await esperarCarga()

    await userEvent.click(screen.getByRole('button', { name: /Agregar consultorio/ }))
    await userEvent.type(screen.getByLabelText('Nombre', { selector: '#clinicaNombre' }), ' Sur ')
    await userEvent.type(screen.getByLabelText('Direccion'), 'Calle 2')
    await userEvent.click(screen.getByRole('button', { name: 'V' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar consultorio' }))

    expect(medicosApi.createMyClinica).toHaveBeenCalledWith({
      nombre: 'Sur', tipo: 'presencial', direccion: 'Calle 2',
      rangos: [{ frecuencia: 'semanal', dias: ['Lun', 'Mar', 'Mie', 'Jue'], inicio: '09:00', fin: '17:00', duracion: 30 }],
    })
    expect(await screen.findByText('Consultorio guardado correctamente.')).toBeInTheDocument()
  })

  it('valida el nombre del consultorio', async () => {
    renderConfig()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: /Agregar consultorio/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar consultorio' }))
    expect(screen.getByText('Ingresa nombre de consultorio.')).toBeInTheDocument()
  })

  it('edita y elimina un consultorio', async () => {
    medicosApi.updateMyClinica.mockResolvedValue({})
    medicosApi.deleteMyClinica.mockResolvedValue({})
    renderConfig()
    await esperarCarga()

    await userEvent.click(screen.getAllByRole('button', { name: /Editar/ })[0])
    expect(screen.getByLabelText('Nombre', { selector: '#clinicaNombre' })).toHaveValue('Centro')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar consultorio' }))
    expect(medicosApi.updateMyClinica).toHaveBeenCalledWith(8, expect.objectContaining({ nombre: 'Centro', rangos: [expect.objectContaining({ dias: ['Lun'], inicio: '09:00', fin: '11:00' })] }))

    await userEvent.click(screen.getAllByRole('button', { name: /Eliminar/ })[0])
    expect(medicosApi.deleteMyClinica).toHaveBeenCalledWith(8)
    expect(await screen.findByText('Consultorio eliminado.')).toBeInTheDocument()
  })

  it('activa el adicional y publica un consultorio', async () => {
    consultoriosApi.solicitarAdicional.mockResolvedValue({})
    consultoriosApi.publicar.mockResolvedValue({})
    renderConfig()
    await esperarCarga()

    await userEvent.click(screen.getByRole('button', { name: 'Activar adicional' }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('AR$ 20.000 por mes'))
    expect(await screen.findByText('Adicional activado. Ya podés publicar hasta 2 consultorios.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Publicar para alquiler' }))
    expect(consultoriosApi.publicar).toHaveBeenCalledWith(8, true)
  })

  it('si el plan no habilita el adicional ofrece cambiar de plan', async () => {
    consultoriosApi.getAdicional.mockResolvedValue({ plan_habilita: false })
    renderConfig()
    await esperarCarga()
    expect(screen.getByText(/Tu plan actual no incluye este adicional/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activar adicional' })).not.toBeInTheDocument()
  })

  it('guarda tipos de turno y maneja el conflicto de turnos desalineados', async () => {
    medicosApi.saveMyTurnosConfig
      .mockRejectedValueOnce(new ApiError(409, 'Hay 1 turno(s) agendado(s) que no coinciden', { turnos_afectados: [{ id_turno: 1, fecha: '20/10/2026', hora: '09:15' }] }))
      .mockResolvedValueOnce({ duracion_turno_estandar: 20, tipos_turno: [] })
    const onConfigChange = vi.fn()
    renderConfig({ onConfigChange })
    await esperarCarga()

    await userEvent.selectOptions(screen.getByLabelText('Duracion turno estandar'), '20')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar configuracion' }))
    expect((await screen.findAllByText(/no coinciden/)).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar de todos modos' }))
    expect(medicosApi.saveMyTurnosConfig).toHaveBeenLastCalledWith(expect.objectContaining({ duracion_turno_estandar: 20, confirmar: true }))
    expect(await screen.findByText('Configuración de turnos guardada correctamente.')).toBeInTheDocument()
    expect(onConfigChange).toHaveBeenCalled()
  })

  it('valida los tipos de turno antes de guardar', async () => {
    renderConfig()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: /Agregar tipo/ }))
    const nombres = screen.getAllByPlaceholderText(/Ej: Seguimiento/)
    // Una fila totalmente vacía se descarta; una con nombre y duración 0 es inválida.
    await userEvent.type(nombres[1], 'Extra')
    await userEvent.clear(screen.getAllByRole('spinbutton')[1])
    await userEvent.type(screen.getAllByRole('spinbutton')[1], '0')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar configuracion' }))
    expect(screen.getByText('Cada tipo debe tener nombre y duración válida en minutos.')).toBeInTheDocument()
    expect(medicosApi.saveMyTurnosConfig).not.toHaveBeenCalled()
  })

  it('guarda los términos o restaura los predeterminados', async () => {
    medicosApi.saveMyTyc.mockResolvedValue({})
    renderConfig()
    await esperarCarga()

    await userEvent.click(screen.getByRole('button', { name: 'Usar predeterminados' }))
    expect(screen.getByLabelText('Texto de terminos').value).toContain('Estos terminos y condiciones')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar terminos' }))
    expect(medicosApi.saveMyTyc).toHaveBeenCalledWith(expect.stringContaining('Estos terminos y condiciones'))
    expect(await screen.findByText('Terminos guardados correctamente.')).toBeInTheDocument()
  })

  it('agrega y elimina bloqueos de fechas', async () => {
    medicosApi.listMyBloqueos.mockResolvedValue([{ id_excepcion: 5, id_clinica: 8, fecha: '2026-12-24', motivo: 'Navidad' }])
    medicosApi.createMyBloqueo.mockResolvedValue({})
    medicosApi.deleteMyBloqueo.mockResolvedValue({})
    renderConfig()
    expect(await screen.findByText('2026-12-24 · Navidad')).toBeInTheDocument()

    await userEvent.type(screen.getAllByPlaceholderText('DD/MM/AAAA')[0], '01012027')
    await userEvent.type(screen.getAllByPlaceholderText('DD/MM/AAAA')[1], '15012027')
    await userEvent.type(screen.getByPlaceholderText('Vacaciones, congreso...'), 'Vacaciones')
    await userEvent.click(screen.getByRole('button', { name: /Agregar bloqueo/ }))

    expect(medicosApi.createMyBloqueo).toHaveBeenCalledWith({ id_clinica: 8, fecha_desde: '2027-01-01', fecha_hasta: '2027-01-15', motivo: 'Vacaciones' })
    expect(await screen.findByText('Bloqueo guardado correctamente.')).toBeInTheDocument()

    const bloqueo = screen.getByText('2026-12-24 · Navidad').closest('.surface')
    await userEvent.click(within(bloqueo).getByRole('button', { name: /Eliminar/ }))
    expect(medicosApi.deleteMyBloqueo).toHaveBeenCalledWith(5)
  })

  it('cambia permisos y bloquea asistentes', async () => {
    asistentesApi.patchPermisos.mockResolvedValue({})
    renderConfig()
    await screen.findByText('Lu Díaz')

    await userEvent.click(within(filaAsistente()).getByRole('checkbox', { name: 'Pacientes' }))
    expect(asistentesApi.patchPermisos).toHaveBeenCalledWith(4, { pacientes: true })

    await userEvent.click(within(filaAsistente()).getByRole('button', { name: 'Bloquear' }))
    expect(asistentesApi.patchPermisos).toHaveBeenLastCalledWith(4, { bloqueado: true })
    expect(await screen.findByRole('button', { name: 'Desbloquear' })).toBeInTheDocument()
  })

  it('sin turnos en el plan oculta bloqueos y sin asistentes avisa', async () => {
    renderWithProviders(<ConfiguracionTab permiteTurnos={false} />, {
      usuario: { ...usuarios.medico, membresia: { plan_nombre: 'Inicial', permite_asistentes: false } },
    })
    expect(await screen.findByText('Tu plan actual no incluye gestión de asistentes.')).toBeInTheDocument()
    expect(screen.queryByText('Bloquear fechas / vacaciones')).not.toBeInTheDocument()
    expect(medicosApi.listMyClinicas).not.toHaveBeenCalled()
  })

  it('crea un asistente desde el formulario', async () => {
    authApi.registerAsistente.mockResolvedValue({ id_asistente: 9 })
    renderConfig()
    await screen.findByText('Lu Díaz')

    await userEvent.type(screen.getByLabelText('Nombre', { selector: '#asistenteNombre' }), 'Mía')
    await userEvent.type(screen.getByLabelText('Apellido', { selector: '#asistenteApellido' }), 'Ruiz')
    await userEvent.type(screen.getByLabelText('Email', { selector: '#asistenteEmail' }), 'mia@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña', { selector: '#asistentePassword' }), 'clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Centro' }))
    await userEvent.click(screen.getByRole('button', { name: 'Crear asistente' }))

    // No se manda id_medico: el backend vincula al médico autenticado.
    expect(authApi.registerAsistente).toHaveBeenCalledWith(expect.objectContaining({ email: 'mia@x.com', clinic_ids: [8] }))
    expect(authApi.registerAsistente.mock.calls[0][0]).not.toHaveProperty('id_medico')
  })
})

describe('AltaAsistenteForm', () => {
  it('valida datos, clínicas y llama a onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue({})
    render(<AltaAsistenteForm onCreate={onCreate} allowManualClinicIds />)

    await userEvent.click(screen.getByRole('button', { name: 'Crear asistente' }))
    expect(screen.getByText('Completá nombre y apellido.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nombre'), 'Mía')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ruiz')
    await userEvent.type(screen.getByLabelText('Email'), 'mia@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Crear asistente' }))
    expect(screen.getByText('Ingresá al menos un ID de clínica.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('IDs de clínicas'), '3, x, 5')
    await userEvent.click(screen.getByRole('button', { name: 'Crear asistente' }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Mía', clinic_ids: [3, 5], permisos: expect.objectContaining({ agenda: true }) }))
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue(''))
  })

  it('muestra el error de onCreate', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('Username o email ya existen'))
    render(<AltaAsistenteForm onCreate={onCreate} />)
    await userEvent.type(screen.getByLabelText('Nombre'), 'Mía')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ruiz')
    await userEvent.type(screen.getByLabelText('Email'), 'mia@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Crear asistente' }))
    expect(await screen.findByText('Username o email ya existen')).toBeInTheDocument()
  })
})

describe('PanelMedicoPage', () => {
  beforeEach(() => {
    medicosApi.listMyRecetasSolicitudes.mockResolvedValue([])
  })

  it('muestra KPIs y cambia de pestaña', async () => {
    turnosApi.listarPorMedico.mockResolvedValue([turnoAna])
    renderMedico(<PanelMedicoPage />)

    expect(await screen.findByText('Turnos 19/10/2026')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Turnos 19/10/2026').previousSibling).toHaveTextContent('1'))
    expect(screen.getByText('Tipos configurados').previousSibling).toHaveTextContent('0')

    await userEvent.click(screen.getByRole('button', { name: 'Recetas' }))
    expect(await screen.findByText('Todavia no hay solicitudes de recetas.')).toBeInTheDocument()
  })

  it('sin turnos en el plan oculta agenda e historial', async () => {
    renderWithProviders(<PanelMedicoPage />, { usuario: { ...usuarios.medico, membresia: { permite_turnos: false } } })
    expect(screen.queryByRole('button', { name: 'Agenda' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Historial' })).not.toBeInTheDocument()
    expect(await screen.findByText('Base de pacientes')).toBeInTheDocument()
  })
})

describe('ConsultoriosPublicosPage', () => {
  it('lista consultorios y solicita vincularse', async () => {
    consultoriosApi.listPublicos.mockResolvedValue([
      { id_clinica: 11, nombre: 'Sala 1', direccion: 'Calle 1', ciudad: 'La Plata' },
      { id_clinica: 12, nombre: 'Sala 2', direccion: 'Calle 2' },
    ])
    consultoriosApi.listMisSolicitudes.mockResolvedValue([{ id_clinica: 12, estado: 'pendiente' }])
    consultoriosApi.solicitar.mockResolvedValue({})
    vi.spyOn(window, 'prompt').mockReturnValue('Martes a la tarde')
    renderMedico(<ConsultoriosPublicosPage />)

    expect(await screen.findByText('Sala 1')).toBeInTheDocument()
    expect(screen.getByText('Solicitud pendiente')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar' }))

    expect(consultoriosApi.solicitar).toHaveBeenCalledWith(11, 'Martes a la tarde')
    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument()
  })

  it('sin consultorios publicados lo informa', async () => {
    consultoriosApi.listPublicos.mockResolvedValue([])
    consultoriosApi.listMisSolicitudes.mockResolvedValue([])
    renderMedico(<ConsultoriosPublicosPage />)
    expect(await screen.findByText('Por ahora no hay consultorios publicados.')).toBeInTheDocument()
  })
})
