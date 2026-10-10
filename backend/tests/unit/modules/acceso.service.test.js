jest.mock('../../../src/modules/acceso/acceso.repository')

const repo = require('../../../src/modules/acceso/acceso.repository')
const { resolverMedicoAccesible } = require('../../../src/modules/acceso/acceso.service')

const como = (rol, extra = {}) => ({ requesterIdUsuario: 10, requesterRol: rol, ...extra })

beforeEach(() => {
  repo.findMedicoIdByUserId.mockResolvedValue(3)
  repo.findPermisosAsistente.mockResolvedValue({ agenda: 1, pacientes: 0, bloqueado: 0 })
  repo.gerenteTieneMedico.mockResolvedValue(true)
})

describe('resolverMedicoAccesible', () => {
  describe('médico', () => {
    it('sin id_medico usa el propio', async () => {
      await expect(resolverMedicoAccesible(como('medico'))).resolves.toBe(3)
    })

    it('puede pedir el propio explícitamente', async () => {
      await expect(resolverMedicoAccesible(como('medico', { idMedico: '3' }))).resolves.toBe(3)
    })

    it('no puede pedir otro médico', async () => {
      await expect(resolverMedicoAccesible(como('medico', { idMedico: 4 }))).rejects.toMatchObject({ status: 403 })
    })

    it('sin perfil de médico responde 404', async () => {
      repo.findMedicoIdByUserId.mockResolvedValue(null)
      await expect(resolverMedicoAccesible(como('medico'))).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('asistente', () => {
    it('exige id_medico', async () => {
      await expect(resolverMedicoAccesible(como('asistente'))).rejects.toMatchObject({ status: 400 })
    })

    it('accede a un médico que lo vinculó', async () => {
      await expect(resolverMedicoAccesible(como('asistente', { idMedico: 3 }))).resolves.toBe(3)
      expect(repo.findPermisosAsistente).toHaveBeenCalledWith({ idUsuario: 10, idMedico: 3 })
    })

    it('no accede a médicos que no lo vincularon', async () => {
      repo.findPermisosAsistente.mockResolvedValue(null)
      await expect(resolverMedicoAccesible(como('asistente', { idMedico: 4 }))).rejects.toMatchObject({ status: 403 })
    })

    it('bloqueado: solo pasa si se permite (lectura de agenda)', async () => {
      repo.findPermisosAsistente.mockResolvedValue({ agenda: 1, bloqueado: 1 })
      await expect(resolverMedicoAccesible(como('asistente', { idMedico: 3 }))).rejects.toMatchObject({
        status: 403,
        message: 'Tu usuario está bloqueado por el médico',
      })
      await expect(resolverMedicoAccesible(como('asistente', { idMedico: 3, permitirBloqueado: true }))).resolves.toBe(3)
    })

    it('exige el permiso pedido', async () => {
      await expect(resolverMedicoAccesible(como('asistente', { idMedico: 3, permiso: 'agenda' }))).resolves.toBe(3)
      await expect(resolverMedicoAccesible(como('asistente', { idMedico: 3, permiso: 'pacientes' }))).rejects.toMatchObject({
        status: 403,
        message: 'No tenés permiso para esta sección',
      })
    })
  })

  describe('gerente', () => {
    it('lee médicos que atienden en sus clínicas', async () => {
      await expect(resolverMedicoAccesible(como('gerente', { idMedico: 3, permitirBloqueado: true }))).resolves.toBe(3)
      expect(repo.gerenteTieneMedico).toHaveBeenCalledWith({ idUsuario: 10, idMedico: 3 })
    })

    it('no lee médicos ajenos', async () => {
      repo.gerenteTieneMedico.mockResolvedValue(false)
      await expect(resolverMedicoAccesible(como('gerente', { idMedico: 3, permitirBloqueado: true }))).rejects.toMatchObject({ status: 403 })
    })

    it('no escribe (solo lectura)', async () => {
      await expect(resolverMedicoAccesible(como('gerente', { idMedico: 3 }))).rejects.toMatchObject({ status: 403 })
    })
  })

  it('el admin accede a cualquier médico indicado', async () => {
    await expect(resolverMedicoAccesible(como('admin', { idMedico: '9' }))).resolves.toBe(9)
    await expect(resolverMedicoAccesible(como('admin'))).rejects.toMatchObject({ status: 400 })
  })

  it.each(['paciente', 'propietario', undefined])('el rol %p no tiene acceso', async (rol) => {
    await expect(resolverMedicoAccesible(como(rol, { idMedico: 3 }))).rejects.toMatchObject({ status: 403 })
  })
})
