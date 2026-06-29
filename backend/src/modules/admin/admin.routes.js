const { Router } = require('express')
const adminController = require('./admin.controller')
const { requireAuth, requireRoles } = require('../../middlewares/auth.middleware')

const router = Router()

router.get('/usuarios', requireAuth, requireRoles('admin'), adminController.listUsuarios)
router.get('/usuarios/:id_usuario', requireAuth, requireRoles('admin'), adminController.getUsuarioDetalle)
router.get('/finanzas', requireAuth, requireRoles('admin'), adminController.getFinanzas)
router.post('/membresias/reactivar', requireAuth, requireRoles('admin'), adminController.reactivateMembership)
// Debug endpoint - temporary
router.get('/debug/user-subscription/:email', adminController.getUserSubscription)

module.exports = router
