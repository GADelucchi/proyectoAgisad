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

// GET /api/pacientes/:id
router.get(
  '/:id',
  requireAuth,
  requireRoles('paciente', 'medico', 'asistente', 'admin'),
  ctrl.getOne
)

// PATCH /api/pacientes/:id
router.patch(
  '/:id',
  requireAuth,
  requireRoles('paciente', 'admin'),
  ctrl.patch
)

module.exports = router
