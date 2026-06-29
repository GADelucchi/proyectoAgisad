const authService = require('./auth.service')

async function login(req, res, next) {
  try {
    const payload = await authService.login(req.body)
    res.json(payload)
  } catch (err) {
    next(err)
  }
}

async function me(req, res, next) {
  try {
    const payload = await authService.getCurrentUser(req.user.idUsuario)
    res.json(payload)
  } catch (err) {
    next(err)
  }
}

async function registerPaciente(req, res, next) {
  try {
    const payload = await authService.registerPaciente(req.body)
    res.status(201).json(payload)
  } catch (err) {
    next(err)
  }
}

async function registerMedico(req, res, next) {
  try {
    const payload = await authService.registerMedico(req.body)
    res.status(201).json(payload)
  } catch (err) {
    next(err)
  }
}

async function registerGerente(req, res, next) {
  try {
    const payload = await authService.registerGerente(req.body)
    res.status(201).json(payload)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  login,
  me,
  registerPaciente,
  registerMedico,
  registerGerente,
}
