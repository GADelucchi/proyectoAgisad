const HttpError = require('../../../src/utils/httpError')
const { notFound, errorHandler } = require('../../../src/middlewares/error.middleware')

function fakeRes() {
  const res = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('notFound', () => {
  it('responde 404 con la ruta pedida', () => {
    const res = fakeRes()
    notFound({ originalUrl: '/api/nada' }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: 'Ruta no encontrada', path: '/api/nada' })
  })
})

describe('errorHandler', () => {
  it('traduce HttpError a su status, mensaje y detalles', () => {
    const res = fakeRes()
    errorHandler(new HttpError(409, 'Ocupado', { code: 'TURNO' }), {}, res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ message: 'Ocupado', details: { code: 'TURNO' } })
  })

  it('oculta los errores inesperados detrás de un 500', () => {
    const res = fakeRes()
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    errorHandler(new Error('ECONNREFUSED 10.0.0.1'), {}, res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ message: 'Error interno del servidor' })
    expect(spy).toHaveBeenCalled()
  })
})
