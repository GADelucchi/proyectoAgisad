const { Router } = require('express')
const authController = require('./auth.controller')
const passwordResetController = require('../password-reset/password-reset.controller')
const { loginFailedAttemptsLimiter } = require('../../middlewares/rateLimit.middleware')
const { requireAuth } = require('../../middlewares/auth.middleware')

const router = Router()

router.post('/login', loginFailedAttemptsLimiter, authController.login)
router.get('/me', requireAuth, authController.me)
router.post('/register/paciente', authController.registerPaciente)
router.post('/register/medico', authController.registerMedico)
router.post('/register/gerente', authController.registerGerente)
router.post('/forgot-password', passwordResetController.forgotPassword)
router.post('/reset-password/:token', passwordResetController.resetPassword)

module.exports = router
