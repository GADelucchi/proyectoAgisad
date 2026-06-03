/**
 * Seed de datos demo para desarrollo local.
 * Ejecutar: npm run seed
 *
 * Inserta:
 *  - Provincia + Ciudad demo
 *  - Clínica demo
 *  - Usuarios demo: admin@demo.com, medico@demo.com, paciente@demo.com, asistente@demo.com, gerente@demo.com
 *    (contraseña: demo1234)
 *  - Registros en medicos, pacientes, asistentes, medico_clinicas
 */
'use strict'

require('dotenv').config()
const bcrypt = require('bcryptjs')
const pool = require('../db/pool')

const DEMO_PASSWORD = 'demo1234'

async function seed() {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // ── Provincia y ciudad ──────────────────────────────────────────
    const [provResult] = await conn.execute(
      `INSERT IGNORE INTO provincias (nombre) VALUES ('Buenos Aires')`
    )
    const [[{ id_provincia }]] = await conn.execute(
      `SELECT id_provincia FROM provincias WHERE nombre = 'Buenos Aires' LIMIT 1`
    )

    await conn.execute(
      `INSERT IGNORE INTO ciudades (id_provincia, nombre) VALUES (?, 'La Plata')`,
      [id_provincia]
    )
    const [[{ id_ciudad }]] = await conn.execute(
      `SELECT id_ciudad FROM ciudades WHERE nombre = 'La Plata' AND id_provincia = ? LIMIT 1`,
      [id_provincia]
    )

    // ── Clínica demo ────────────────────────────────────────────────
    await conn.execute(
      `INSERT IGNORE INTO clinicas (nombre, id_ciudad, direccion)
       VALUES ('Clínica Demo Agisad', ?, 'Av. 7 N° 1234, La Plata')`,
      [id_ciudad]
    )
    const [[{ id_clinica }]] = await conn.execute(
      `SELECT id_clinica FROM clinicas WHERE nombre = 'Clínica Demo Agisad' LIMIT 1`
    )

    // ── Especialidad (ya existe por INSERT IGNORE en el schema) ──────
    const [[{ id_especialidad }]] = await conn.execute(
      `SELECT id_especialidad FROM especialidades WHERE nombre = 'Clínica Médica' LIMIT 1`
    )

    // ── Roles ────────────────────────────────────────────────────────
    const [[{ id_rol: id_rol_admin }]] = await conn.execute(
      `SELECT id_rol FROM roles WHERE nombre = 'admin' LIMIT 1`
    )
    const [[{ id_rol: id_rol_medico }]] = await conn.execute(
      `SELECT id_rol FROM roles WHERE nombre = 'medico' LIMIT 1`
    )
    const [[{ id_rol: id_rol_gerente }]] = await conn.execute(
      `SELECT id_rol FROM roles WHERE nombre = 'gerente' LIMIT 1`
    )
    const [[{ id_rol: id_rol_paciente }]] = await conn.execute(
      `SELECT id_rol FROM roles WHERE nombre = 'paciente' LIMIT 1`
    )
    const [[{ id_rol: id_rol_asistente }]] = await conn.execute(
      `SELECT id_rol FROM roles WHERE nombre = 'asistente' LIMIT 1`
    )

    const hash = await bcrypt.hash(DEMO_PASSWORD, 10)

    // ── Usuario admin ───────────────────────────────────────────────
    await conn.execute(
      `INSERT IGNORE INTO usuarios (id_rol, username, email, password_hash, email_verificado, activo)
       VALUES (?, 'admin_demo', 'admin@demo.com', ?, 1, 1)`,
      [id_rol_admin, hash]
    )

    // ── Usuario médico ───────────────────────────────────────────────
    await conn.execute(
      `INSERT IGNORE INTO usuarios (id_rol, username, email, password_hash, email_verificado, activo)
       VALUES (?, 'medico_demo', 'medico@demo.com', ?, 1, 1)`,
      [id_rol_medico, hash]
    )
    const [[{ id_usuario: id_usuario_medico }]] = await conn.execute(
      `SELECT id_usuario FROM usuarios WHERE email = 'medico@demo.com' LIMIT 1`
    )
    await conn.execute(
      `INSERT IGNORE INTO medicos
         (id_usuario, id_especialidad, id_ciudad, matricula, nombre, apellido)
       VALUES (?, ?, ?, 'MP-12345', 'Carlos', 'García')`,
      [id_usuario_medico, id_especialidad, id_ciudad]
    )
    const [[{ id_medico }]] = await conn.execute(
      `SELECT id_medico FROM medicos WHERE id_usuario = ? LIMIT 1`,
      [id_usuario_medico]
    )
    await conn.execute(
      `INSERT IGNORE INTO medico_clinicas (id_medico, id_clinica) VALUES (?, ?)`,
      [id_medico, id_clinica]
    )

    // ── Usuario paciente ─────────────────────────────────────────────
    await conn.execute(
      `INSERT IGNORE INTO usuarios (id_rol, username, email, password_hash, email_verificado, activo)
       VALUES (?, 'paciente_demo', 'paciente@demo.com', ?, 1, 1)`,
      [id_rol_paciente, hash]
    )
    const [[{ id_usuario: id_usuario_paciente }]] = await conn.execute(
      `SELECT id_usuario FROM usuarios WHERE email = 'paciente@demo.com' LIMIT 1`
    )
    await conn.execute(
      `INSERT IGNORE INTO pacientes
         (id_usuario, dni, nombre, apellido, telefono, acepta_tyc)
       VALUES (?, '30123456', 'Ana', 'López', '2214567890', 1)`,
      [id_usuario_paciente]
    )
    // ── Usuario asistente ────────────────────────────────────────────
    await conn.execute(
      `INSERT IGNORE INTO usuarios (id_rol, username, email, password_hash, email_verificado, activo)
       VALUES (?, 'asistente_demo', 'asistente@demo.com', ?, 1, 1)`,
      [id_rol_asistente, hash]
    )
    const [[{ id_usuario: id_usuario_asistente }]] = await conn.execute(
      `SELECT id_usuario FROM usuarios WHERE email = 'asistente@demo.com' LIMIT 1`
    )
    await conn.execute(
      `INSERT IGNORE INTO asistentes (id_usuario, nombre, apellido, dni)
       VALUES (?, 'Laura', 'Martínez', '32456789')`,
      [id_usuario_asistente]
    )
    const [[{ id_asistente }]] = await conn.execute(
      `SELECT id_asistente FROM asistentes WHERE id_usuario = ? LIMIT 1`,
      [id_usuario_asistente]
    )

    // ── Usuario gerente ─────────────────────────────────────────────
    await conn.execute(
      `INSERT IGNORE INTO usuarios (id_rol, username, email, password_hash, email_verificado, activo)
       VALUES (?, 'gerente_demo', 'gerente@demo.com', ?, 1, 1)`,
      [id_rol_gerente, hash]
    )
    const [[{ id_usuario: id_usuario_gerente }]] = await conn.execute(
      `SELECT id_usuario FROM usuarios WHERE email = 'gerente@demo.com' LIMIT 1`
    )
    await conn.execute(
      `INSERT IGNORE INTO gerentes (id_usuario, nombre, apellido, telefono)
       VALUES (?, 'Verónica', 'Sosa', '2215557788')`,
      [id_usuario_gerente]
    )
    const [[{ id_gerente }]] = await conn.execute(
      `SELECT id_gerente FROM gerentes WHERE id_usuario = ? LIMIT 1`,
      [id_usuario_gerente]
    )
    await conn.execute(
      `INSERT IGNORE INTO gerente_clinicas (id_gerente, id_clinica) VALUES (?, ?)`,
      [id_gerente, id_clinica]
    )

    // ── Membresías/pagos demo (si existe migración 004 aplicada) ───
    const [[{ has_membresias }]] = await conn.execute(
      `SELECT COUNT(*) AS has_membresias
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'membresias'`
    )

    if (Number(has_membresias) > 0) {
      await conn.execute(
        `INSERT IGNORE INTO membresias
          (id_membresia, id_usuario, plan, estado, fecha_inicio, fecha_fin, monto_mensual, pagado_hasta, auto_renueva)
         VALUES
          (1001, ?, 'profesional', 'vencida', '2025-11-01', '2026-03-31', 22000.00, '2026-03-31', 0),
          (1002, ?, 'gestion', 'activa', '2026-01-01', '2026-12-31', 90000.00, '2026-12-31', 1),
          (1003, ?, 'legacy', 'cancelada', '2025-01-01', '2025-10-01', 15000.00, '2025-10-01', 0)`,
        [id_usuario_medico, id_usuario_gerente, id_usuario_asistente]
      )

      await conn.execute(
        `INSERT IGNORE INTO pagos_membresia
          (id_pago, id_membresia, monto, moneda, metodo, estado, referencia_externa, fecha_pago)
         VALUES
          (5001, 1002, 90000.00, 'ARS', 'transferencia', 'aprobado', 'TRX-GER-001', '2026-03-10 10:00:00'),
          (5002, 1002, 90000.00, 'ARS', 'transferencia', 'aprobado', 'TRX-GER-002', '2026-04-10 10:00:00'),
          (5003, 1001, 22000.00, 'ARS', 'manual', 'aprobado', 'TRX-MED-001', '2026-02-15 12:30:00'),
          (5004, 1001, 22000.00, 'ARS', 'manual', 'pendiente', 'TRX-MED-002', '2026-03-15 12:30:00'),
          (5005, 1003, 15000.00, 'ARS', 'manual', 'reintegrado', 'TRX-OLD-001', '2025-09-10 09:15:00')`
      )

      await conn.execute(
        `INSERT IGNORE INTO gerente_medico_beneficios
          (id_gerente, id_medico, id_clinica, cubre_membresia, activo)
         VALUES (?, ?, ?, 1, 1)`,
        [id_gerente, id_medico, id_clinica]
      )
    }

    await conn.commit()
    console.log('✅ Seed demo completado')
    console.log('   admin@demo.com     / demo1234  → rol admin')
    console.log('   medico@demo.com     / demo1234  → rol médico')
    console.log('   paciente@demo.com   / demo1234  → rol paciente')
    console.log('   asistente@demo.com  / demo1234  → rol asistente')
    console.log('   gerente@demo.com    / demo1234  → rol gerente')
    console.log('   (si existe v4) membresías y pagos demo cargados')
  } catch (err) {
    await conn.rollback()
    console.error('❌ Error en seed:', err.message)
    process.exitCode = 1
  } finally {
    conn.release()
    await pool.end()
  }
}

seed()
