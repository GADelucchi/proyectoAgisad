const HttpError = require('../utils/httpError')

function notFound(req, res) {
  res.status(404).json({
    message: 'Ruta no encontrada',
    path: req.originalUrl,
  })
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      details: err.details,
    })
  }

  console.error(err)
  return res.status(500).json({
    message: 'Error interno del servidor',
  })
}

module.exports = {
  notFound,
  errorHandler,
}
