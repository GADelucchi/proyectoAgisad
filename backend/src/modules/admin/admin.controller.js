const adminService = require('./admin.service')

async function listUsuarios(req, res, next) {
  try {
    const data = await adminService.listUsuarios({
      q: req.query.q,
      rol: req.query.rol,
      suscripcion: req.query.suscripcion,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getUsuarioDetalle(req, res, next) {
  try {
    const data = await adminService.getUsuarioDetalle(req.params.id_usuario)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getFinanzas(req, res, next) {
  try {
    const data = await adminService.getFinanzas()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getUserSubscription(req, res, next) {
  try {
    const data = await adminService.getUserSubscription(req.params.email)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function reactivateMembership(req, res, next) {
  try {
    const data = await adminService.reactivateMembership(req.body)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function listAdicionalesConsultorio(req, res, next) {
  try {
    const data = await adminService.listAdicionalesConsultorio(req.query.estado)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function activarAdicionalConsultorio(req, res, next) {
  try {
    const data = await adminService.resolverAdicionalConsultorio({
      idAdicional: req.params.id_adicional,
      aprobar: true,
      idUsuarioAdmin: req.user.idUsuario,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function rechazarAdicionalConsultorio(req, res, next) {
  try {
    const data = await adminService.resolverAdicionalConsultorio({
      idAdicional: req.params.id_adicional,
      aprobar: false,
      idUsuarioAdmin: req.user.idUsuario,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listUsuarios,
  getUsuarioDetalle,
  getFinanzas,
  getUserSubscription,
  reactivateMembership,
  listAdicionalesConsultorio,
  activarAdicionalConsultorio,
  rechazarAdicionalConsultorio,
}
