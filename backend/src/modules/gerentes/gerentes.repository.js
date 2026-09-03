const { query } = require('../../db/query')

async function findGerenteByUserId(idUsuario) {
  const rows = await query(
    `SELECT id_gerente, nombre, apellido
     FROM gerentes
     WHERE id_usuario = :idUsuario
     LIMIT 1`,
    { idUsuario }
  )
  return rows[0] || null
}

async function findClinicaOwnedByGerente({ idGerente, idClinica }) {
  const rows = await query(
    `SELECT c.id_clinica, c.nombre, c.direccion
     FROM gerente_clinicas gc
     INNER JOIN clinicas c ON c.id_clinica = gc.id_clinica
     WHERE gc.id_gerente = :idGerente
       AND gc.id_clinica = :idClinica
       AND gc.activo = 1
     LIMIT 1`,
    { idGerente, idClinica }
  )
  return rows[0] || null
}

async function listClinicasByGerente(idGerente) {
  return query(
    `SELECT c.id_clinica, c.nombre, c.direccion, c.telefono
     FROM gerente_clinicas gc
     INNER JOIN clinicas c ON c.id_clinica = gc.id_clinica
     WHERE gc.id_gerente = :idGerente
       AND gc.activo = 1
     ORDER BY c.nombre`,
    { idGerente }
  )
}

async function createInvitacion({ idGerente, idClinica, email, tokenHash, vigenciaDias }) {
  const result = await query(
    `INSERT INTO gerente_invitaciones (id_gerente, id_clinica, email_invitado, token_hash, expira_en)
     VALUES (:idGerente, :idClinica, :email, :tokenHash, DATE_ADD(NOW(), INTERVAL :vigenciaDias DAY))`,
    { idGerente, idClinica, email, tokenHash, vigenciaDias }
  )
  return result.insertId
}

async function findInvitacionByTokenHash(tokenHash) {
  const rows = await query(
    `SELECT
      gi.id_invitacion, gi.id_gerente, gi.id_clinica, gi.email_invitado,
      gi.estado, gi.expira_en, gi.id_medico_resultante,
      (gi.expira_en > NOW()) AS vigente,
      c.nombre AS clinica_nombre,
      g.nombre AS gerente_nombre, g.apellido AS gerente_apellido
     FROM gerente_invitaciones gi
     INNER JOIN clinicas c ON c.id_clinica = gi.id_clinica
     INNER JOIN gerentes g ON g.id_gerente = gi.id_gerente
     WHERE gi.token_hash = :tokenHash
     LIMIT 1`,
    { tokenHash }
  )
  return rows[0] || null
}

async function listInvitacionesByGerente(idGerente) {
  return query(
    `SELECT
      gi.id_invitacion, gi.id_clinica, gi.email_invitado, gi.estado,
      gi.expira_en, gi.aceptada_en, gi.creado_en,
      c.nombre AS clinica_nombre
     FROM gerente_invitaciones gi
     INNER JOIN clinicas c ON c.id_clinica = gi.id_clinica
     WHERE gi.id_gerente = :idGerente
     ORDER BY gi.creado_en DESC`,
    { idGerente }
  )
}

async function findInvitacionPendienteById({ idInvitacion, idGerente }) {
  const rows = await query(
    `SELECT id_invitacion FROM gerente_invitaciones
     WHERE id_invitacion = :idInvitacion
       AND id_gerente = :idGerente
       AND estado = 'pendiente'
     LIMIT 1`,
    { idInvitacion, idGerente }
  )
  return rows[0] || null
}

async function updateInvitacionEstado({ idInvitacion, estado }) {
  await query(
    `UPDATE gerente_invitaciones SET estado = :estado WHERE id_invitacion = :idInvitacion`,
    { idInvitacion, estado }
  )
}

async function marcarInvitacionAceptada({ idInvitacion, idMedico }) {
  await query(
    `UPDATE gerente_invitaciones
     SET estado = 'aceptada', id_medico_resultante = :idMedico, aceptada_en = NOW()
     WHERE id_invitacion = :idInvitacion`,
    { idInvitacion, idMedico }
  )
}

async function linkMedicoAClinica({ idMedico, idClinica }) {
  await query(
    `INSERT INTO medico_clinicas (id_medico, id_clinica, activo)
     VALUES (:idMedico, :idClinica, 1)
     ON DUPLICATE KEY UPDATE activo = 1`,
    { idMedico, idClinica }
  )
}

async function linkGerenteMedicoBeneficio({ idGerente, idMedico, idClinica }) {
  await query(
    `INSERT INTO gerente_medico_beneficios (id_gerente, id_medico, id_clinica, cubre_membresia, activo)
     VALUES (:idGerente, :idMedico, :idClinica, 1, 1)
     ON DUPLICATE KEY UPDATE activo = 1, cubre_membresia = 1`,
    { idGerente, idMedico, idClinica }
  )
}

async function unlinkMedicoDeClinica({ idMedico, idClinica }) {
  await query(
    `UPDATE medico_clinicas SET activo = 0 WHERE id_medico = :idMedico AND id_clinica = :idClinica`,
    { idMedico, idClinica }
  )
}

async function unlinkGerenteMedicoBeneficio({ idGerente, idMedico, idClinica }) {
  await query(
    `UPDATE gerente_medico_beneficios
     SET activo = 0
     WHERE id_gerente = :idGerente AND id_medico = :idMedico AND id_clinica = :idClinica`,
    { idGerente, idMedico, idClinica }
  )
}

async function listMedicosByGerente(idGerente) {
  return query(
    `SELECT DISTINCT
      m.id_medico, m.nombre, m.apellido, m.matricula,
      gmb.id_clinica, c.nombre AS clinica_nombre,
      gmb.cubre_membresia
     FROM gerente_medico_beneficios gmb
     INNER JOIN medicos m ON m.id_medico = gmb.id_medico
     INNER JOIN clinicas c ON c.id_clinica = gmb.id_clinica
     WHERE gmb.id_gerente = :idGerente
       AND gmb.activo = 1
     ORDER BY m.apellido, m.nombre`,
    { idGerente }
  )
}

module.exports = {
  findGerenteByUserId,
  findClinicaOwnedByGerente,
  listClinicasByGerente,
  createInvitacion,
  findInvitacionByTokenHash,
  listInvitacionesByGerente,
  findInvitacionPendienteById,
  updateInvitacionEstado,
  marcarInvitacionAceptada,
  linkMedicoAClinica,
  linkGerenteMedicoBeneficio,
  unlinkMedicoDeClinica,
  unlinkGerenteMedicoBeneficio,
  listMedicosByGerente,
}
