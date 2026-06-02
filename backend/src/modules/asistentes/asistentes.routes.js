const { Router } = require('express')
const { requireAuth, requireRoles } = require('../../middlewares/auth.middleware')
const ctrl = require('./asistentes.controller')

const router = Router()

// GET /api/asistentes?id_medico=X
router.get(
  '/',
  requireAuth,
  requireRoles('medico', 'admin'),
  ctrl.list
)

// GET /api/asistentes/:id
router.get(
  '/:id',
  requireAuth,
  requireRoles('medico', 'asistente', 'admin'),
  ctrl.getOne
)

// PATCH /api/asistentes/:id/permisos?id_medico=X
router.patch(
  '/:id/permisos',
  requireAuth,
  requireRoles('medico', 'admin'),
  ctrl.updatePermisos
)

module.exports = router
