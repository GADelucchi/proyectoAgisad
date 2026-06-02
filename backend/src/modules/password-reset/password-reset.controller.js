const { requestPasswordReset, resetPassword } = require('./password-reset.service')

async function forgotPassword(req, res, next) {
  try {
    await requestPasswordReset(req.body.email)
    // Siempre 200 para no revelar si el email existe
    res.json({ message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' })
  } catch (err) {
    next(err)
  }
}

async function resetPasswordHandler(req, res, next) {
  try {
    await resetPassword(req.params.token, req.body.password)
    res.json({ message: 'Contraseña actualizada correctamente.' })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  forgotPassword,
  resetPassword: resetPasswordHandler,
}
