/**
 * Recorre todas las rutas de la API con los services mockeados y verifica:
 *  - que sin token responda 401 y con un rol no permitido 403,
 *  - que el controller llame al service con los argumentos correctos,
 *  - el status de éxito de cada endpoint.
 *
 * Si se agrega una ruta nueva, sumarla a la tabla ROUTES.
 */
jest.mock('../../src/utils/mailer', () => require('../mocks/mailer'))
jest.mock('../../src/db/pool', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }))

const SERVICES = {
  auth: '../../src/modules/auth/auth.service',
  passwordReset: '../../src/modules/password-reset/password-reset.service',
  emailVerification: '../../src/modules/email-verification/email-verification.service',
  medicos: '../../src/modules/medicos/medicos.service',
  turnos: '../../src/modules/turnos/turnos.service',
  pacientes: '../../src/modules/pacientes/pacientes.service',
  asistentes: '../../src/modules/asistentes/asistentes.service',
  admin: '../../src/modules/admin/admin.service',
  gerentes: '../../src/modules/gerentes/gerentes.service',
  consultorios: '../../src/modules/consultorios/consultorios.service',
}
jest.mock('../../src/modules/auth/auth.service')
jest.mock('../../src/modules/password-reset/password-reset.service')
jest.mock('../../src/modules/email-verification/email-verification.service')
jest.mock('../../src/modules/medicos/medicos.service')
jest.mock('../../src/modules/turnos/turnos.service')
jest.mock('../../src/modules/pacientes/pacientes.service')
jest.mock('../../src/modules/asistentes/asistentes.service')
jest.mock('../../src/modules/admin/admin.service')
jest.mock('../../src/modules/gerentes/gerentes.service')
jest.mock('../../src/modules/consultorios/consultorios.service')

const request = require('supertest')
const HttpError = require('../../src/utils/httpError')
const { authHeader } = require('../helpers/tokens')
const app = require('../../src/app')

const services = Object.fromEntries(Object.entries(SERVICES).map(([key, path]) => [key, require(path)]))

const ALL_ROLES = ['paciente', 'medico', 'asistente', 'gerente', 'propietario', 'admin']
const PUBLIC = 'public'
const ANY = 'any'

// requester tal como lo arman los controllers a partir del JWT de test
const who = (rol) => ({ requesterIdUsuario: 10, requesterRol: rol })
const jwtUser = (rol) => expect.objectContaining({ idUsuario: 10, rol, email: `${rol}@test.local` })
const DESDE = '2026-10-01'
const HASTA = '2026-10-31'

/* eslint-disable max-len */
const ROUTES = [
  // auth
  { method: 'post', path: '/api/auth/login', roles: PUBLIC, body: { email: 'a@x.com', password: 'p' }, service: ['auth', 'login'], args: () => [{ email: 'a@x.com', password: 'p' }] },
  { method: 'get', path: '/api/auth/me', roles: ANY, service: ['auth', 'getCurrentUser'], args: () => [10] },
  { method: 'post', path: '/api/auth/register/paciente', roles: PUBLIC, body: { a: 1 }, status: 201, service: ['auth', 'registerPaciente'], args: () => [{ a: 1 }] },
  { method: 'post', path: '/api/auth/register/medico', roles: PUBLIC, body: { a: 1 }, status: 201, service: ['auth', 'registerMedico'], args: () => [{ a: 1 }] },
  { method: 'post', path: '/api/auth/register/gerente', roles: PUBLIC, body: { a: 1 }, status: 201, service: ['auth', 'registerGerente'], args: () => [{ a: 1 }] },
  { method: 'post', path: '/api/auth/register/propietario', roles: PUBLIC, body: { a: 1 }, status: 201, service: ['auth', 'registerPropietario'], args: () => [{ a: 1 }] },
  { method: 'post', path: '/api/auth/forgot-password', roles: PUBLIC, body: { email: 'a@x.com' }, service: ['passwordReset', 'requestPasswordReset'], args: () => ['a@x.com'] },
  { method: 'post', path: '/api/auth/reset-password/tok', roles: PUBLIC, body: { password: 'clave1234' }, service: ['passwordReset', 'resetPassword'], args: () => ['tok', 'clave1234'] },
  { method: 'post', path: '/api/auth/verificar-email', roles: PUBLIC, body: { email: 'a@x.com', codigo: '123456' }, service: ['emailVerification', 'verificarCodigo'], args: () => [{ email: 'a@x.com', codigo: '123456' }] },
  { method: 'post', path: '/api/auth/verificar-email/reenviar', roles: PUBLIC, body: { email: 'a@x.com' }, status: 204, service: ['emailVerification', 'solicitarReenvio'], args: () => ['a@x.com'] },

  // médicos
  { method: 'get', path: '/api/medicos?q=paz&id_especialidad=2&id_ciudad=3', roles: PUBLIC, service: ['medicos', 'listMedicos'], args: () => [{ q: 'paz', idEspecialidad: 2, idCiudad: 3 }] },
  { method: 'get', path: '/api/medicos/3/clinicas', roles: PUBLIC, service: ['medicos', 'listClinicasByMedico'], args: () => [{ idMedico: 3 }] },
  { method: 'get', path: '/api/medicos/3/disponibilidad?id_clinica=8&fecha=2026-10-19&duracion_minutos=45', roles: PUBLIC, service: ['medicos', 'getDisponibilidad'], args: () => [{ idMedico: 3, idClinica: 8, fecha: '2026-10-19', duracionMinutos: 45 }] },
  { method: 'get', path: '/api/medicos/3', roles: PUBLIC, service: ['medicos', 'getMedicoPublico'], args: () => [{ idMedico: 3 }] },
  { method: 'get', path: `/api/medicos/3/disponibilidad-resumen?id_clinica=8&desde=${DESDE}&hasta=${HASTA}&duracion_minutos=45`, roles: PUBLIC, service: ['medicos', 'getResumenDisponibilidad'], args: () => [{ idMedico: 3, idClinica: 8, desde: DESDE, hasta: HASTA, duracionMinutos: 45 }] },
  { method: 'get', path: '/api/medicos/3/turnos-config', roles: PUBLIC, service: ['medicos', 'getTurnosConfigByMedico'], args: () => [{ idMedico: 3 }] },
  { method: 'get', path: '/api/medicos/me/clinicas', roles: ['medico'], service: ['medicos', 'listMyClinicas'], args: (r) => [who(r)] },
  { method: 'post', path: '/api/medicos/me/clinicas', roles: ['medico'], body: { nombre: 'C' }, status: 201, service: ['medicos', 'createMyClinica'], args: (r) => [{ input: { nombre: 'C' }, ...who(r) }] },
  { method: 'patch', path: '/api/medicos/me/clinicas/8', roles: ['medico'], body: { nombre: 'C' }, service: ['medicos', 'updateMyClinica'], args: (r) => [{ idClinica: 8, input: { nombre: 'C' }, ...who(r) }] },
  { method: 'delete', path: '/api/medicos/me/clinicas/8', roles: ['medico'], service: ['medicos', 'deleteMyClinica'], args: (r) => [{ idClinica: 8, ...who(r) }] },
  { method: 'get', path: '/api/medicos/me/disponibilidad?id_clinica=8&fecha=2026-10-19', roles: ['medico'], service: ['medicos', 'getMyDisponibilidad'], args: (r) => [{ idClinica: 8, fecha: '2026-10-19', ...who(r) }] },
  { method: 'get', path: '/api/medicos/me/turnos-config', roles: ['medico'], service: ['medicos', 'getMyTurnosConfig'], args: (r) => [who(r)] },
  { method: 'put', path: '/api/medicos/me/turnos-config', roles: ['medico'], body: { duracion_turno_estandar: 30 }, service: ['medicos', 'saveMyTurnosConfig'], args: (r) => [{ input: { duracion_turno_estandar: 30 }, ...who(r) }] },
  { method: 'get', path: '/api/medicos/me/bloqueos?id_clinica=8', roles: ['medico'], service: ['medicos', 'listMyBloqueos'], args: (r) => [{ idClinica: 8, ...who(r) }] },
  { method: 'post', path: '/api/medicos/me/bloqueos', roles: ['medico'], body: { fecha: '2026-10-19' }, status: 201, service: ['medicos', 'createMyBloqueo'], args: (r) => [{ input: { fecha: '2026-10-19' }, ...who(r) }] },
  { method: 'patch', path: '/api/medicos/me/bloqueos/4', roles: ['medico'], body: { fecha: '2026-10-19' }, service: ['medicos', 'updateMyBloqueo'], args: (r) => [{ idExcepcion: 4, input: { fecha: '2026-10-19' }, ...who(r) }] },
  { method: 'delete', path: '/api/medicos/me/bloqueos/4', roles: ['medico'], service: ['medicos', 'deleteMyBloqueo'], args: (r) => [{ idExcepcion: 4, ...who(r) }] },
  { method: 'get', path: '/api/medicos/me/recetas-solicitudes', roles: ['medico'], service: ['medicos', 'listMyRecetasSolicitudes'], args: (r) => [who(r)] },
  { method: 'patch', path: '/api/medicos/me/recetas-solicitudes/5/estado', roles: ['medico'], body: { estado: 'resuelta' }, service: ['medicos', 'updateMyRecetaSolicitudEstado'], args: (r) => [{ idSolicitud: 5, estado: 'resuelta', ...who(r) }] },
  { method: 'get', path: '/api/medicos/me/mail-config', roles: ['medico'], service: ['medicos', 'getMyMailConfig'], args: (r) => [who(r)] },
  { method: 'put', path: '/api/medicos/me/mail-config', roles: ['medico'], body: { notif_cancelacion: true }, service: ['medicos', 'saveMyMailConfig'], args: (r) => [{ input: { notif_cancelacion: true }, ...who(r) }] },
  { method: 'get', path: '/api/medicos/me/tyc', roles: ['medico'], service: ['medicos', 'getMyTyc'], args: (r) => [who(r)] },
  { method: 'post', path: '/api/medicos/me/tyc', roles: ['medico'], body: { texto: 'TyC' }, status: 201, service: ['medicos', 'saveMyTyc'], args: (r) => [{ texto: 'TyC', ...who(r) }] },

  // turnos
  { method: 'get', path: '/api/turnos/mis?id_medico=3', roles: ['paciente'], service: ['turnos', 'listarPorPaciente'], args: (r) => [{ idMedico: '3', requesterIdUsuario: 10, requesterRol: r }] },
  { method: 'get', path: `/api/turnos/historial?id_medico=3&desde=${DESDE}&hasta=${HASTA}`, roles: ['medico', 'asistente', 'admin', 'gerente'], service: ['turnos', 'listarHistorialPorMedico'], args: (r) => [{ idMedico: '3', desde: DESDE, hasta: HASTA, ...who(r) }] },
  { method: 'get', path: `/api/turnos?id_medico=3&desde=${DESDE}&hasta=${HASTA}`, roles: ['medico', 'asistente', 'admin', 'gerente'], service: ['turnos', 'listarPorMedico'], args: (r) => [{ idMedico: '3', desde: DESDE, hasta: HASTA, ...who(r) }] },
  { method: 'post', path: '/api/turnos', roles: ['paciente', 'asistente', 'medico', 'admin'], body: { fecha: '2026-10-19' }, status: 201, service: ['turnos', 'crearTurno'], args: (r) => [{ fecha: '2026-10-19' }, jwtUser(r)] },
  { method: 'patch', path: '/api/turnos/900/cancelar', roles: ['paciente'], body: { motivo: 'Viaje' }, service: ['turnos', 'cancelarPorPaciente'], args: (r) => [{ idTurno: '900', motivo: 'Viaje', ...who(r) }] },
  { method: 'patch', path: '/api/turnos/900/estado', roles: ['medico', 'asistente', 'admin'], body: { estado: 'confirmado', motivo: 'ok' }, service: ['turnos', 'cambiarEstado'], args: (r) => ['900', 'confirmado', jwtUser(r), 'ok'] },

  // pacientes
  { method: 'get', path: '/api/pacientes?id_medico=3&q=paz', roles: ['medico', 'asistente', 'admin'], service: ['pacientes', 'listPacientes'], args: (r) => [{ idMedico: '3', search: 'paz', ...who(r) }] },
  { method: 'post', path: '/api/pacientes', roles: ['medico', 'asistente'], body: { dni: '30111222' }, status: 201, service: ['pacientes', 'createPacienteManual'], args: (r) => [{ fields: { dni: '30111222' }, ...who(r) }] },
  { method: 'get', path: '/api/pacientes/me', roles: ['paciente'], service: ['pacientes', 'getMiPerfil'], args: () => [{ requesterIdUsuario: 10 }] },
  { method: 'patch', path: '/api/pacientes/me', roles: ['paciente'], body: { telefono: '1' }, service: ['pacientes', 'patchMiPerfil'], args: () => [{ fields: { telefono: '1' }, requesterIdUsuario: 10 }] },
  { method: 'get', path: '/api/pacientes/me/recetas', roles: ['paciente'], service: ['pacientes', 'listMisRecetas'], args: () => [{ requesterIdUsuario: 10 }] },
  { method: 'get', path: '/api/pacientes/me/mensajes', roles: ['paciente'], service: ['pacientes', 'listMisMensajes'], args: () => [{ requesterIdUsuario: 10 }] },
  { method: 'get', path: '/api/pacientes/obras-sociales', roles: ANY, service: ['pacientes', 'listCatalogoObrasSociales'], args: () => [] },
  { method: 'post', path: '/api/pacientes/medicos/3/recetas', roles: ['paciente'], body: { tipo: 'urgente', items: [{ medicamento: 'A' }] }, status: 201, service: ['pacientes', 'solicitarReceta'], args: (r) => [{ idMedico: '3', tipo: 'urgente', items: [{ medicamento: 'A' }], ...who(r) }] },
  { method: 'post', path: '/api/pacientes/medicos/3/mensajes', roles: ['paciente'], body: { asunto: 'A', mensaje: 'M' }, status: 201, service: ['pacientes', 'solicitarMensaje'], args: (r) => [{ idMedico: '3', asunto: 'A', mensaje: 'M', ...who(r) }] },
  { method: 'get', path: '/api/pacientes/medicos/3/tyc', roles: ['paciente'], service: ['pacientes', 'getTycByMedico'], args: (r) => [{ idMedico: '3', ...who(r) }] },
  { method: 'post', path: '/api/pacientes/medicos/3/tyc/aceptar', roles: ['paciente'], body: { id_tyc: 4 }, status: 201, service: ['pacientes', 'aceptarTycByMedico'], args: (r) => [{ idMedico: '3', idTyc: 4, ...who(r), ip: expect.any(String) }] },
  { method: 'get', path: '/api/pacientes/buscar-dni/30111222', roles: ['medico', 'asistente'], service: ['pacientes', 'buscarPacientePorDni'], args: (r) => [{ dni: '30111222', requesterRol: r }] },
  { method: 'get', path: '/api/pacientes/7', roles: ['paciente', 'medico', 'asistente', 'admin'], service: ['pacientes', 'getPaciente'], args: (r) => [{ idPaciente: '7', ...who(r) }] },
  { method: 'get', path: '/api/pacientes/7/historial', roles: ['medico', 'admin'], service: ['pacientes', 'getHistorialPaciente'], args: (r) => [{ idPaciente: '7', ...who(r) }] },
  { method: 'patch', path: '/api/pacientes/7', roles: ['paciente', 'medico', 'admin'], body: { telefono: '1' }, service: ['pacientes', 'patchPaciente'], args: (r) => [{ idPaciente: '7', fields: { telefono: '1' }, ...who(r) }] },

  // asistentes
  { method: 'get', path: '/api/asistentes/me/access', roles: ['asistente'], service: ['asistentes', 'getMyAccess'], args: (r) => [who(r)] },
  { method: 'post', path: '/api/asistentes', roles: ['medico', 'gerente', 'admin'], body: { email: 'a@x.com' }, status: 201, service: ['asistentes', 'createAsistente'], args: (r) => [{ email: 'a@x.com' }, jwtUser(r)] },
  { method: 'get', path: '/api/asistentes?id_medico=3', roles: ['medico', 'admin'], service: ['asistentes', 'listAsistentes'], args: (r) => [{ idMedico: '3', ...who(r) }] },
  { method: 'get', path: '/api/asistentes/9', roles: ['medico', 'asistente', 'admin'], service: ['asistentes', 'getAsistente'], args: (r) => [{ idAsistente: '9', ...who(r) }] },
  { method: 'patch', path: '/api/asistentes/9/permisos?id_medico=3', roles: ['medico', 'admin'], body: { agenda: true }, service: ['asistentes', 'patchPermisos'], args: (r) => [{ idAsistente: '9', idMedico: '3', permisos: { agenda: true }, ...who(r) }] },

  // admin
  { method: 'get', path: '/api/admin/usuarios?q=ana&rol=medico&suscripcion=activa', roles: ['admin'], service: ['admin', 'listUsuarios'], args: () => [{ q: 'ana', rol: 'medico', suscripcion: 'activa' }] },
  { method: 'get', path: '/api/admin/usuarios/5', roles: ['admin'], service: ['admin', 'getUsuarioDetalle'], args: () => ['5'] },
  { method: 'get', path: '/api/admin/finanzas', roles: ['admin'], service: ['admin', 'getFinanzas'], args: () => [] },
  { method: 'post', path: '/api/admin/membresias/reactivar', roles: ['admin'], body: { id_usuario: 5 }, status: 201, service: ['admin', 'reactivateMembership'], args: () => [{ id_usuario: 5 }] },

  // gerentes
  { method: 'get', path: '/api/gerentes/me/clinicas', roles: ['gerente'], service: ['gerentes', 'listMisClinicas'], args: (r) => [who(r)] },
  { method: 'post', path: '/api/gerentes/invitaciones', roles: ['gerente'], body: { id_clinica: 11, email: 'd@x.com' }, status: 201, service: ['gerentes', 'crearInvitacion'], args: (r) => [{ idClinica: 11, email: 'd@x.com', ...who(r) }] },
  { method: 'get', path: '/api/gerentes/invitaciones', roles: ['gerente'], service: ['gerentes', 'listInvitaciones'], args: (r) => [who(r)] },
  { method: 'delete', path: '/api/gerentes/invitaciones/4', roles: ['gerente'], status: 204, service: ['gerentes', 'revocarInvitacion'], args: (r) => [{ idInvitacion: '4', ...who(r) }] },
  { method: 'get', path: '/api/gerentes/medicos', roles: ['gerente'], service: ['gerentes', 'listMedicosEquipo'], args: (r) => [who(r)] },
  { method: 'delete', path: '/api/gerentes/medicos/3?id_clinica=11', roles: ['gerente'], status: 204, service: ['gerentes', 'desvincularMedico'], args: (r) => [{ idMedico: '3', idClinica: '11', ...who(r) }] },
  { method: 'get', path: '/api/gerentes/invitaciones/tok', roles: PUBLIC, service: ['gerentes', 'getInvitacionPublica'], args: () => ['tok'] },
  { method: 'post', path: '/api/gerentes/invitaciones/tok/aceptar', roles: ANY, service: ['gerentes', 'aceptarInvitacionAutenticado'], args: (r) => [{ token: 'tok', ...who(r), requesterEmail: `${r}@test.local` }] },
  { method: 'post', path: '/api/gerentes/invitaciones/tok/registrar', roles: PUBLIC, body: { nombre: 'Juan' }, status: 201, service: ['gerentes', 'registrarViaInvitacion'], args: () => [{ token: 'tok', datosMedico: { nombre: 'Juan' } }] },

  // consultorios
  { method: 'get', path: '/api/consultorios/publicos', roles: PUBLIC, service: ['consultorios', 'listPublicos'], args: () => [] },
  { method: 'get', path: '/api/consultorios/11/disponibilidad-publica?fecha=2026-10-19&duracion_minutos=45', roles: PUBLIC, service: ['consultorios', 'getDisponibilidadCompartida'], args: () => [{ idClinica: '11', fecha: '2026-10-19', duracionMinutos: '45' }] },
  { method: 'get', path: '/api/consultorios/mios', roles: ['propietario', 'medico'], service: ['consultorios', 'listMisConsultorios'], args: (r) => [who(r)] },
  { method: 'post', path: '/api/consultorios', roles: ['propietario'], body: { nombre: 'Sala' }, status: 201, service: ['consultorios', 'crearConsultorio'], args: (r) => [{ input: { nombre: 'Sala' }, ...who(r) }] },
  { method: 'patch', path: '/api/consultorios/21/publicar', roles: ['medico'], body: {}, service: ['consultorios', 'publicarConsultorio'], args: (r) => [{ idClinica: 21, publicar: true, ...who(r) }] },
  { method: 'get', path: '/api/consultorios/solicitudes/recibidas', roles: ['propietario', 'medico'], service: ['consultorios', 'listSolicitudesRecibidas'], args: (r) => [who(r)] },
  { method: 'patch', path: '/api/consultorios/solicitudes/9/aprobar', roles: ['propietario', 'medico'], service: ['consultorios', 'resolverSolicitud'], args: (r) => [{ idSolicitud: '9', aprobar: true, ...who(r) }] },
  { method: 'patch', path: '/api/consultorios/solicitudes/9/rechazar', roles: ['propietario', 'medico'], body: { motivo: 'No' }, service: ['consultorios', 'resolverSolicitud'], args: (r) => [{ idSolicitud: '9', aprobar: false, motivo: 'No', ...who(r) }] },
  { method: 'get', path: '/api/consultorios/11/disponibilidad', roles: ['propietario', 'medico'], service: ['consultorios', 'getDisponibilidadConfig'], args: (r) => [{ idClinica: '11', ...who(r) }] },
  { method: 'put', path: '/api/consultorios/11/disponibilidad', roles: ['propietario', 'medico'], body: { rangos: [] }, service: ['consultorios', 'guardarDisponibilidad'], args: (r) => [{ idClinica: '11', input: { rangos: [] }, ...who(r) }] },
  { method: 'get', path: '/api/consultorios/11/medicos', roles: ['propietario', 'medico'], service: ['consultorios', 'listMedicosVinculados'], args: (r) => [{ idClinica: '11', ...who(r) }] },
  { method: 'delete', path: '/api/consultorios/11/medicos/3', roles: ['propietario', 'medico'], status: 204, service: ['consultorios', 'desvincularMedico'], args: (r) => [{ idClinica: '11', idMedico: '3', ...who(r) }] },
  { method: 'get', path: `/api/consultorios/11/reporte-uso?desde=${DESDE}&hasta=${HASTA}`, roles: ['propietario', 'medico'], service: ['consultorios', 'reporteUso'], args: (r) => [{ idClinica: '11', desde: DESDE, hasta: HASTA, ...who(r) }] },
  { method: 'get', path: '/api/consultorios/adicional', roles: ['medico'], service: ['consultorios', 'getEstadoAdicional'], args: (r) => [who(r)] },
  { method: 'post', path: '/api/consultorios/adicional', roles: ['medico'], status: 201, service: ['consultorios', 'solicitarAdicional'], args: (r) => [who(r)] },
  { method: 'delete', path: '/api/consultorios/adicional', roles: ['medico'], service: ['consultorios', 'cancelarAdicional'], args: (r) => [who(r)] },
  { method: 'get', path: '/api/consultorios/solicitudes/mias', roles: ['medico'], service: ['consultorios', 'listMisSolicitudes'], args: (r) => [who(r)] },
  { method: 'post', path: '/api/consultorios/11/solicitudes', roles: ['medico'], body: { mensaje: 'Hola' }, status: 201, service: ['consultorios', 'crearSolicitud'], args: (r) => [{ idClinica: '11', mensaje: 'Hola', ...who(r) }] },
]
/* eslint-enable max-len */

const label = (route) => `${route.method.toUpperCase()} ${route.path.split('?')[0]}`

function send(route, rol) {
  let req = request(app)[route.method](route.path)
  if (rol) req = req.set('Authorization', authHeader(rol))
  if (route.body) req = req.send(route.body)
  return req
}

beforeEach(() => {
  for (const service of Object.values(services)) {
    for (const fn of Object.values(service)) {
      if (jest.isMockFunction(fn)) fn.mockResolvedValue({ ok: true })
    }
  }
})

describe('autenticación y roles', () => {
  const protegidas = ROUTES.filter((r) => r.roles !== PUBLIC)

  it.each(protegidas.map((r) => [label(r), r]))('%s sin token responde 401', async (_label, route) => {
    const res = await send(route)
    expect(res.status).toBe(401)
    expect(services[route.service[0]][route.service[1]]).not.toHaveBeenCalled()
  })

  const conRoles = ROUTES.filter((r) => Array.isArray(r.roles))
  const casosProhibidos = conRoles.flatMap((r) => ALL_ROLES.filter((rol) => !r.roles.includes(rol)).map((rol) => [label(r), rol, r]))

  it.each(casosProhibidos)('%s con rol %s responde 403', async (_label, rol, route) => {
    const res = await send(route, rol)
    expect(res.status).toBe(403)
    expect(services[route.service[0]][route.service[1]]).not.toHaveBeenCalled()
  })
})

describe('controllers', () => {
  const casos = ROUTES.flatMap((route) => {
    const roles = Array.isArray(route.roles) ? route.roles : route.roles === ANY ? ['medico'] : [null]
    return roles.map((rol) => [label(route), rol || 'público', route, rol])
  })

  it.each(casos)('%s (%s) llama al service y responde', async (_label, _rolLabel, route, rol) => {
    const res = await send(route, rol)

    expect(res.status).toBe(route.status || 200)
    const fn = services[route.service[0]][route.service[1]]
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0]).toEqual(route.args(rol))
  })
})

describe('errores del service', () => {
  const casos = ROUTES.map((route) => {
    const rol = Array.isArray(route.roles) ? route.roles[0] : route.roles === ANY ? 'medico' : null
    return [label(route), route, rol]
  })

  it.each(casos)('%s propaga el HttpError del service', async (_label, route, rol) => {
    services[route.service[0]][route.service[1]].mockRejectedValue(new HttpError(418, 'falla controlada'))
    const res = await send(route, rol)
    expect(res.status).toBe(418)
    expect(res.body.message).toBe('falla controlada')
  })
})

describe('respuestas especiales de controllers', () => {
  it('forgot-password responde 200 aunque el email no exista', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nadie@x.com' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/Si el email existe/)
  })

  it('el alta manual de un paciente existente responde 200 en vez de 201', async () => {
    services.pacientes.createPacienteManual.mockResolvedValue({ id_paciente: 1, ya_existia: true })
    const res = await request(app).post('/api/pacientes').set('Authorization', authHeader('medico')).send({ dni: '30111222' })
    expect(res.status).toBe(200)
  })

  it('buscar por DNI responde 404 si no hay paciente', async () => {
    services.pacientes.buscarPacientePorDni.mockResolvedValue(null)
    const res = await request(app).get('/api/pacientes/buscar-dni/30111222').set('Authorization', authHeader('medico'))
    expect(res.status).toBe(404)
  })

  it('despublicar un consultorio manda publicar=false', async () => {
    await request(app).patch('/api/consultorios/21/publicar').set('Authorization', authHeader('medico')).send({ publicar: false })
    expect(services.consultorios.publicarConsultorio).toHaveBeenCalledWith(expect.objectContaining({ publicar: false }))
  })

  it('un HttpError del service se traduce a su status', async () => {
    services.turnos.crearTurno.mockRejectedValue(new HttpError(409, 'Ese horario ya fue tomado', { code: 'X' }))
    const res = await request(app).post('/api/turnos').set('Authorization', authHeader('paciente')).send({})
    expect(res.status).toBe(409)
    expect(res.body).toEqual({ message: 'Ese horario ya fue tomado', details: { code: 'X' } })
  })

  it('un error inesperado responde 500 sin filtrar detalles', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    services.medicos.listMedicos.mockRejectedValue(new Error('ER_ACCESS_DENIED for user root'))
    const res = await request(app).get('/api/medicos')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ message: 'Error interno del servidor' })
  })

  it('el endpoint de debug de suscripciones ya no existe', async () => {
    const res = await request(app).get('/api/admin/debug/user-subscription/a@x.com')
    expect(res.status).toBe(404)
  })
})
