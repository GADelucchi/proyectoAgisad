import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, STORAGE_KEYS, api } from '../../src/services/apiClient'
import { adminApi } from '../../src/services/admin.api'
import { asistentesApi } from '../../src/services/asistentes.api'
import { authApi } from '../../src/services/auth.api'
import { consultoriosApi } from '../../src/services/consultorios.api'
import { gerentesApi } from '../../src/services/gerentes.api'
import { medicosApi } from '../../src/services/medicos.api'
import { pacientesApi } from '../../src/services/pacientes.api'
import { turnosApi } from '../../src/services/turnos.api'

const BASE = 'http://api.test/api'

function respond(body, { status = 200 } = {}) {
  fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('sin cuerpo')
      return body
    },
  })
}

function lastCall() {
  const [url, options] = fetch.mock.calls.at(-1)
  return { url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, headers: options.headers }
}

beforeEach(() => {
  fetch.mockReset()
})

describe('apiClient', () => {
  it('arma la URL con VITE_API_BASE y manda JSON', async () => {
    respond({ ok: true })
    await expect(api.post('/turnos', { a: 1 })).resolves.toEqual({ ok: true })

    expect(lastCall()).toMatchObject({ url: `${BASE}/turnos`, method: 'POST', body: { a: 1 } })
    expect(lastCall().headers['Content-Type']).toBe('application/json')
  })

  it('agrega el token guardado', async () => {
    localStorage.setItem(STORAGE_KEYS.token, 'abc')
    respond({})
    await api.get('/auth/me')
    expect(lastCall().headers.Authorization).toBe('Bearer abc')
  })

  it('no manda Authorization sin token ni body en un GET', async () => {
    respond({})
    await api.get('/medicos')
    expect(lastCall().headers.Authorization).toBeUndefined()
    expect(lastCall().body).toBeUndefined()
  })

  it('respeta URLs absolutas', async () => {
    respond({})
    await api.get('https://otro.example/x')
    expect(lastCall().url).toBe('https://otro.example/x')
  })

  it('tira ApiError con el mensaje y detalles del backend', async () => {
    respond({ message: 'Ocupado', details: { code: 'TURNO' } }, { status: 409 })
    const error = await api.post('/turnos', {}).catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, message: 'Ocupado', details: { code: 'TURNO' } })
  })

  it('traduce el 401 del login a "Credenciales incorrectas."', async () => {
    respond({ message: 'Credenciales invalidas' }, { status: 401 })
    await expect(authApi.login('a@x.com', 'x')).rejects.toMatchObject({ status: 401, message: 'Credenciales incorrectas.' })
  })

  it('usa un mensaje genérico si la respuesta no es JSON', async () => {
    respond(undefined, { status: 502 })
    await expect(api.get('/x')).rejects.toMatchObject({ status: 502, message: 'Request failed with status 502', details: null })
  })

  it('acepta respuestas vacías (204)', async () => {
    respond(undefined, { status: 204 })
    await expect(api.delete('/consultorios/adicional')).resolves.toBeNull()
  })

  it('soporta el campo error como mensaje', async () => {
    respond({ error: 'Algo falló' }, { status: 400 })
    await expect(api.put('/x', {})).rejects.toMatchObject({ message: 'Algo falló' })
  })

  it('falla claro si falta VITE_API_BASE', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE', '')
    const { api: apiSinBase } = await import('../../src/services/apiClient')
    await expect(apiSinBase.get('/x')).rejects.toThrow('Falta VITE_API_BASE')
    vi.unstubAllEnvs()
  })
})

// [nombre, llamada, método, path esperado, body esperado]
const ENDPOINTS = [
  ['adminApi.listUsuarios sin filtros', () => adminApi.listUsuarios(), 'GET', '/admin/usuarios'],
  ['adminApi.listUsuarios con filtros', () => adminApi.listUsuarios({ q: 'ana', rol: 'medico', suscripcion: 'activa' }), 'GET', '/admin/usuarios?q=ana&rol=medico&suscripcion=activa'],
  ['adminApi.getUsuarioDetalle', () => adminApi.getUsuarioDetalle(5), 'GET', '/admin/usuarios/5'],
  ['adminApi.getFinanzas', () => adminApi.getFinanzas(), 'GET', '/admin/finanzas'],
  ['adminApi.reactivateMembership', () => adminApi.reactivateMembership({ id_usuario: 5 }), 'POST', '/admin/membresias/reactivar', { id_usuario: 5 }],

  ['asistentesApi.listByMedico (admin)', () => asistentesApi.listByMedico(3), 'GET', '/asistentes?id_medico=3'],
  ['asistentesApi.listByMedico (médico, propios)', () => asistentesApi.listByMedico(), 'GET', '/asistentes'],
  ['asistentesApi.patchPermisos (médico)', () => asistentesApi.patchPermisos(9, { agenda: true }), 'PATCH', '/asistentes/9/permisos', { agenda: true }],
  ['asistentesApi.patchPermisos (admin)', () => asistentesApi.patchPermisos(9, { agenda: true }, 3), 'PATCH', '/asistentes/9/permisos?id_medico=3', { agenda: true }],
  ['asistentesApi.meAccess', () => asistentesApi.meAccess(), 'GET', '/asistentes/me/access'],

  ['authApi.login', () => authApi.login('a@x.com', 'p'), 'POST', '/auth/login', { email: 'a@x.com', password: 'p' }],
  ['authApi.me', () => authApi.me(), 'GET', '/auth/me'],
  ['authApi.registerPaciente', () => authApi.registerPaciente({ a: 1 }), 'POST', '/auth/register/paciente', { a: 1 }],
  ['authApi.registerMedico', () => authApi.registerMedico({ a: 1 }), 'POST', '/auth/register/medico', { a: 1 }],
  ['authApi.registerGerente', () => authApi.registerGerente({ a: 1 }), 'POST', '/auth/register/gerente', { a: 1 }],
  ['authApi.registerPropietario', () => authApi.registerPropietario({ a: 1 }), 'POST', '/auth/register/propietario', { a: 1 }],
  ['authApi.registerAsistente', () => authApi.registerAsistente({ a: 1 }), 'POST', '/asistentes', { a: 1 }],
  ['authApi.forgotPassword', () => authApi.forgotPassword('a@x.com'), 'POST', '/auth/forgot-password', { email: 'a@x.com' }],
  ['authApi.resetPassword', () => authApi.resetPassword('tok', 'clave1234'), 'POST', '/auth/reset-password/tok', { password: 'clave1234' }],
  ['authApi.verificarEmail', () => authApi.verificarEmail('a@x.com', '123456'), 'POST', '/auth/verificar-email', { email: 'a@x.com', codigo: '123456' }],
  ['authApi.reenviarCodigo', () => authApi.reenviarCodigo('a@x.com'), 'POST', '/auth/verificar-email/reenviar', { email: 'a@x.com' }],

  ['consultoriosApi.listPublicos', () => consultoriosApi.listPublicos(), 'GET', '/consultorios/publicos'],
  ['consultoriosApi.getDisponibilidadPublica', () => consultoriosApi.getDisponibilidadPublica({ idClinica: 11, fecha: '2026-10-19', duracionMinutos: 45 }), 'GET', '/consultorios/11/disponibilidad-publica?fecha=2026-10-19&duracion_minutos=45'],
  ['consultoriosApi.listMios', () => consultoriosApi.listMios(), 'GET', '/consultorios/mios'],
  ['consultoriosApi.getAdicional', () => consultoriosApi.getAdicional(), 'GET', '/consultorios/adicional'],
  ['consultoriosApi.solicitarAdicional', () => consultoriosApi.solicitarAdicional(), 'POST', '/consultorios/adicional'],
  ['consultoriosApi.cancelarAdicional', () => consultoriosApi.cancelarAdicional(), 'DELETE', '/consultorios/adicional'],
  ['consultoriosApi.crear', () => consultoriosApi.crear({ nombre: 'Sala' }), 'POST', '/consultorios', { nombre: 'Sala' }],
  ['consultoriosApi.publicar', () => consultoriosApi.publicar(21, false), 'PATCH', '/consultorios/21/publicar', { publicar: false }],
  ['consultoriosApi.getDisponibilidad', () => consultoriosApi.getDisponibilidad(11), 'GET', '/consultorios/11/disponibilidad'],
  ['consultoriosApi.saveDisponibilidad', () => consultoriosApi.saveDisponibilidad(11, { rangos: [] }), 'PUT', '/consultorios/11/disponibilidad', { rangos: [] }],
  ['consultoriosApi.listSolicitudesRecibidas', () => consultoriosApi.listSolicitudesRecibidas(), 'GET', '/consultorios/solicitudes/recibidas'],
  ['consultoriosApi.aprobarSolicitud', () => consultoriosApi.aprobarSolicitud(9), 'PATCH', '/consultorios/solicitudes/9/aprobar'],
  ['consultoriosApi.rechazarSolicitud', () => consultoriosApi.rechazarSolicitud(9, 'No'), 'PATCH', '/consultorios/solicitudes/9/rechazar', { motivo: 'No' }],
  ['consultoriosApi.listMedicosVinculados', () => consultoriosApi.listMedicosVinculados(11), 'GET', '/consultorios/11/medicos'],
  ['consultoriosApi.desvincularMedico', () => consultoriosApi.desvincularMedico(11, 3), 'DELETE', '/consultorios/11/medicos/3'],
  ['consultoriosApi.reporteUso', () => consultoriosApi.reporteUso(11, { desde: '2026-10-01', hasta: '2026-10-31' }), 'GET', '/consultorios/11/reporte-uso?desde=2026-10-01&hasta=2026-10-31'],
  ['consultoriosApi.listMisSolicitudes', () => consultoriosApi.listMisSolicitudes(), 'GET', '/consultorios/solicitudes/mias'],
  ['consultoriosApi.solicitar', () => consultoriosApi.solicitar(11, 'Hola'), 'POST', '/consultorios/11/solicitudes', { mensaje: 'Hola' }],

  ['gerentesApi.listMisClinicas', () => gerentesApi.listMisClinicas(), 'GET', '/gerentes/me/clinicas'],
  ['gerentesApi.crearInvitacion', () => gerentesApi.crearInvitacion({ id_clinica: 11, email: 'd@x.com', extra: 1 }), 'POST', '/gerentes/invitaciones', { id_clinica: 11, email: 'd@x.com' }],
  ['gerentesApi.listInvitaciones', () => gerentesApi.listInvitaciones(), 'GET', '/gerentes/invitaciones'],
  ['gerentesApi.revocarInvitacion', () => gerentesApi.revocarInvitacion(4), 'DELETE', '/gerentes/invitaciones/4'],
  ['gerentesApi.listMedicosEquipo', () => gerentesApi.listMedicosEquipo(), 'GET', '/gerentes/medicos'],
  ['gerentesApi.desvincularMedico', () => gerentesApi.desvincularMedico(3, 11), 'DELETE', '/gerentes/medicos/3?id_clinica=11'],
  ['gerentesApi.getInvitacionPorToken', () => gerentesApi.getInvitacionPorToken('tok'), 'GET', '/gerentes/invitaciones/tok'],
  ['gerentesApi.aceptarInvitacion', () => gerentesApi.aceptarInvitacion('tok'), 'POST', '/gerentes/invitaciones/tok/aceptar'],
  ['gerentesApi.registrarViaInvitacion', () => gerentesApi.registrarViaInvitacion('tok', { nombre: 'Juan' }), 'POST', '/gerentes/invitaciones/tok/registrar', { nombre: 'Juan' }],

  ['medicosApi.listClinicasByMedico', () => medicosApi.listClinicasByMedico(3), 'GET', '/medicos/3/clinicas'],
  ['medicosApi.getDisponibilidad', () => medicosApi.getDisponibilidad({ idMedico: 3, idClinica: 8, fecha: '2026-10-19', duracionMinutos: 45 }), 'GET', '/medicos/3/disponibilidad?id_clinica=8&fecha=2026-10-19&duracion_minutos=45'],
  ['medicosApi.getDisponibilidad sin duración', () => medicosApi.getDisponibilidad({ idMedico: 3, idClinica: 8, fecha: '2026-10-19' }), 'GET', '/medicos/3/disponibilidad?id_clinica=8&fecha=2026-10-19'],
  ['medicosApi.getResumenDisponibilidad', () => medicosApi.getResumenDisponibilidad({ idMedico: 3, idClinica: 8, desde: '2026-10-19', hasta: '2026-10-31', duracionMinutos: 60 }), 'GET', '/medicos/3/disponibilidad-resumen?id_clinica=8&desde=2026-10-19&hasta=2026-10-31&duracion_minutos=60'],
  ['medicosApi.getResumenDisponibilidad sin duración', () => medicosApi.getResumenDisponibilidad({ idMedico: 3, idClinica: 8, desde: '2026-10-19', hasta: '2026-10-31' }), 'GET', '/medicos/3/disponibilidad-resumen?id_clinica=8&desde=2026-10-19&hasta=2026-10-31'],
  ['medicosApi.getTurnosConfigByMedico', () => medicosApi.getTurnosConfigByMedico(3), 'GET', '/medicos/3/turnos-config'],
  ['medicosApi.getMyDisponibilidad', () => medicosApi.getMyDisponibilidad({ idClinica: 8, fecha: '2026-10-19' }), 'GET', '/medicos/me/disponibilidad?id_clinica=8&fecha=2026-10-19'],
  ['medicosApi.listMyClinicas', () => medicosApi.listMyClinicas(), 'GET', '/medicos/me/clinicas'],
  ['medicosApi.createMyClinica', () => medicosApi.createMyClinica({ nombre: 'C' }), 'POST', '/medicos/me/clinicas', { nombre: 'C' }],
  ['medicosApi.updateMyClinica', () => medicosApi.updateMyClinica(8, { nombre: 'C' }), 'PATCH', '/medicos/me/clinicas/8', { nombre: 'C' }],
  ['medicosApi.deleteMyClinica', () => medicosApi.deleteMyClinica(8), 'DELETE', '/medicos/me/clinicas/8'],
  ['medicosApi.getMyTurnosConfig', () => medicosApi.getMyTurnosConfig(), 'GET', '/medicos/me/turnos-config'],
  ['medicosApi.saveMyTurnosConfig', () => medicosApi.saveMyTurnosConfig({ duracion_turno_estandar: 30 }), 'PUT', '/medicos/me/turnos-config', { duracion_turno_estandar: 30 }],
  ['medicosApi.listMyBloqueos', () => medicosApi.listMyBloqueos(), 'GET', '/medicos/me/bloqueos'],
  ['medicosApi.listMyBloqueos por clínica', () => medicosApi.listMyBloqueos(8), 'GET', '/medicos/me/bloqueos?id_clinica=8'],
  ['medicosApi.createMyBloqueo', () => medicosApi.createMyBloqueo({ fecha: 'x' }), 'POST', '/medicos/me/bloqueos', { fecha: 'x' }],
  ['medicosApi.updateMyBloqueo', () => medicosApi.updateMyBloqueo(4, { fecha: 'x' }), 'PATCH', '/medicos/me/bloqueos/4', { fecha: 'x' }],
  ['medicosApi.deleteMyBloqueo', () => medicosApi.deleteMyBloqueo(4), 'DELETE', '/medicos/me/bloqueos/4'],
  ['medicosApi.getMyTyc', () => medicosApi.getMyTyc(), 'GET', '/medicos/me/tyc'],
  ['medicosApi.saveMyTyc', () => medicosApi.saveMyTyc('TyC'), 'POST', '/medicos/me/tyc', { texto: 'TyC' }],
  ['medicosApi.listMyRecetasSolicitudes', () => medicosApi.listMyRecetasSolicitudes(), 'GET', '/medicos/me/recetas-solicitudes'],
  ['medicosApi.updateMyRecetaSolicitudEstado', () => medicosApi.updateMyRecetaSolicitudEstado(5, 'resuelta'), 'PATCH', '/medicos/me/recetas-solicitudes/5/estado', { estado: 'resuelta' }],
  ['medicosApi.getMyMailConfig', () => medicosApi.getMyMailConfig(), 'GET', '/medicos/me/mail-config'],
  ['medicosApi.saveMyMailConfig', () => medicosApi.saveMyMailConfig({ notif_cancelacion: true }), 'PUT', '/medicos/me/mail-config', { notif_cancelacion: true }],

  ['pacientesApi.list sin filtros', () => pacientesApi.list(), 'GET', '/pacientes'],
  ['pacientesApi.list con filtros', () => pacientesApi.list({ idMedico: 3, q: ' paz ' }), 'GET', '/pacientes?id_medico=3&q=paz'],
  ['pacientesApi.list ignora filtros vacíos', () => pacientesApi.list({ idMedico: ' ', q: '' }), 'GET', '/pacientes'],
  ['pacientesApi.crear', () => pacientesApi.crear({ dni: '1' }), 'POST', '/pacientes', { dni: '1' }],
  ['pacientesApi.buscarPorDni', () => pacientesApi.buscarPorDni('30111222'), 'GET', '/pacientes/buscar-dni/30111222'],
  ['pacientesApi.actualizar', () => pacientesApi.actualizar(7, { telefono: '1' }), 'PATCH', '/pacientes/7', { telefono: '1' }],
  ['pacientesApi.getHistorial', () => pacientesApi.getHistorial(7), 'GET', '/pacientes/7/historial'],
  ['pacientesApi.solicitarReceta', () => pacientesApi.solicitarReceta(3, { tipo: 'urgente' }), 'POST', '/pacientes/medicos/3/recetas', { tipo: 'urgente' }],
  ['pacientesApi.enviarMensaje', () => pacientesApi.enviarMensaje(3, { asunto: 'A' }), 'POST', '/pacientes/medicos/3/mensajes', { asunto: 'A' }],
  ['pacientesApi.getMiPerfil', () => pacientesApi.getMiPerfil(), 'GET', '/pacientes/me'],
  ['pacientesApi.actualizarMiPerfil', () => pacientesApi.actualizarMiPerfil({ telefono: '1' }), 'PATCH', '/pacientes/me', { telefono: '1' }],
  ['pacientesApi.listarObrasSociales', () => pacientesApi.listarObrasSociales(), 'GET', '/pacientes/obras-sociales'],
  ['pacientesApi.listarMisRecetas', () => pacientesApi.listarMisRecetas(), 'GET', '/pacientes/me/recetas'],
  ['pacientesApi.listarMisMensajes', () => pacientesApi.listarMisMensajes(), 'GET', '/pacientes/me/mensajes'],
  ['pacientesApi.getTycMedico', () => pacientesApi.getTycMedico(3), 'GET', '/pacientes/medicos/3/tyc'],
  ['pacientesApi.aceptarTycMedico', () => pacientesApi.aceptarTycMedico(3, 4), 'POST', '/pacientes/medicos/3/tyc/aceptar', { id_tyc: 4 }],

  ['turnosApi.crear', () => turnosApi.crear({ fecha: 'x' }), 'POST', '/turnos', { fecha: 'x' }],
  ['turnosApi.listarPorMedico', () => turnosApi.listarPorMedico({ idMedico: 3, desde: 'a', hasta: 'b' }), 'GET', '/turnos?desde=a&hasta=b&id_medico=3'],
  ['turnosApi.listarPorMedico sin médico', () => turnosApi.listarPorMedico({ desde: 'a', hasta: 'b' }), 'GET', '/turnos?desde=a&hasta=b'],
  ['turnosApi.listarHistorialPorMedico', () => turnosApi.listarHistorialPorMedico({ idMedico: 3, desde: 'a', hasta: 'b' }), 'GET', '/turnos/historial?desde=a&hasta=b&id_medico=3'],
  ['turnosApi.cambiarEstado', () => turnosApi.cambiarEstado(900, 'confirmado', 'ok'), 'PATCH', '/turnos/900/estado', { estado: 'confirmado', motivo: 'ok' }],
  ['turnosApi.cancelarPropio', () => turnosApi.cancelarPropio(900, 'Viaje'), 'PATCH', '/turnos/900/cancelar', { motivo: 'Viaje' }],
]

describe('endpoints de cada service', () => {
  it.each(ENDPOINTS)('%s', async (_name, call, method, path, body) => {
    respond([])
    await call()
    const sent = lastCall()
    expect(sent.method).toBe(method)
    expect(sent.url).toBe(`${BASE}${path}`)
    expect(sent.body).toEqual(body)
  })
})

describe('mapeos de respuesta', () => {
  it('medicosApi.list adapta las filas para la UI', async () => {
    respond([
      { id_medico: 1, nombre: 'Juan', apellido: 'Gómez', especialidad: 'Clínica', matricula: 'MP1', permite_turnos: 1 },
      { id_medico: 2, nombre: 'Ana', apellido: null, permite_turnos: 0 },
    ])

    await expect(medicosApi.list('juan pablo')).resolves.toEqual([
      { id: 1, nombre: 'Juan Gómez', especialidad: 'Clínica', matricula: 'MP1', consultorios: [], permiteTurnos: true },
      { id: 2, nombre: 'Ana', especialidad: 'Especialidad general', matricula: '-', consultorios: [], permiteTurnos: false },
    ])
    expect(lastCall().url).toBe(`${BASE}/medicos?q=juan%20pablo`)
  })

  it('medicosApi.getById pide un solo médico y lo adapta igual que list', async () => {
    respond({ id_medico: 3, nombre: 'Juan', apellido: 'Gómez', permite_turnos: 0 })
    await expect(medicosApi.getById(3)).resolves.toEqual({
      id: 3, nombre: 'Juan Gómez', especialidad: 'Especialidad general', matricula: '-', consultorios: [], permiteTurnos: false,
    })
    expect(lastCall().url).toBe(`${BASE}/medicos/3`)
  })

  it('medicosApi.list devuelve [] si la respuesta no es una lista', async () => {
    respond({ raro: true })
    await expect(medicosApi.list()).resolves.toEqual([])
    expect(lastCall().url).toBe(`${BASE}/medicos`)
  })

  it('turnosApi.listarMisTurnos adapta las filas para la UI', async () => {
    respond([
      { id_turno: 9, id_medico: 3, id_clinica: 8, fecha_iso: '2026-10-19', hora: '10:00', estado: 'pendiente', motivo: null, clinica_nombre: 'Centro', medico_nombre: 'Juan', medico_apellido: 'Gómez' },
    ])

    await expect(turnosApi.listarMisTurnos({ idMedico: 3 })).resolves.toEqual([
      { id: 9, doctorId: 3, clinicId: 8, dateIso: '2026-10-19', time: '10:00', status: 'pendiente', type: '', clinicName: 'Centro', doctorName: 'Juan Gómez' },
    ])
    expect(lastCall().url).toBe(`${BASE}/turnos/mis?id_medico=3`)
  })

  it('turnosApi.listarMisTurnos devuelve [] si la respuesta no es una lista', async () => {
    respond(null)
    await expect(turnosApi.listarMisTurnos()).resolves.toEqual([])
    expect(lastCall().url).toBe(`${BASE}/turnos/mis`)
  })
})
