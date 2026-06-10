const { listAsistentes, getAsistente, patchPermisos, createAsistente, getMyAccess } = require('./asistentes.service')

async function list(req, res, next) {
  try {
    const { id_medico } = req.query
    const data = await listAsistentes({
      idMedico: id_medico,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getOne(req, res, next) {
  try {
    const data = await getAsistente({
      idAsistente: req.params.id,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function updatePermisos(req, res, next) {
  try {
    const data = await patchPermisos({
      idAsistente: req.params.id,
      idMedico: req.query.id_medico || req.body.id_medico,
      permisos: req.body,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const data = await createAsistente(req.body, req.user)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function meAccess(req, res, next) {
  try {
    const data = await getMyAccess({
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = { list, getOne, updatePermisos, create, meAccess }
