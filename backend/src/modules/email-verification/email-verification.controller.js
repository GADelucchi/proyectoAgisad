const { solicitarReenvio, verificarCodigo } = require('./email-verification.service')

async function resend(req, res, next) {
  try {
    await solicitarReenvio(req.body?.email)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

async function verify(req, res, next) {
  try {
    const data = await verificarCodigo({
      email: req.body?.email,
      codigo: req.body?.codigo,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  resend,
  verify,
}
