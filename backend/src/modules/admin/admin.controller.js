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

module.exports = {
  listUsuarios,
  getUsuarioDetalle,
  getFinanzas,
}
