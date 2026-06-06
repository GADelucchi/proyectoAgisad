const { Router } = require('express')
const turnosController = require('./turnos.controller')
const { requireAuth, requireRoles } = require('../../middlewares/auth.middleware')

const router = Router()

router.get('/mis', requireAuth, requireRoles('paciente'), turnosController.listarMisTurnos)
router.get('/', requireAuth, requireRoles('medico', 'asistente', 'admin', 'gerente'), turnosController.listarPorMedico)
router.post('/', requireAuth, requireRoles('paciente', 'asistente', 'medico', 'admin'), turnosController.crearTurno)
router.patch('/:id_turno/cancelar', requireAuth, requireRoles('paciente'), turnosController.cancelarPropio)
router.patch('/:id_turno/estado', requireAuth, requireRoles('medico', 'asistente', 'admin'), turnosController.cambiarEstado)

module.exports = router
