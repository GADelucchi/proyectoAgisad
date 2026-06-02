const { Router } = require('express')

const healthRoutes = require('./health.routes')
const authRoutes = require('../modules/auth/auth.routes')
const medicosRoutes = require('../modules/medicos/medicos.routes')
const turnosRoutes = require('../modules/turnos/turnos.routes')
const pacientesRoutes = require('../modules/pacientes/pacientes.routes')
const asistentesRoutes = require('../modules/asistentes/asistentes.routes')
const adminRoutes = require('../modules/admin/admin.routes')

const router = Router()

router.use('/health', healthRoutes)
router.use('/auth', authRoutes)
router.use('/medicos', medicosRoutes)
router.use('/turnos', turnosRoutes)
router.use('/pacientes', pacientesRoutes)
router.use('/asistentes', asistentesRoutes)
router.use('/admin', adminRoutes)

module.exports = router
