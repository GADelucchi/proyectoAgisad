import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/medicos.api', () => ({
  medicosApi: {
    list: vi.fn(),
    getById: vi.fn(),
    listClinicasByMedico: vi.fn(),
    getTurnosConfigByMedico: vi.fn(),
    getDisponibilidad: vi.fn(),
    getResumenDisponibilidad: vi.fn(),
  },
}))
vi.mock('../../src/services/pacientes.api', () => ({
  pacientesApi: {
    getTycMedico: vi.fn(),
    aceptarTycMedico: vi.fn(),
    solicitarReceta: vi.fn(),
    enviarMensaje: vi.fn(),
    getMiPerfil: vi.fn(),
    listarObrasSociales: vi.fn(),
    listarMisRecetas: vi.fn(),
    listarMisMensajes: vi.fn(),
    actualizarMiPerfil: vi.fn(),
  },
}))
vi.mock('../../src/services/turnos.api', () => ({
  turnosApi: { listarMisTurnos: vi.fn(), cancelarPropio: vi.fn(), crear: vi.fn() },
}))

import { medicosApi } from '../../src/services/medicos.api'
import { pacientesApi } from '../../src/services/pacientes.api'
import { turnosApi } from '../../src/services/turnos.api'
import { ApiError } from '../../src/services/apiClient'
import AccionesPage from '../../src/pages/paciente/AccionesPage'
import BuscadorMedicoPage from '../../src/pages/paciente/BuscadorMedicoPage'
import CancelarTurnoPage from '../../src/pages/paciente/CancelarTurnoPage'
import MensajesPage from '../../src/pages/paciente/MensajesPage'
import PanelPacientePage from '../../src/pages/paciente/PanelPacientePage'
import SolicitarRecetaPage from '../../src/pages/paciente/SolicitarRecetaPage'
import WizardTurnoPage from '../../src/pages/paciente/turno/WizardTurnoPage'
import { renderWithProviders, usuarios } from '../helpers/render'

const medico = { id: 3, nombre: 'Juan Gómez', especialidad: 'Clínica', matricula: 'MP1', consultorios: [], permiteTurnos: true }
const turno = (overrides = {}) => ({
  id: 900, doctorId: 3, dateIso: '2026-10-20', time: '10:00', status: 'pendiente',
  type: 'Control', clinicName: 'Centro', doctorName: 'Juan Gómez', ...overrides,
})

function renderPaciente(ui, route, path) {
  return renderWithProviders(ui, { usuario: usuarios.paciente, route, path })
}

/** Fechas YYYY-MM-DD entre dos fechas, inclusive. */
function fechasEntre(desde, hasta) {
  const fechas = []
  const cursor = new Date(`${desde}T00:00:00`)
  while (cursor <= new Date(`${hasta}T00:00:00`)) {
    fechas.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return fechas
}

beforeEach(() => {
  medicosApi.list.mockResolvedValue([medico])
  medicosApi.getById.mockResolvedValue(medico)
  turnosApi.listarMisTurnos.mockResolvedValue([])
})

describe('BuscadorMedicoPage', () => {
  it('lista médicos y turnos pendientes', async () => {
    turnosApi.listarMisTurnos.mockResolvedValue([turno(), turno({ id: 901, status: 'cancelado_paciente' })])
    renderPaciente(<BuscadorMedicoPage />, '/paciente')

    expect(await screen.findByText('Juan Gómez')).toBeInTheDocument()
    expect(screen.getByText('Tus turnos pendientes')).toBeInTheDocument()
    expect(screen.getAllByText('Pendiente')).toHaveLength(1)
  })

  it('busca en el backend y filtra por especialidad', async () => {
    medicosApi.list.mockResolvedValue([medico, { ...medico, id: 4, nombre: 'Ana Paz', especialidad: 'Pediatría' }])
    renderPaciente(<BuscadorMedicoPage />, '/paciente')
    await screen.findByText('Ana Paz')

    await userEvent.type(screen.getByPlaceholderText(/Nombre del médico/), 'pedia')

    await waitFor(() => expect(screen.queryByText('Juan Gómez')).not.toBeInTheDocument())
    expect(screen.getByText('Ana Paz')).toBeInTheDocument()
    expect(medicosApi.list).toHaveBeenLastCalledWith('pedia')
  })

  it('al elegir un médico navega a sus acciones', async () => {
    renderPaciente(<BuscadorMedicoPage />, '/paciente')
    await userEvent.click(await screen.findByRole('button', { name: 'Seleccionar' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/paciente/medico/3')
  })

  it('muestra un aviso si la búsqueda falla o no hay resultados', async () => {
    medicosApi.list.mockRejectedValue(new Error('caído'))
    renderPaciente(<BuscadorMedicoPage />, '/paciente')
    expect(await screen.findByText(/No se encontraron médicos/)).toBeInTheDocument()
  })
})

describe('AccionesPage', () => {
  const renderAcciones = () => renderPaciente(<AccionesPage />, '/paciente/medico/3', '/paciente/medico/:medicoId')

  it('muestra las cuatro acciones si el médico tiene turnos', async () => {
    pacientesApi.getTycMedico.mockResolvedValue({ requiere_aceptacion: false })
    renderAcciones()
    expect(await screen.findByRole('heading', { name: 'Juan Gómez' })).toBeInTheDocument()
    for (const accion of ['Solicitar turno', 'Cancelar turno', 'Solicitar receta', 'Enviar mensaje']) {
      expect(screen.getByText(accion)).toBeInTheDocument()
    }
  })

  it('oculta turnos si el plan del médico no los incluye', async () => {
    medicosApi.getById.mockResolvedValue({ ...medico, permiteTurnos: false })
    pacientesApi.getTycMedico.mockResolvedValue(null)
    renderAcciones()
    await screen.findByRole('heading', { name: 'Juan Gómez' })
    expect(screen.queryByText('Solicitar turno')).not.toBeInTheDocument()
    expect(screen.queryByText('Cancelar turno')).not.toBeInTheDocument()
  })

  it('pide aceptar los TyC del médico antes de pedir un turno', async () => {
    pacientesApi.getTycMedico.mockResolvedValue({ requiere_aceptacion: true, aceptado: false, tyc: { id_tyc: 4, texto: 'Mis TyC' } })
    pacientesApi.aceptarTycMedico.mockResolvedValue({})
    renderAcciones()
    await screen.findByRole('heading', { name: 'Juan Gómez' })

    await userEvent.click(screen.getByText('Solicitar turno'))
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByRole('button', { name: 'Continuar' })).toBeDisabled()

    await userEvent.click(within(modal).getByRole('button', { name: 'términos y condiciones' }))
    expect(screen.getByText('Mis TyC')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    await userEvent.click(within(modal).getByRole('checkbox'))
    await userEvent.click(within(modal).getByRole('button', { name: 'Continuar' }))

    expect(pacientesApi.aceptarTycMedico).toHaveBeenCalledWith('3', 4)
    expect(screen.getByTestId('location')).toHaveTextContent('/paciente/turno/3')
  })

  it('cancelar o mandar mensaje no pide TyC', async () => {
    pacientesApi.getTycMedico.mockResolvedValue({ requiere_aceptacion: true, aceptado: false, tyc: { id_tyc: 4 } })
    renderAcciones()
    await screen.findByRole('heading', { name: 'Juan Gómez' })
    await userEvent.click(screen.getByText('Enviar mensaje'))
    expect(screen.getByTestId('location')).toHaveTextContent('/paciente/mensajes/3')
  })

  it('si ya aceptó los TyC navega directo', async () => {
    pacientesApi.getTycMedico.mockResolvedValue({ requiere_aceptacion: true, aceptado: true, tyc: { id_tyc: 4 } })
    renderAcciones()
    await screen.findByRole('heading', { name: 'Juan Gómez' })
    await userEvent.click(screen.getByText('Solicitar receta'))
    expect(screen.getByTestId('location')).toHaveTextContent('/paciente/receta/3')
  })
})

describe('SolicitarRecetaPage', () => {
  const renderReceta = () => renderPaciente(<SolicitarRecetaPage />, '/paciente/receta/3', '/paciente/receta/:medicoId')

  it('arma la lista de medicamentos y envía la solicitud', async () => {
    pacientesApi.solicitarReceta.mockResolvedValue({ id_solicitud: 1 })
    renderReceta()

    await userEvent.click(screen.getByLabelText(/Urgente/))
    await userEvent.type(screen.getByLabelText('Droga o medicamento'), 'Ibuprofeno')
    await userEvent.type(screen.getByLabelText('Dosis / Cantidad'), '400mg{enter}')
    await userEvent.type(screen.getByLabelText('Droga o medicamento'), 'Paracetamol')
    await userEvent.click(screen.getByRole('button', { name: /Agregar medicamento/ }))
    await userEvent.click(screen.getAllByTitle('Quitar')[1])
    await userEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(pacientesApi.solicitarReceta).toHaveBeenCalledWith('3', { tipo: 'urgente', items: [{ medicamento: 'Ibuprofeno', dosis: '400mg' }] })
    expect(await screen.findByText('✓ Solicitud enviada')).toBeInTheDocument()
  })

  it('valida el medicamento y el máximo de 5', async () => {
    renderReceta()
    await userEvent.click(screen.getByRole('button', { name: /Agregar medicamento/ }))
    expect(screen.getByText('Ingresá el nombre del medicamento.')).toBeInTheDocument()

    for (let i = 1; i <= 5; i += 1) {
      await userEvent.type(screen.getByLabelText('Droga o medicamento'), `Med ${i}{enter}`)
    }
    expect(screen.getByRole('button', { name: /Agregar medicamento/ })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Droga o medicamento'), 'Sexto{enter}')
    expect(screen.getByText('Podés agregar hasta 5 medicamentos por receta.')).toBeInTheDocument()
  })

  it('muestra el error del backend', async () => {
    pacientesApi.solicitarReceta.mockRejectedValue(new ApiError(402, 'Membresía vencida'))
    renderReceta()
    await userEvent.type(screen.getByLabelText('Droga o medicamento'), 'Ibuprofeno{enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }))
    expect(await screen.findByText('Membresía vencida')).toBeInTheDocument()
  })
})

describe('MensajesPage', () => {
  const renderMensajes = () => renderPaciente(<MensajesPage />, '/paciente/mensajes/3', '/paciente/mensajes/:medicoId')

  it('envía la consulta y limpia el formulario', async () => {
    pacientesApi.enviarMensaje.mockResolvedValue({})
    renderMensajes()

    const enviar = screen.getByRole('button', { name: /Enviar consulta/ })
    expect(enviar).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Asunto'), ' Dosis ')
    await userEvent.type(screen.getByLabelText('Mensaje'), 'Tengo una duda')
    await userEvent.click(enviar)

    expect(pacientesApi.enviarMensaje).toHaveBeenCalledWith('3', { asunto: 'Dosis', mensaje: 'Tengo una duda' })
    expect(await screen.findByText('Mensaje enviado correctamente al medico.')).toBeInTheDocument()
    expect(screen.getByLabelText('Asunto')).toHaveValue('')
  })

  it('muestra errores del backend', async () => {
    pacientesApi.enviarMensaje.mockRejectedValue(new Error('red'))
    renderMensajes()
    await userEvent.type(screen.getByLabelText('Asunto'), 'A')
    await userEvent.type(screen.getByLabelText('Mensaje'), 'B')
    await userEvent.click(screen.getByRole('button', { name: /Enviar consulta/ }))
    expect(await screen.findByText('No se pudo enviar el mensaje.')).toBeInTheDocument()
  })
})

describe('CancelarTurnoPage', () => {
  const renderCancelar = () => renderPaciente(<CancelarTurnoPage />, '/paciente/cancelar/3', '/paciente/cancelar/:medicoId')

  it('lista solo turnos activos y cancela el elegido', async () => {
    turnosApi.listarMisTurnos.mockResolvedValue([turno(), turno({ id: 901, status: 'completado', dateIso: '2026-09-01' })])
    turnosApi.cancelarPropio.mockResolvedValue({})
    renderCancelar()

    await userEvent.click(await screen.findByText('20/10/2026 a las 10:00'))
    expect(screen.queryByText(/01\/09\/2026/)).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Motivo/), 'Viaje')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))

    expect(turnosApi.cancelarPropio).toHaveBeenCalledWith(900, 'Viaje')
    expect(await screen.findByText('Turno cancelado')).toBeInTheDocument()
    expect(turnosApi.listarMisTurnos).toHaveBeenCalledWith({ idMedico: '3' })
  })

  it('avisa si el médico no tiene turnos habilitados', async () => {
    medicosApi.getById.mockResolvedValue({ ...medico, permiteTurnos: false })
    renderCancelar()
    expect(await screen.findByText(/no tiene módulo de turnos/)).toBeInTheDocument()
    expect(turnosApi.listarMisTurnos).not.toHaveBeenCalled()
  })

  it('muestra el error si no se puede cancelar', async () => {
    turnosApi.listarMisTurnos.mockResolvedValue([turno()])
    turnosApi.cancelarPropio.mockRejectedValue(new Error('Faltan menos de 72 horas'))
    renderCancelar()
    await userEvent.click(await screen.findByText('20/10/2026 a las 10:00'))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))
    expect(await screen.findByText('Faltan menos de 72 horas')).toBeInTheDocument()
  })

  it('sin turnos muestra el estado vacío', async () => {
    renderCancelar()
    expect(await screen.findByText(/No tenés turnos activos/)).toBeInTheDocument()
  })
})

describe('WizardTurnoPage', () => {
  const renderWizard = () => renderPaciente(<WizardTurnoPage />, '/paciente/turno/3', '/paciente/turno/:medicoId')

  beforeEach(() => {
    medicosApi.listClinicasByMedico.mockResolvedValue([{ id: 8, nombre: 'Centro', ciudad: 'La Plata', direccion: 'Calle 1' }])
    medicosApi.getTurnosConfigByMedico.mockResolvedValue({
      tipos_turno: [
        { id_tipo_turno: 1, nombre: 'Control', duracion_minutos: 30 },
        { id_tipo_turno: 2, nombre: '', duracion_minutos: 30 },
      ],
    })
    medicosApi.getResumenDisponibilidad.mockImplementation(async ({ desde, hasta }) => ({
      dias: fechasEntre(desde, hasta).map((fecha) => ({ fecha, estado: 'disponible' })),
    }))
    medicosApi.getDisponibilidad.mockResolvedValue({
      slots: [
        { hora: '10:00:00', id_disponibilidad: 5, libre: true, bloqueado: false },
        { hora: '10:30:00', id_disponibilidad: 5, libre: false, bloqueado: false },
      ],
    })
  })

  it('recorre los cuatro pasos y crea el turno', async () => {
    turnosApi.crear.mockResolvedValue({ id_turno: 1 })
    renderWizard()

    const continuar = () => screen.getByRole('button', { name: /Continuar/ })

    await userEvent.click(await screen.findByText('Centro'))
    await userEvent.click(continuar())

    expect(screen.getAllByRole('button', { name: /min$/ })).toHaveLength(1)
    await userEvent.click(screen.getByText('Control'))
    await userEvent.click(continuar())

    const dias = await waitFor(() => {
      const habilitados = document.querySelectorAll('.wizard-cal-dia.disponible:not([disabled])')
      expect(habilitados.length).toBeGreaterThan(0)
      return habilitados
    })
    await userEvent.click(dias[0])
    expect(await screen.findByRole('button', { name: '10:30' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '10:00' }))
    await userEvent.click(continuar())

    expect(screen.getByText('Confirma tu turno')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Confirmar turno/ }))

    expect(turnosApi.crear).toHaveBeenCalledWith(expect.objectContaining({
      id_medico: 3,
      id_clinica: 8,
      id_disponibilidad: 5,
      hora: '10:00:00',
      motivo_consulta: 'Control',
      duracion_minutos: 30,
      id_tipo_turno: 1,
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }))
    expect(await screen.findByText('Turno solicitado')).toBeInTheDocument()
  })

  it('pide el estado del mes en una sola request y no la repite al volver a un mes visto', async () => {
    renderWizard()
    await userEvent.click(await screen.findByText('Centro'))
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    await userEvent.click(screen.getByText('Control'))
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))

    await waitFor(() => expect(medicosApi.getResumenDisponibilidad).toHaveBeenCalledTimes(1))
    const [primerMes] = medicosApi.getResumenDisponibilidad.mock.calls[0]
    expect(primerMes).toMatchObject({ idMedico: '3', idClinica: 8, duracionMinutos: 30 })
    expect(primerMes.hasta.slice(0, 7)).toBe(primerMes.desde.slice(0, 7))
    expect(medicosApi.getDisponibilidad).not.toHaveBeenCalled()

    const [anterior, siguiente] = document.querySelectorAll('.wizard-cal-nav-btn')
    await userEvent.click(siguiente)
    await waitFor(() => expect(medicosApi.getResumenDisponibilidad).toHaveBeenCalledTimes(2))
    expect(medicosApi.getResumenDisponibilidad.mock.calls[1][0].desde).toMatch(/-01$/)

    await userEvent.click(anterior)
    await waitFor(() => expect(document.querySelectorAll('.wizard-cal-dia.disponible:not([disabled])').length).toBeGreaterThan(0))
    expect(medicosApi.getResumenDisponibilidad).toHaveBeenCalledTimes(2)
  })

  it('no deja elegir un horario donde el turno no termina antes del cierre', async () => {
    medicosApi.getDisponibilidad.mockResolvedValue({
      slots: [
        { hora: '09:30:00', id_disponibilidad: 5, libre: true, bloqueado: false, excede_horario: false },
        { hora: '10:30:00', id_disponibilidad: 5, libre: false, bloqueado: false, excede_horario: true },
      ],
    })
    renderWizard()
    await userEvent.click(await screen.findByText('Centro'))
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    await userEvent.click(screen.getByText('Control'))
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    const dias = await waitFor(() => {
      const habilitados = document.querySelectorAll('.wizard-cal-dia.disponible:not([disabled])')
      expect(habilitados.length).toBeGreaterThan(0)
      return habilitados
    })
    await userEvent.click(dias[0])

    const tarde = await screen.findByRole('button', { name: '10:30' })
    expect(tarde).toBeDisabled()
    expect(tarde).toHaveAttribute('title', 'Un turno de 30 minutos no termina antes del cierre de la agenda')
    expect(screen.getByRole('button', { name: '09:30' })).toBeEnabled()
  })

  it('no deja avanzar sin elegir', async () => {
    renderWizard()
    await screen.findByText('Centro')
    expect(screen.getByRole('button', { name: /Continuar/ })).toBeDisabled()
  })

  it('muestra el error del backend al confirmar', async () => {
    turnosApi.crear.mockRejectedValue(new Error('Ese horario ya fue tomado'))
    renderWizard()
    await userEvent.click(await screen.findByText('Centro'))
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    await userEvent.click(screen.getByText('Control'))
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    const dias = await waitFor(() => {
      const habilitados = document.querySelectorAll('.wizard-cal-dia.disponible:not([disabled])')
      expect(habilitados.length).toBeGreaterThan(0)
      return habilitados
    })
    await userEvent.click(dias[0])
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }))
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    await userEvent.click(screen.getByRole('button', { name: /Confirmar turno/ }))
    expect(await screen.findByText('Ese horario ya fue tomado')).toBeInTheDocument()
  })

  it('si el médico no tiene turnos muestra el aviso', async () => {
    medicosApi.getById.mockResolvedValue({ ...medico, permiteTurnos: false })
    renderWizard()
    expect(await screen.findByText('Turnos no disponibles')).toBeInTheDocument()
  })

  it('sin consultorios avisa al paciente', async () => {
    medicosApi.listClinicasByMedico.mockResolvedValue([])
    renderWizard()
    expect(await screen.findByText('Este medico no tiene clinicas cargadas.')).toBeInTheDocument()
  })
})

describe('PanelPacientePage', () => {
  beforeEach(() => {
    pacientesApi.getMiPerfil.mockResolvedValue({
      nombre: 'Ana', apellido: 'Paz', dni: '30111222', email: 'ana@x.com',
      telefono: '+5492214563895', fecha_nac_iso: '1990-05-01', id_obra_social: 2, nro_obra_social: '123',
    })
    pacientesApi.listarObrasSociales.mockResolvedValue([{ id_obra_social: 2, nombre: 'OSDE' }])
    pacientesApi.listarMisRecetas.mockResolvedValue([
      { id_solicitud: 1, medico_nombre: 'Juan', medico_apellido: 'Gómez', creado_en: '2026-10-01T10:00:00', tipo: 'urgente', estado: 'enviada', items: [{ medicamento: 'Ibuprofeno', dosis: '400mg' }] },
    ])
    pacientesApi.listarMisMensajes.mockResolvedValue([
      { id_solicitud: 2, asunto: 'Consulta', mensaje: 'Hola', medico_nombre: 'Juan', medico_apellido: 'Gómez', creado_en: '2026-10-01T10:00:00', estado: 'enviada' },
    ])
    turnosApi.listarMisTurnos.mockResolvedValue([turno(), turno({ id: 901, status: 'completado' })])
  })

  const renderPanel = () => renderPaciente(<PanelPacientePage />, '/paciente/panel')

  it('carga los datos y guarda los cambios de perfil', async () => {
    pacientesApi.actualizarMiPerfil.mockImplementation(async (payload) => ({ nombre: 'Ana', apellido: 'Paz', telefono: payload.telefono, id_obra_social: null }))
    renderPanel()

    expect(await screen.findByDisplayValue('30111222')).toBeDisabled()
    expect(screen.getByLabelText('Obra social')).toHaveValue('2')

    await userEvent.selectOptions(screen.getByLabelText('Obra social'), '')
    expect(screen.getByLabelText('Número de afiliado')).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Teléfono'))
    await userEvent.type(screen.getByLabelText('Teléfono'), '2214563895')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(pacientesApi.actualizarMiPerfil).toHaveBeenCalledWith({
      telefono: '2214563895', fecha_nac: '1990-05-01', id_obra_social: null, nro_obra_social: null,
    })
    expect(await screen.findByText('Datos actualizados.')).toBeInTheDocument()
  })

  it('muestra turnos activos e historial, y permite cancelar', async () => {
    turnosApi.cancelarPropio.mockResolvedValue({})
    renderPanel()
    await screen.findByDisplayValue('30111222')
    await userEvent.click(screen.getByRole('button', { name: /Mis turnos/ }))

    expect(screen.getByText('Turnos pendientes')).toBeInTheDocument()
    expect(screen.getByText('Completado')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(turnosApi.cancelarPropio).toHaveBeenCalledWith(900, '')
    await waitFor(() => expect(turnosApi.listarMisTurnos).toHaveBeenCalledTimes(2))
  })

  it('muestra recetas y mensajes', async () => {
    renderPanel()
    await screen.findByDisplayValue('30111222')

    await userEvent.click(screen.getByRole('button', { name: /Mis recetas/ }))
    expect(screen.getByText('Ibuprofeno · 400mg')).toBeInTheDocument()
    expect(screen.getByText('Urgente')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Mis mensajes/ }))
    expect(screen.getByText('Consulta')).toBeInTheDocument()
    expect(screen.getByText(/01\/10\/2026 · 10:00/)).toBeInTheDocument()
  })

  it('muestra el error de carga', async () => {
    pacientesApi.getMiPerfil.mockRejectedValue(new Error('No se pudo cargar'))
    renderPanel()
    expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument()
  })
})
