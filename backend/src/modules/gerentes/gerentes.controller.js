const service = require('./gerentes.service')

async function listMisClinicas(req, res, next) {
  try {
    const data = await service.listMisClinicas({
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function crearInvitacion(req, res, next) {
  try {
    const data = await service.crearInvitacion({
      idClinica: req.body?.id_clinica,
      email: req.body?.email,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function listInvitaciones(req, res, next) {
  try {
    const data = await service.listInvitaciones({
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function revocarInvitacion(req, res, next) {
  try {
    await service.revocarInvitacion({
      idInvitacion: req.params.id,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

async function listMedicosEquipo(req, res, next) {
  try {
    const data = await service.listMedicosEquipo({
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function desvincularMedico(req, res, next) {
  try {
    await service.desvincularMedico({
      idMedico: req.params.id_medico,
      idClinica: req.query.id_clinica,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

async function getInvitacionPublica(req, res, next) {
  try {
    const data = await service.getInvitacionPublica(req.params.token)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function aceptarInvitacion(req, res, next) {
  try {
    const data = await service.aceptarInvitacionAutenticado({
      token: req.params.token,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
      requesterEmail: req.user.email,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function registrarViaInvitacion(req, res, next) {
  try {
    const data = await service.registrarViaInvitacion({
      token: req.params.token,
      datosMedico: req.body,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listMisClinicas,
  crearInvitacion,
  listInvitaciones,
  revocarInvitacion,
  listMedicosEquipo,
  desvincularMedico,
  getInvitacionPublica,
  aceptarInvitacion,
  registrarViaInvitacion,
}
