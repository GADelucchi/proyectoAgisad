const { Router } = require('express')
const gerentesController = require('./gerentes.controller')
const { requireAuth, requireRoles } = require('../../middlewares/auth.middleware')

const router = Router()

// Gestión del gerente sobre su(s) clínica(s)
router.get('/me/clinicas', requireAuth, requireRoles('gerente'), gerentesController.listMisClinicas)
router.post('/invitaciones', requireAuth, requireRoles('gerente'), gerentesController.crearInvitacion)
router.get('/invitaciones', requireAuth, requireRoles('gerente'), gerentesController.listInvitaciones)
router.delete('/invitaciones/:id', requireAuth, requireRoles('gerente'), gerentesController.revocarInvitacion)
router.get('/medicos', requireAuth, requireRoles('gerente'), gerentesController.listMedicosEquipo)
router.delete('/medicos/:id_medico', requireAuth, requireRoles('gerente'), gerentesController.desvincularMedico)

// Consumo público del link de invitación
router.get('/invitaciones/:token', gerentesController.getInvitacionPublica)
router.post('/invitaciones/:token/aceptar', requireAuth, gerentesController.aceptarInvitacion)
router.post('/invitaciones/:token/registrar', gerentesController.registrarViaInvitacion)

module.exports = router
