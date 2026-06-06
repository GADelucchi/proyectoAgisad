const turnosService = require('./turnos.service')

async function crearTurno(req, res, next) {
  try {
    const payload = await turnosService.crearTurno(req.body, req.user)
    res.status(201).json(payload)
  } catch (err) {
    next(err)
  }
}

async function cambiarEstado(req, res, next) {
  try {
    const payload = await turnosService.cambiarEstado(
      req.params.id_turno,
      req.body.estado,
      req.user,
      req.body.motivo
    )
    res.json(payload)
  } catch (err) {
    next(err)
  }
}

async function listarPorMedico(req, res, next) {
  try {
    const payload = await turnosService.listarPorMedico({
      idMedico: req.query.id_medico,
      desde: req.query.desde,
      hasta: req.query.hasta,
    })
    res.json(payload)
  } catch (err) {
    next(err)
  }
}

async function listarMisTurnos(req, res, next) {
  try {
    const payload = await turnosService.listarPorPaciente({
      idMedico: req.query.id_medico,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(payload)
  } catch (err) {
    next(err)
  }
}

async function cancelarPropio(req, res, next) {
  try {
    const payload = await turnosService.cancelarPorPaciente({
      idTurno: req.params.id_turno,
      motivo: req.body?.motivo,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(payload)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  crearTurno,
  cambiarEstado,
  listarPorMedico,
  listarMisTurnos,
  cancelarPropio,
}
