const { listPacientes, getPaciente, patchPaciente, solicitarReceta } = require('./pacientes.service')

async function list(req, res, next) {
  try {
    const { id_medico, q } = req.query
    const data = await listPacientes({
      idMedico: id_medico,
      search: q,
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
    const data = await getPaciente({
      idPaciente: req.params.id,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function patch(req, res, next) {
  try {
    const data = await patchPaciente({
      idPaciente: req.params.id,
      fields: req.body,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function requestReceta(req, res, next) {
  try {
    const data = await solicitarReceta({
      idMedico: req.params.id_medico,
      tipo: req.body?.tipo,
      items: req.body?.items,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = { list, getOne, patch, requestReceta }
