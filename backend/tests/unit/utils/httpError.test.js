const HttpError = require('../../../src/utils/httpError')

describe('HttpError', () => {
  it('guarda status, mensaje y detalles', () => {
    const err = new HttpError(409, 'Conflicto', { code: 'X' })

    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(409)
    expect(err.message).toBe('Conflicto')
    expect(err.details).toEqual({ code: 'X' })
  })

  it('usa null como detalle por defecto', () => {
    expect(new HttpError(400, 'Mal').details).toBeNull()
  })
})
