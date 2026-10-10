import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/asistentes.api', () => ({ asistentesApi: { meAccess: vi.fn() } }))
vi.mock('../../src/services/medicos.api', () => ({
  medicosApi: {
    listClinicasByMedico: vi.fn(),
    getTurnosConfigByMedico: vi.fn(),
    listMyClinicas: vi.fn(),
    getMyTurnosConfig: vi.fn(),
  },
}))
vi.mock('../../src/services/turnos.api', () => ({ turnosApi: { listarPorMedico: vi.fn() } }))
vi.mock('../../src/services/pacientes.api', () => ({ pacientesApi: { list: vi.fn(), listarObrasSociales: vi.fn() } }))
vi.mock('../../src/services/gerentes.api', () => ({
  gerentesApi: {
    listMisClinicas: vi.fn(),
    listInvitaciones: vi.fn(),
    listMedicosEquipo: vi.fn(),
    crearInvitacion: vi.fn(),
    revocarInvitacion: vi.fn(),
    desvincularMedico: vi.fn(),
  },
}))
vi.mock('../../src/services/auth.api', () => ({ authApi: { me: vi.fn(), login: vi.fn(), registerAsistente: vi.fn() } }))
vi.mock('../../src/services/consultorios.api', () => ({
  consultoriosApi: {
    listMios: vi.fn(),
    listSolicitudesRecibidas: vi.fn(),
    crear: vi.fn(),
    getDisponibilidad: vi.fn(),
    saveDisponibilidad: vi.fn(),
    listMedicosVinculados: vi.fn(),
    desvincularMedico: vi.fn(),
    aprobarSolicitud: vi.fn(),
    rechazarSolicitud: vi.fn(),
    reporteUso: vi.fn(),
  },
}))
vi.mock('../../src/services/admin.api', () => ({
  adminApi: { listUsuarios: vi.fn(), getUsuarioDetalle: vi.fn(), getFinanzas: vi.fn(), reactivateMembership: vi.fn() },
}))

import { asistentesApi } from '../../src/services/asistentes.api'
import { medicosApi } from '../../src/services/medicos.api'
import { turnosApi } from '../../src/services/turnos.api'
import { pacientesApi } from '../../src/services/pacientes.api'
import { gerentesApi } from '../../src/services/gerentes.api'
import { authApi } from '../../src/services/auth.api'
import { consultoriosApi } from '../../src/services/consultorios.api'
import { adminApi } from '../../src/services/admin.api'
import { ApiError } from '../../src/services/apiClient'
import PanelAsistentePage from '../../src/pages/asistente/PanelAsistentePage'
import PanelGerentePage from '../../src/pages/gerente/PanelGerentePage'
import PanelPropietarioPage from '../../src/pages/propietario/PanelPropietarioPage'
import ConsultoriosTab from '../../src/pages/propietario/tabs/ConsultoriosTab'
import ReporteUsoTab from '../../src/pages/propietario/tabs/ReporteUsoTab'
import SolicitudesTab from '../../src/pages/propietario/tabs/SolicitudesTab'
import PanelAdminPage from '../../src/pages/admin/PanelAdminPage'
import { renderWithProviders, usuarios } from '../helpers/render'

describe('PanelAsistentePage', () => {
  beforeEach(() => {
    medicosApi.listClinicasByMedico.mockResolvedValue([])
    medicosApi.getTurnosConfigByMedico.mockResolvedValue({})
    turnosApi.listarPorMedico.mockResolvedValue([])
  })

  const renderAsistente = () => renderWithProviders(<PanelAsistentePage />, { usuario: usuarios.asistente })

  it('muestra la agenda del médico asignado', async () => {
    asistentesApi.meAccess.mockResolvedValue({ doctorId: 3, blocked: false, permissions: { agenda: true, pacientes: false } })
    renderAsistente()

    await waitFor(() => expect(medicosApi.listClinicasByMedico).toHaveBeenCalledWith(3))
    expect(screen.getByRole('button', { name: 'Agenda' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pacientes' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Tu usuario está bloqueado/)).not.toBeInTheDocument()
  })

  it('un asistente bloqueado solo ve la agenda', async () => {
    asistentesApi.meAccess.mockResolvedValue({ doctorId: 3, blocked: true, permissions: { agenda: true, pacientes: true } })
    renderAsistente()
    expect(await screen.findByText(/Tu usuario está bloqueado/)).toBeInTheDocument()
  })

  it('con permiso de pacientes muestra esa pestaña', async () => {
    asistentesApi.meAccess.mockResolvedValue({ doctorId: 3, blocked: false, permissions: { agenda: true, pacientes: true } })
    pacientesApi.list.mockResolvedValue([])
    renderAsistente()
    await userEvent.click(await screen.findByRole('button', { name: 'Pacientes' }))
    expect(screen.getByRole('button', { name: 'Pacientes' })).toHaveClass('active')
  })

  it('sin permisos lo informa', async () => {
    asistentesApi.meAccess.mockResolvedValue({ doctorId: 3, blocked: false, permissions: { agenda: false, pacientes: false } })
    renderAsistente()
    expect(await screen.findByText('No tenés permisos asignados.')).toBeInTheDocument()
  })

  it('si falla la consulta de acceso queda bloqueado', async () => {
    asistentesApi.meAccess.mockRejectedValue(new Error('403'))
    renderAsistente()
    expect(await screen.findByText(/Tu usuario está bloqueado/)).toBeInTheDocument()
  })
})

describe('PanelGerentePage', () => {
  beforeEach(() => {
    gerentesApi.listMisClinicas.mockResolvedValue([{ id_clinica: 11, nombre: 'Clínica Sur', direccion: 'Calle 1' }])
    gerentesApi.listInvitaciones.mockResolvedValue([
      { id_invitacion: 4, email_invitado: 'doc@x.com', clinica_nombre: 'Clínica Sur', estado: 'pendiente' },
      { id_invitacion: 5, email_invitado: 'otro@x.com', clinica_nombre: 'Clínica Sur', estado: 'aceptada' },
    ])
    gerentesApi.listMedicosEquipo.mockResolvedValue([{ id_medico: 3, id_clinica: 11, nombre: 'Juan', apellido: 'Gómez', matricula: 'MP1', clinica_nombre: 'Clínica Sur' }])
  })

  const renderGerente = () => renderWithProviders(<PanelGerentePage />, { usuario: usuarios.gerente })

  it('muestra clínicas, invitaciones y equipo', async () => {
    renderGerente()
    expect(await screen.findByText('Juan Gómez')).toBeInTheDocument()
    expect(screen.getByText('Clínica Sur', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Clínica Sur · Aceptada')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Revocar' })).toHaveLength(1)
  })

  it('valida e invita a un médico', async () => {
    gerentesApi.crearInvitacion.mockResolvedValue({ link: 'http://app/invitacion/abc' })
    renderGerente()
    await screen.findByText('Juan Gómez')

    await userEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))
    expect(screen.getByText('Ingresá un email válido.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Email del médico'), 'nuevo@x.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))

    expect(gerentesApi.crearInvitacion).toHaveBeenCalledWith({ id_clinica: 11, email: 'nuevo@x.com' })
    expect(await screen.findByText('http://app/invitacion/abc')).toBeInTheDocument()
    expect(gerentesApi.listInvitaciones).toHaveBeenCalledTimes(2)
  })

  it('muestra el error al invitar', async () => {
    gerentesApi.crearInvitacion.mockRejectedValue(new ApiError(404, 'La clínica no existe o no te pertenece'))
    renderGerente()
    await screen.findByText('Juan Gómez')
    await userEvent.type(screen.getByLabelText('Email del médico'), 'nuevo@x.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))
    expect(await screen.findByText('La clínica no existe o no te pertenece')).toBeInTheDocument()
  })

  it('revoca invitaciones y desvincula médicos', async () => {
    gerentesApi.revocarInvitacion.mockResolvedValue()
    gerentesApi.desvincularMedico.mockResolvedValue()
    renderGerente()
    await screen.findByText('Juan Gómez')

    await userEvent.click(screen.getByRole('button', { name: 'Revocar' }))
    expect(gerentesApi.revocarInvitacion).toHaveBeenCalledWith(4)

    await userEvent.click(screen.getByRole('button', { name: 'Desvincular' }))
    expect(gerentesApi.desvincularMedico).toHaveBeenCalledWith(3, 11)
  })

  it('crea asistentes con IDs de clínica', async () => {
    authApi.registerAsistente.mockResolvedValue({ id_asistente: 9, username: 'mia' })
    renderGerente()
    await screen.findByText('Juan Gómez')

    await userEvent.type(screen.getByLabelText('Nombre'), 'Mía')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ruiz')
    await userEvent.type(screen.getByLabelText('Email'), 'mia@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234')
    await userEvent.type(screen.getByLabelText('IDs de clínicas'), '11')
    await userEvent.click(screen.getByRole('button', { name: 'Crear asistente' }))

    expect(authApi.registerAsistente).toHaveBeenCalledWith(expect.objectContaining({ email: 'mia@x.com', clinic_ids: [11] }))
    expect(await screen.findByText('Asistentes creados recientemente')).toBeInTheDocument()
    expect(screen.getByText('Usuario: mia · Estado: activa')).toBeInTheDocument()
  })

  it('sin clínicas lo informa', async () => {
    gerentesApi.listMisClinicas.mockResolvedValue([])
    gerentesApi.listInvitaciones.mockResolvedValue([])
    gerentesApi.listMedicosEquipo.mockResolvedValue([])
    renderGerente()
    expect(await screen.findByText('No tenés clínicas cargadas todavía.')).toBeInTheDocument()
    expect(screen.getByText('Todavía no enviaste ninguna.')).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay médicos vinculados.')).toBeInTheDocument()
  })
})

describe('propietario', () => {
  const salaA = { id_clinica: 11, nombre: 'Sala A', direccion: 'Calle 1', ciudad: 'La Plata', compartido: 1 }
  const renderProp = (ui) => renderWithProviders(ui, { usuario: usuarios.propietario })

  beforeEach(() => {
    consultoriosApi.listMios.mockResolvedValue([salaA, { ...salaA, id_clinica: 12, nombre: 'Sala B', compartido: 0 }])
    consultoriosApi.listSolicitudesRecibidas.mockResolvedValue([
      { id_solicitud: 1, estado: 'pendiente', medico_nombre: 'Juan', medico_apellido: 'Gómez', matricula: 'MP1', medico_email: 'doc@x.com', clinica_nombre: 'Sala A', mensaje: 'Martes' },
      { id_solicitud: 2, estado: 'rechazada', medico_nombre: 'Ana', medico_apellido: 'Paz', clinica_nombre: 'Sala B', motivo_rechazo: 'Sin lugar' },
    ])
  })

  describe('PanelPropietarioPage', () => {
    it('muestra KPIs y cambia de pestaña', async () => {
      renderProp(<PanelPropietarioPage />)
      await waitFor(() => expect(screen.getByText('Consultorios').previousSibling).toHaveTextContent('2'))
      expect(screen.getByText('Publicados').previousSibling).toHaveTextContent('1')
      expect(screen.getByText('Solicitudes pendientes', { selector: '.kpi-label' }).previousSibling).toHaveTextContent('1')

      await userEvent.click(screen.getByRole('button', { name: 'Solicitudes' }))
      expect(await screen.findByText('“Martes”')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Reporte de uso' }))
      expect(screen.getByRole('button', { name: 'Generar' })).toBeInTheDocument()
    })
  })

  describe('ConsultoriosTab', () => {
    it('crea un consultorio', async () => {
      consultoriosApi.crear.mockResolvedValue({ id_clinica: 13 })
      const onChange = vi.fn()
      renderProp(<ConsultoriosTab onChange={onChange} />)
      await screen.findByText('Sala A')

      await userEvent.click(screen.getByRole('button', { name: /Agregar consultorio/ }))
      await userEvent.click(screen.getByRole('button', { name: 'Guardar consultorio' }))
      expect(screen.getByText('Completá nombre y dirección.')).toBeInTheDocument()

      await userEvent.type(screen.getByLabelText('Nombre'), 'Sala C')
      await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 3')
      await userEvent.click(screen.getByRole('button', { name: 'Guardar consultorio' }))

      expect(consultoriosApi.crear).toHaveBeenCalledWith({ nombre: 'Sala C', direccion: 'Calle 3', telefono: null, id_ciudad: 1 })
      expect(await screen.findByText('Consultorio creado correctamente.')).toBeInTheDocument()
      expect(onChange).toHaveBeenCalled()
    })

    it('carga y guarda la disponibilidad agrupando días', async () => {
      consultoriosApi.getDisponibilidad.mockResolvedValue({
        rangos: [
          { dia_semana: 1, hora_inicio: '09:00', hora_fin: '13:00', duracion_turno: 60 },
          { dia_semana: 3, hora_inicio: '09:00', hora_fin: '13:00', duracion_turno: 60 },
        ],
      })
      consultoriosApi.listMedicosVinculados.mockResolvedValue([{ id_medico: 3, nombre: 'Juan', apellido: 'Gómez', matricula: 'MP1', email: 'doc@x.com' }])
      consultoriosApi.saveDisponibilidad.mockResolvedValue({})
      consultoriosApi.desvincularMedico.mockResolvedValue()
      renderProp(<ConsultoriosTab />)

      await userEvent.click((await screen.findAllByRole('button', { name: 'Configurar horarios' }))[0])
      expect(await screen.findByText('Horarios de Sala A')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Lun' })).toHaveClass('active')
      expect(screen.getByRole('button', { name: 'Mie' })).toHaveClass('active')

      await userEvent.click(screen.getByRole('button', { name: 'Vie' }))
      await userEvent.click(screen.getByRole('button', { name: 'Guardar horarios' }))
      expect(consultoriosApi.saveDisponibilidad).toHaveBeenCalledWith(11, {
        rangos: [{ dias: ['Lun', 'Mie', 'Vie'], inicio: '09:00', fin: '13:00', duracion: 60 }],
        excepciones: [],
      })
      expect(await screen.findByText('Disponibilidad guardada correctamente.')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /Desvincular/ }))
      expect(consultoriosApi.desvincularMedico).toHaveBeenCalledWith(11, 3)
      expect(await screen.findByText('Todavía no hay médicos usando este consultorio.')).toBeInTheDocument()
    })

    it('exige al menos un día antes de guardar horarios', async () => {
      consultoriosApi.getDisponibilidad.mockResolvedValue({ rangos: [] })
      consultoriosApi.listMedicosVinculados.mockResolvedValue([])
      renderProp(<ConsultoriosTab />)
      await userEvent.click((await screen.findAllByRole('button', { name: 'Configurar horarios' }))[0])
      await userEvent.click(await screen.findByRole('button', { name: 'Guardar horarios' }))
      expect(screen.getByText('Elegí al menos un día con su horario.')).toBeInTheDocument()
    })
  })

  describe('SolicitudesTab', () => {
    it('aprueba y rechaza solicitudes', async () => {
      consultoriosApi.aprobarSolicitud.mockResolvedValue({})
      consultoriosApi.rechazarSolicitud.mockResolvedValue({})
      vi.spyOn(window, 'prompt').mockReturnValue('Sin lugar')
      const onChange = vi.fn()
      renderProp(<SolicitudesTab onChange={onChange} />)

      expect(await screen.findByText('Sala B · Rechazada · Sin lugar')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
      expect(consultoriosApi.aprobarSolicitud).toHaveBeenCalledWith(1)
      expect(await screen.findByText(/Solicitud aprobada/)).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
      expect(consultoriosApi.rechazarSolicitud).toHaveBeenCalledWith(1, 'Sin lugar')
      expect(onChange).toHaveBeenCalledTimes(2)
    })

    it('muestra el error al resolver', async () => {
      consultoriosApi.aprobarSolicitud.mockRejectedValue(new Error('Esa solicitud ya fue resuelta'))
      renderProp(<SolicitudesTab />)
      await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }))
      expect(await screen.findByText('Esa solicitud ya fue resuelta')).toBeInTheDocument()
    })
  })

  describe('ReporteUsoTab', () => {
    it('genera el reporte del período', async () => {
      consultoriosApi.reporteUso.mockResolvedValue({
        desde: '2026-10-01', hasta: '2026-10-31', total_horas: 3.5,
        medicos: [{ id_medico: 3, medico_nombre: 'Juan', medico_apellido: 'Gómez', turnos: 1, horas: 3.5 }],
      })
      renderProp(<ReporteUsoTab />)
      await waitFor(() => expect(screen.getByLabelText('Consultorio')).toHaveValue('11'))

      await userEvent.click(screen.getByRole('button', { name: 'Generar' }))
      expect(consultoriosApi.reporteUso).toHaveBeenCalledWith('11', expect.objectContaining({ desde: expect.stringMatching(/-01$/) }))
      expect(await screen.findByText('Juan Gómez')).toBeInTheDocument()
      expect(screen.getByText('1 turno')).toBeInTheDocument()
      expect(screen.getAllByText('3.50 h')).toHaveLength(2)
    })

    it('sin consultorios pide elegir uno y muestra errores', async () => {
      consultoriosApi.listMios.mockResolvedValue([])
      renderProp(<ReporteUsoTab />)
      await userEvent.click(screen.getByRole('button', { name: 'Generar' }))
      expect(screen.getByText('Elegí un consultorio.')).toBeInTheDocument()
    })

    it('muestra el error del backend', async () => {
      consultoriosApi.reporteUso.mockRejectedValue(new Error('desde y hasta son obligatorios'))
      renderProp(<ReporteUsoTab />)
      await waitFor(() => expect(screen.getByLabelText('Consultorio')).toHaveValue('11'))
      await userEvent.click(screen.getByRole('button', { name: 'Generar' }))
      expect(await screen.findByText('desde y hasta son obligatorios')).toBeInTheDocument()
    })
  })
})

describe('PanelAdminPage', () => {
  const usuariosRows = [
    { id_usuario: 5, nombre: 'Juan Gómez', email: 'doc@x.com', rol: 'medico', activo: 1, suscripcion_estado: 'vencida' },
    { id_usuario: 6, nombre: 'Ana Paz', email: 'ana@x.com', rol: 'paciente', activo: 0, suscripcion_estado: 'inexistente' },
  ]
  const detalleMedico = {
    usuario: { id_usuario: 5, rol: 'medico', email: 'doc@x.com' },
    suscripcion: { plan: 'Medio', estado: 'vencida', total_a_cobrar: 35000, adicionales: [] },
    perfil: { nombre: 'Juan' },
    relaciones: { clinicas: [{ id_clinica: 8, nombre: 'Centro' }] },
    pagos: [],
  }

  beforeEach(() => {
    adminApi.listUsuarios.mockResolvedValue(usuariosRows)
    adminApi.getUsuarioDetalle.mockResolvedValue(detalleMedico)
  })

  const renderAdmin = () => renderWithProviders(<PanelAdminPage />, { usuario: usuarios.admin })

  it('lista usuarios, selecciona el primero y calcula KPIs', async () => {
    renderAdmin()
    expect(await screen.findByText('Detalle completo del usuario')).toBeInTheDocument()
    expect(adminApi.getUsuarioDetalle).toHaveBeenCalledWith(5)
    expect(screen.getByText('Usuarios visibles').previousSibling).toHaveTextContent('2')
    expect(screen.getByText('Activos').previousSibling).toHaveTextContent('1')
    expect(screen.getByText('Con suscripción').previousSibling).toHaveTextContent('1')
    await waitFor(() => expect(screen.getByText('Clínicas vinculadas').previousSibling).toHaveTextContent('1'))
  })

  it('filtra por texto y rol', async () => {
    renderAdmin()
    await screen.findByText('Detalle completo del usuario')
    await userEvent.type(screen.getByPlaceholderText(/Buscar por email/), 'a')
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'medico')
    await waitFor(() => expect(adminApi.listUsuarios).toHaveBeenLastCalledWith({ q: 'a', rol: 'medico', suscripcion: '' }))
  })

  it('al elegir otro usuario carga su detalle', async () => {
    renderAdmin()
    await screen.findByText('Detalle completo del usuario')
    await userEvent.click(screen.getByText('ana@x.com'))
    await waitFor(() => expect(adminApi.getUsuarioDetalle).toHaveBeenLastCalledWith(6))
  })

  it('precarga el monto y reactiva la membresía', async () => {
    adminApi.reactivateMembership.mockResolvedValue({})
    renderAdmin()
    await waitFor(() => expect(screen.getByLabelText('Monto a cobrar (plan + adicionales)')).toHaveValue(35000))
    expect(screen.getByLabelText('Plan')).toHaveValue('medio')

    await userEvent.selectOptions(screen.getByLabelText('Método'), 'transferencia')
    await userEvent.type(screen.getByLabelText('Referencia (opcional)'), 'TX1')
    await userEvent.click(screen.getByRole('button', { name: /Validar pago y reactivar/ }))

    expect(adminApi.reactivateMembership).toHaveBeenCalledWith({ id_usuario: 5, plan: 'medio', metodo: 'transferencia', monto: 35000, referencia_externa: 'TX1' })
    await waitFor(() => expect(adminApi.listUsuarios).toHaveBeenCalledTimes(2))
  })

  it('muestra el error al reactivar', async () => {
    adminApi.reactivateMembership.mockRejectedValue(new Error('metodo de pago invalido'))
    renderAdmin()
    await userEvent.click(await screen.findByRole('button', { name: /Validar pago y reactivar/ }))
    expect(await screen.findByText('metodo de pago invalido')).toBeInTheDocument()
  })

  it('un paciente no tiene formulario de reactivación', async () => {
    adminApi.getUsuarioDetalle.mockResolvedValue({ ...detalleMedico, usuario: { id_usuario: 5, rol: 'paciente' }, relaciones: {} })
    renderAdmin()
    await screen.findByText('Detalle completo del usuario')
    expect(screen.queryByRole('button', { name: /Validar pago y reactivar/ })).not.toBeInTheDocument()
    expect(screen.getByText('Sin relaciones adicionales para este rol.')).toBeInTheDocument()
  })

  it('muestra las finanzas', async () => {
    adminApi.getFinanzas.mockResolvedValue({
      resumen: { total_ingresado: 150000, total_pendiente: 0, total_reintegrado: 0, pagos_aprobados: 10 },
      mensual: [{ periodo: '2026-10', total_aprobado: 150000, total_pendiente: 0, cantidad_movimientos: 10 }],
      movimientos: [{ id_pago: 1, fecha_pago: '01/10/2026', email: 'doc@x.com', rol: 'medico', plan: 'medio', estado: 'aprobado', monto: 15000, metodo: 'manual' }],
    })
    renderAdmin()
    await userEvent.click(screen.getByRole('button', { name: 'Finanzas' }))

    expect(await screen.findByText('Resumen financiero')).toBeInTheDocument()
    expect(screen.getByText('2026-10')).toBeInTheDocument()
    const totalIngresado = screen.getByText('Total ingresado').nextSibling
    expect(totalIngresado.textContent).toMatch(/150\.000/)
  })

  it('muestra errores de carga', async () => {
    adminApi.listUsuarios.mockRejectedValue(new Error('No autorizado'))
    renderAdmin()
    expect(await screen.findByText('No autorizado')).toBeInTheDocument()
  })
})

