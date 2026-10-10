// Reemplazo del mailer para los tests de services: mismas funciones, sin el
// banner de configuración que imprime el módulo real al cargarse.
module.exports = {
  sendPasswordResetEmail: jest.fn(async () => {}),
  sendRecetaSolicitudEmail: jest.fn(async () => {}),
  sendPacienteMensajeEmail: jest.fn(async () => {}),
  sendVerificacionEmailCodigo: jest.fn(async () => {}),
  sendInvitacionMedicoEmail: jest.fn(async () => {}),
  sendTurnoNuevoEmail: jest.fn(async () => {}),
  sendTurnoCanceladoEmail: jest.fn(async () => {}),
  sendSolicitudConsultorioEmail: jest.fn(async () => {}),
  sendSolicitudResueltaEmail: jest.fn(async () => {}),
}
