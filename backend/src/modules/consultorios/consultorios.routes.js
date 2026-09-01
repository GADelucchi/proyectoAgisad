const { Router } = require('express')
const controller = require('./consultorios.controller')
const { requireAuth, requireRoles } = require('../../middlewares/auth.middleware')

const router = Router()

// Directorio público de consultorios en alquiler
router.get('/publicos', controller.listPublicos)
router.get('/:id_clinica/disponibilidad-publica', controller.getDisponibilidadPublica)

// Lado dueño (propietario o médico que publicó un consultorio propio)
router.get('/mios', requireAuth, requireRoles('propietario', 'medico'), controller.listMisConsultorios)
router.post('/', requireAuth, requireRoles('propietario'), controller.crearConsultorio)
router.patch('/:id_clinica/publicar', requireAuth, requireRoles('medico'), controller.publicarConsultorio)
router.get('/solicitudes/recibidas', requireAuth, requireRoles('propietario', 'medico'), controller.listSolicitudesRecibidas)
router.patch('/solicitudes/:id_solicitud/aprobar', requireAuth, requireRoles('propietario', 'medico'), controller.aprobarSolicitud)
router.patch('/solicitudes/:id_solicitud/rechazar', requireAuth, requireRoles('propietario', 'medico'), controller.rechazarSolicitud)
router.get('/:id_clinica/disponibilidad', requireAuth, requireRoles('propietario', 'medico'), controller.getDisponibilidadConfig)
router.put('/:id_clinica/disponibilidad', requireAuth, requireRoles('propietario', 'medico'), controller.guardarDisponibilidad)
router.get('/:id_clinica/medicos', requireAuth, requireRoles('propietario', 'medico'), controller.listMedicosVinculados)
router.delete('/:id_clinica/medicos/:id_medico', requireAuth, requireRoles('propietario', 'medico'), controller.desvincularMedico)
router.get('/:id_clinica/reporte-uso', requireAuth, requireRoles('propietario', 'medico'), controller.reporteUso)

// Adicional pago para publicar consultorios propios
router.get('/adicional', requireAuth, requireRoles('medico'), controller.getEstadoAdicional)
router.post('/adicional', requireAuth, requireRoles('medico'), controller.solicitarAdicional)
router.delete('/adicional', requireAuth, requireRoles('medico'), controller.cancelarAdicional)

// Lado médico inquilino
router.get('/solicitudes/mias', requireAuth, requireRoles('medico'), controller.listMisSolicitudes)
router.post('/:id_clinica/solicitudes', requireAuth, requireRoles('medico'), controller.crearSolicitud)

module.exports = router
