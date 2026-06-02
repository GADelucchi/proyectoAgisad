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

module.exports = {
  listMedicos,
  getDisponibilidad,
}
