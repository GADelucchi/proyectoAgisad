const { Router } = require('express')
const medicosController = require('./medicos.controller')
const { requireAuth, requireRoles } = require('../../middlewares/auth.middleware')

const router = Router()

router.get('/', medicosController.listMedicos)
router.get('/:id_medico/clinicas', medicosController.listClinicas)
router.get('/:id_medico/disponibilidad', medicosController.getDisponibilidad)
router.get('/me/tyc', requireAuth, requireRoles('medico'), medicosController.getMyTyc)
router.post('/me/tyc', requireAuth, requireRoles('medico'), medicosController.saveMyTyc)

module.exports = router
