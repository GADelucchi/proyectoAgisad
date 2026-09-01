const { Router } = require('express')
const adminController = require('./admin.controller')
const { requireAuth, requireRoles } = require('../../middlewares/auth.middleware')

const router = Router()

router.get('/usuarios', requireAuth, requireRoles('admin'), adminController.listUsuarios)
router.get('/usuarios/:id_usuario', requireAuth, requireRoles('admin'), adminController.getUsuarioDetalle)
router.get('/finanzas', requireAuth, requireRoles('admin'), adminController.getFinanzas)
router.post('/membresias/reactivar', requireAuth, requireRoles('admin'), adminController.reactivateMembership)
router.get('/adicionales-consultorio', requireAuth, requireRoles('admin'), adminController.listAdicionalesConsultorio)
router.patch('/adicionales-consultorio/:id_adicional/activar', requireAuth, requireRoles('admin'), adminController.activarAdicionalConsultorio)
router.patch('/adicionales-consultorio/:id_adicional/rechazar', requireAuth, requireRoles('admin'), adminController.rechazarAdicionalConsultorio)
// Debug endpoint - temporary
router.get('/debug/user-subscription/:email', adminController.getUserSubscription)

module.exports = router
