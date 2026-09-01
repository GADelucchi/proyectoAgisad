const service = require('./consultorios.service')

async function listPublicos(_req, res, next) {
  try {
    res.json(await service.listPublicos())
  } catch (err) {
    next(err)
  }
}

async function listMisConsultorios(req, res, next) {
  try {
    const data = await service.listMisConsultorios({
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function crearConsultorio(req, res, next) {
  try {
    const data = await service.crearConsultorio({
      input: req.body,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function publicarConsultorio(req, res, next) {
  try {
    const data = await service.publicarConsultorio({
      idClinica: Number(req.params.id_clinica),
      publicar: req.body?.publicar !== false,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getDisponibilidadConfig(req, res, next) {
  try {
    const data = await service.getDisponibilidadConfig({
      idClinica: req.params.id_clinica,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function guardarDisponibilidad(req, res, next) {
  try {
    const data = await service.guardarDisponibilidad({
      idClinica: req.params.id_clinica,
      input: req.body,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getDisponibilidadPublica(req, res, next) {
  try {
    const data = await service.getDisponibilidadCompartida({
      idClinica: req.params.id_clinica,
      fecha: req.query.fecha,
      duracionMinutos: req.query.duracion_minutos || null,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function crearSolicitud(req, res, next) {
  try {
    const data = await service.crearSolicitud({
      idClinica: req.params.id_clinica,
      mensaje: req.body?.mensaje,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function listSolicitudesRecibidas(req, res, next) {
  try {
    const data = await service.listSolicitudesRecibidas({
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listMisSolicitudes(req, res, next) {
  try {
    const data = await service.listMisSolicitudes({
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function aprobarSolicitud(req, res, next) {
  try {
    const data = await service.resolverSolicitud({
      idSolicitud: req.params.id_solicitud,
      aprobar: true,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function rechazarSolicitud(req, res, next) {
  try {
    const data = await service.resolverSolicitud({
      idSolicitud: req.params.id_solicitud,
      aprobar: false,
      motivo: req.body?.motivo,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listMedicosVinculados(req, res, next) {
  try {
    const data = await service.listMedicosVinculados({
      idClinica: req.params.id_clinica,
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
      idClinica: req.params.id_clinica,
      idMedico: req.params.id_medico,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

async function reporteUso(req, res, next) {
  try {
    const data = await service.reporteUso({
      idClinica: req.params.id_clinica,
      desde: req.query.desde,
      hasta: req.query.hasta,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listPublicos,
  listMisConsultorios,
  crearConsultorio,
  publicarConsultorio,
  getDisponibilidadConfig,
  guardarDisponibilidad,
  getDisponibilidadPublica,
  crearSolicitud,
  listSolicitudesRecibidas,
  listMisSolicitudes,
  aprobarSolicitud,
  rechazarSolicitud,
  listMedicosVinculados,
  desvincularMedico,
  reporteUso,
}
