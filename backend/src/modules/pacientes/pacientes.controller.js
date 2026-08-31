const {
  listPacientes,
  createPacienteManual,
  getPaciente,
  patchPaciente,
  getMiPerfil,
  patchMiPerfil,
  listCatalogoObrasSociales,
  listMisRecetas,
  listMisMensajes,
  solicitarReceta,
  solicitarMensaje,
  getTycByMedico,
  aceptarTycByMedico,
  buscarPacientePorDni,
  getHistorialPaciente,
} = require('./pacientes.service')

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

async function create(req, res, next) {
  try {
    const data = await createPacienteManual({
      fields: req.body,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(data.ya_existia ? 200 : 201).json(data)
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

async function buscarPorDni(req, res, next) {
  try {
    const data = await buscarPacientePorDni({
      dni: req.params.dni,
      requesterRol: req.user.rol,
    })
    if (!data) return res.status(404).json({ message: 'No hay ningún paciente con ese DNI' })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getHistorial(req, res, next) {
  try {
    const data = await getHistorialPaciente({
      idPaciente: req.params.id,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getMe(req, res, next) {
  try {
    const data = await getMiPerfil({ requesterIdUsuario: req.user.idUsuario })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function patchMe(req, res, next) {
  try {
    const data = await patchMiPerfil({
      fields: req.body,
      requesterIdUsuario: req.user.idUsuario,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listObrasSociales(_req, res, next) {
  try {
    const data = await listCatalogoObrasSociales()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listMyRecetas(req, res, next) {
  try {
    const data = await listMisRecetas({ requesterIdUsuario: req.user.idUsuario })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listMyMensajes(req, res, next) {
  try {
    const data = await listMisMensajes({ requesterIdUsuario: req.user.idUsuario })
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

async function requestMensaje(req, res, next) {
  try {
    const data = await solicitarMensaje({
      idMedico: req.params.id_medico,
      asunto: req.body?.asunto,
      mensaje: req.body?.mensaje,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function getTyc(req, res, next) {
  try {
    const data = await getTycByMedico({
      idMedico: req.params.id_medico,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function acceptTyc(req, res, next) {
  try {
    const data = await aceptarTycByMedico({
      idMedico: req.params.id_medico,
      idTyc: req.body?.id_tyc,
      requesterIdUsuario: req.user.idUsuario,
      requesterRol: req.user.rol,
      ip: req.ip,
    })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  list,
  create,
  getOne,
  patch,
  buscarPorDni,
  getHistorial,
  getMe,
  patchMe,
  listObrasSociales,
  listMyRecetas,
  listMyMensajes,
  requestReceta,
  requestMensaje,
  getTyc,
  acceptTyc,
}
