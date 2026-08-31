const { Router } = require('express')
const { requireAuth, requireRoles } = require('../../middlewares/auth.middleware')
const ctrl = require('./pacientes.controller')

const router = Router()

// GET /api/pacientes?id_medico=X&q=texto
router.get(
  '/',
  requireAuth,
  requireRoles('medico', 'asistente', 'admin'),
  ctrl.list
)

// POST /api/pacientes -> alta manual desde el panel del médico
router.post(
  '/',
  requireAuth,
  requireRoles('medico', 'asistente'),
  ctrl.create
)

// Panel del paciente autenticado. Declaradas antes de /:id para que no las capture.
router.get('/me', requireAuth, requireRoles('paciente'), ctrl.getMe)
router.patch('/me', requireAuth, requireRoles('paciente'), ctrl.patchMe)
router.get('/me/recetas', requireAuth, requireRoles('paciente'), ctrl.listMyRecetas)
router.get('/me/mensajes', requireAuth, requireRoles('paciente'), ctrl.listMyMensajes)
router.get('/obras-sociales', requireAuth, ctrl.listObrasSociales)

// POST /api/pacientes/medicos/:id_medico/recetas
router.post(
  '/medicos/:id_medico/recetas',
  requireAuth,
  requireRoles('paciente'),
  ctrl.requestReceta
)

router.post(
  '/medicos/:id_medico/mensajes',
  requireAuth,
  requireRoles('paciente'),
  ctrl.requestMensaje
)

router.get(
  '/medicos/:id_medico/tyc',
  requireAuth,
  requireRoles('paciente'),
  ctrl.getTyc
)

router.post(
  '/medicos/:id_medico/tyc/aceptar',
  requireAuth,
  requireRoles('paciente'),
  ctrl.acceptTyc
)

// GET /api/pacientes/buscar-dni/:dni -> autocompletar alta manual si ya existe
router.get(
  '/buscar-dni/:dni',
  requireAuth,
  requireRoles('medico', 'asistente'),
  ctrl.buscarPorDni
)

// GET /api/pacientes/:id
router.get(
  '/:id',
  requireAuth,
  requireRoles('paciente', 'medico', 'asistente', 'admin'),
  ctrl.getOne
)

// GET /api/pacientes/:id/historial -> turnos/recetas/mensajes con ese médico
router.get(
  '/:id/historial',
  requireAuth,
  requireRoles('medico', 'admin'),
  ctrl.getHistorial
)

// PATCH /api/pacientes/:id
router.patch(
  '/:id',
  requireAuth,
  requireRoles('paciente', 'medico', 'admin'),
  ctrl.patch
)

module.exports = router
