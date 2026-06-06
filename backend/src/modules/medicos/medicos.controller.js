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

module.exports = {
  listMedicos,
  getDisponibilidad,
  getMyTyc,
  saveMyTyc,
  listClinicas,
}
