const HttpError = require('../../utils/httpError')
const adminRepository = require('./admin.repository')

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function listUsuarios(filters) {
  return adminRepository.listUsuariosAdmin(filters)
}

async function getUsuarioDetalle(idUsuarioRaw) {
  const idUsuario = toNumber(idUsuarioRaw)
  if (!idUsuario) {
    throw new HttpError(400, 'id_usuario invalido')
  }

  const base = await adminRepository.findUsuarioBaseById(idUsuario)
  if (!base) {
    throw new HttpError(404, 'Usuario no encontrado')
  }

  const detalle = {
    usuario: {
      id_usuario: base.id_usuario,
      username: base.username,
      email: base.email,
      rol: base.rol,
      activo: base.activo,
      email_verificado: base.email_verificado,
      creado_en: base.creado_en,
    },
    suscripcion: {
      id_membresia: base.id_membresia || null,
      plan: base.membresia_plan || null,
      estado: base.membresia_estado || 'inexistente',
      fecha_inicio: base.membresia_fecha_inicio || null,
      fecha_fin: base.membresia_fecha_fin || null,
      monto_mensual: base.monto_mensual || null,
      pagado_hasta: base.membresia_pagado_hasta || null,
      auto_renueva: base.auto_renueva || 0,
    },
    perfil: null,
    relaciones: {},
    pagos: [],
  }

  // El monto a cobrar no es solo el del plan: los adicionales contratados se
  // suman al total de la próxima renovación.
  const adicionales = base.rol === 'medico'
    ? await adminRepository.findAdicionalesActivosByMedicoUsuario(idUsuario)
    : []

  const montoPlan = Number(base.monto_mensual || 0)
  const montoAdicionales = adicionales.reduce((acc, a) => acc + Number(a.monto_mensual || 0), 0)

  detalle.suscripcion.adicionales = adicionales.map((a) => ({
    concepto: `Publicar consultorios (hasta ${a.max_consultorios})`,
    monto_mensual: Number(a.monto_mensual),
    activado_en: a.activado_en,
  }))
  detalle.suscripcion.monto_adicionales = montoAdicionales
  detalle.suscripcion.total_a_cobrar = montoPlan + montoAdicionales

  if (base.rol === 'paciente') {
    detalle.perfil = {
      id_paciente: base.id_paciente,
      dni: base.paciente_dni,
      nombre: base.paciente_nombre,
      apellido: base.paciente_apellido,
      telefono: base.paciente_telefono,
      fecha_nac: base.paciente_fecha_nac,
      obra_social: base.paciente_obra_social,
      nro_obra_social: base.paciente_nro_obra_social,
      acepta_tyc: base.paciente_acepta_tyc,
      acepta_tyc_fecha: base.paciente_acepta_tyc_fecha,
    }
    detalle.relaciones.medicos_vinculados = await adminRepository.findPacienteMedicosVinculados(base.id_paciente)
  }

  if (base.rol === 'medico') {
    detalle.perfil = {
      id_medico: base.id_medico,
      matricula: base.matricula,
      nombre: base.medico_nombre,
      apellido: base.medico_apellido,
      telefono: base.medico_telefono,
      especialidad: base.medico_especialidad,
      ciudad: base.medico_ciudad,
      provincia: base.medico_provincia,
    }
    detalle.relaciones.clinicas = await adminRepository.findMedicoClinicas(base.id_medico)
    detalle.relaciones.cobertura_gerente = await adminRepository.findMedicoCoberturaGerente(base.id_medico)
    detalle.pagos = await adminRepository.findPagosByUsuario(base.id_usuario)
  }

  if (base.rol === 'asistente') {
    detalle.perfil = {
      id_asistente: base.id_asistente,
      nombre: base.asistente_nombre,
      apellido: base.asistente_apellido,
      telefono: base.asistente_telefono,
    }
    detalle.relaciones.medicos = await adminRepository.findAsistenteMedicos(base.id_asistente)
    detalle.relaciones.clinicas = await adminRepository.findAsistenteClinicas(base.id_asistente)
  }

  if (base.rol === 'gerente') {
    detalle.perfil = {
      id_gerente: base.id_gerente,
      nombre: base.gerente_nombre,
      apellido: base.gerente_apellido,
      telefono: base.gerente_telefono,
    }
    detalle.relaciones.clinicas = await adminRepository.findGerenteClinicas(base.id_gerente)
    detalle.relaciones.medicos_asociados = await adminRepository.findGerenteMedicos(base.id_gerente)
    detalle.pagos = await adminRepository.findPagosByUsuario(base.id_usuario)
  }

  if (base.rol === 'admin') {
    detalle.perfil = {
      nombre: base.username,
    }
  }

  return detalle
}

async function getFinanzas() {
  const [resumen, mensual, movimientos] = await Promise.all([
    adminRepository.getFinanzasResumen(),
    adminRepository.listFinanzasMensual(),
    adminRepository.listFinanzasMovimientos({ limit: 150 }),
  ])

  return {
    resumen,
    mensual,
    movimientos,
  }
}

async function getUserSubscription(email) {
  return adminRepository.findUserSubscriptionByEmail(email)
}

async function reactivateMembership(input) {
  const idUsuario = toNumber(input?.id_usuario)
  if (!idUsuario) {
    throw new HttpError(400, 'id_usuario invalido')
  }

  const allowedMethods = new Set(['manual', 'transferencia', 'tarjeta', 'mercadopago', 'otro'])
  const metodo = String(input?.metodo || 'manual').toLowerCase()
  if (!allowedMethods.has(metodo)) {
    throw new HttpError(400, 'metodo de pago invalido')
  }

  const monto = input?.monto === null || input?.monto === undefined || input?.monto === ''
    ? null
    : Number(input.monto)

  if (monto !== null && (!Number.isFinite(monto) || monto < 0)) {
    throw new HttpError(400, 'monto invalido')
  }

  try {
    const updated = await adminRepository.reactivateMembershipByUser({
      idUsuario,
      rawPlan: input?.plan || null,
      metodo,
      referenciaExterna: input?.referencia_externa || null,
      monto,
    })

    if (!updated) {
      throw new HttpError(500, 'No se pudo actualizar la membresia')
    }

    return updated
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw new HttpError(400, err.message || 'No se pudo reactivar la membresia')
  }
}



module.exports = {
  listUsuarios,
  getUsuarioDetalle,
  getFinanzas,
  getUserSubscription,
  reactivateMembership,
}
