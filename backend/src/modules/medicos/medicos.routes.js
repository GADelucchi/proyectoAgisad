const { Router } = require('express')
const medicosController = require('./medicos.controller')

const router = Router()

router.get('/', medicosController.listMedicos)
router.get('/:id_medico/disponibilidad', medicosController.getDisponibilidad)

module.exports = router
