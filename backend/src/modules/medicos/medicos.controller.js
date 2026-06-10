const medicosService = require('./medicos.service')

async function listMedicos(req, res, next) {
  try {
    const data = await medicosService.listMedicos({
      q: req.query.q,
      idEspecialidad: req.query.id_especialidad ? Number(req.query.id_especialidad) : null,
      idCiudad: req.query.id_ciudad ? Number(req.query.id_ciudad) : null,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getDisponibilidad(req, res, next) {
  try {
    const data = await medicosService.getDisponibilidad({
      idMedico: Number(req.params.id_medico),
      idClinica: Number(req.query.id_clinica),
      fecha: req.query.fecha,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getMyTyc(req, res, next) {
  try {
    const data = await medicosService.getMyTyc({
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function saveMyTyc(req, res, next) {
  try {
    const data = await medicosService.saveMyTyc({
      texto: req.body?.texto,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function listClinicas(req, res, next) {
  try {
    const data = await medicosService.listClinicasByMedico({
      idMedico: Number(req.params.id_medico),
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listMyClinicas(req, res, next) {
  try {
    const data = await medicosService.listMyClinicas({
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function createMyClinica(req, res, next) {
  try {
    const data = await medicosService.createMyClinica({
      input: req.body,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function updateMyClinica(req, res, next) {
  try {
    const data = await medicosService.updateMyClinica({
      idClinica: Number(req.params.id_clinica),
      input: req.body,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function deleteMyClinica(req, res, next) {
  try {
    const data = await medicosService.deleteMyClinica({
      idClinica: Number(req.params.id_clinica),
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listMyBloqueos(req, res, next) {
  try {
    const data = await medicosService.listMyBloqueos({
      idClinica: req.query.id_clinica ? Number(req.query.id_clinica) : null,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function createMyBloqueo(req, res, next) {
  try {
    const data = await medicosService.createMyBloqueo({
      input: req.body,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function updateMyBloqueo(req, res, next) {
  try {
    const data = await medicosService.updateMyBloqueo({
      idExcepcion: Number(req.params.id_excepcion),
      input: req.body,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function deleteMyBloqueo(req, res, next) {
  try {
    const data = await medicosService.deleteMyBloqueo({
      idExcepcion: Number(req.params.id_excepcion),
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listMedicos,
  getDisponibilidad,
  getMyTyc,
  saveMyTyc,
  listClinicas,
  listMyClinicas,
  createMyClinica,
  updateMyClinica,
  deleteMyClinica,
  listMyBloqueos,
  createMyBloqueo,
  updateMyBloqueo,
  deleteMyBloqueo,
}
