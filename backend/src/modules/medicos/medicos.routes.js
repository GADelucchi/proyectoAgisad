const { Router } = require('express')
const medicosController = require('./medicos.controller')
const { requireAuth, requireRoles } = require('../../middlewares/auth.middleware')

const router = Router()

router.get('/', medicosController.listMedicos)
router.get('/me/clinicas', requireAuth, requireRoles('medico'), medicosController.listMyClinicas)
router.post('/me/clinicas', requireAuth, requireRoles('medico'), medicosController.createMyClinica)
router.patch('/me/clinicas/:id_clinica', requireAuth, requireRoles('medico'), medicosController.updateMyClinica)
router.delete('/me/clinicas/:id_clinica', requireAuth, requireRoles('medico'), medicosController.deleteMyClinica)
router.get('/me/bloqueos', requireAuth, requireRoles('medico'), medicosController.listMyBloqueos)
router.post('/me/bloqueos', requireAuth, requireRoles('medico'), medicosController.createMyBloqueo)
router.patch('/me/bloqueos/:id_excepcion', requireAuth, requireRoles('medico'), medicosController.updateMyBloqueo)
router.delete('/me/bloqueos/:id_excepcion', requireAuth, requireRoles('medico'), medicosController.deleteMyBloqueo)
router.get('/:id_medico/clinicas', medicosController.listClinicas)
router.get('/:id_medico/disponibilidad', medicosController.getDisponibilidad)
router.get('/me/tyc', requireAuth, requireRoles('medico'), medicosController.getMyTyc)
router.post('/me/tyc', requireAuth, requireRoles('medico'), medicosController.saveMyTyc)

module.exports = router
