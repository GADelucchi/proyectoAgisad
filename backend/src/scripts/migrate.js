'use strict'

/**
 * Aplica las migraciones SQL pendientes en orden.
 * Ejecutar: npm run migrate
 *
 * Estrategia simple: tabla migration_log que registra cuáles ya se aplicaron.
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const pool = require('../db/pool')

const SQL_DIR = path.resolve(__dirname, '../../sql')

const MIGRATIONS = [
  '001_schema_base.sql',
  '002_mejoras.sql',
  '003_relaciones_negocio.sql',
  '004_admin_finanzas.sql',
  '005_schema_alignment_y_recetas.sql',
  '006_add_ultimo_login.sql',
]

async function ensureLogTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS migration_log (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      archivo     VARCHAR(120) NOT NULL,
      aplicado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ml_archivo (archivo)
    ) ENGINE = InnoDB
  `)
}

async function appliedMigrations(conn) {
  try {
    const [rows] = await conn.query('SELECT archivo FROM migration_log')
    return new Set(rows.map((r) => r.archivo))
  } catch {
    return new Set()
  }
}

function splitStatements(sql) {
  // Separa statements por `;` pero respeta bloques DELIMITER $$ … DELIMITER ;
  // El driver mysql2 no soporta DELIMITER, así que lo manejamos manualmente.
  // Caso especial: líneas como "END$$" (sin espacio) terminan el bloque.
  const statements = []
  let current = ''
  let inDelimiterBlock = false

  for (const line of sql.split('\n')) {
    const trimmed = line.trim()

    // Ignorar líneas de comentario puras fuera de bloques
    if (!inDelimiterBlock && trimmed.startsWith('--')) continue

    if (/^DELIMITER\s+\$\$/i.test(trimmed)) {
      inDelimiterBlock = true
      continue
    }

    if (/^DELIMITER\s+;/i.test(trimmed)) {
      inDelimiterBlock = false
      if (current.trim()) {
        statements.push(current.trim())
        current = ''
      }
      continue
    }

    if (inDelimiterBlock) {
      // La línea puede terminar con $$ directamente (p.ej. "END$$")
      if (trimmed === '$$' || trimmed.endsWith('$$')) {
        // Agregar la parte antes del $$ (si existe) y cerrar el statement
        const withoutDelim = line.replace(/\$\$\s*$/, '')
        if (withoutDelim.trim()) current += withoutDelim + '\n'
        if (current.trim()) {
          statements.push(current.trim())
          current = ''
        }
      } else {
        current += line + '\n'
      }
    } else {
      current += line + '\n'
      if (trimmed.endsWith(';')) {
        const stmt = current.trim().replace(/;\s*$/, '').trim()
        if (stmt.length > 0) statements.push(stmt)
        current = ''
      }
    }
  }

  if (current.trim()) statements.push(current.trim())
  return statements.filter((s) => s.length > 0 && !/^--/.test(s))
}

async function run() {
  const conn = await pool.getConnection()

  try {
    await ensureLogTable(conn)
    const applied = await appliedMigrations(conn)

    let ran = 0

    for (const archivo of MIGRATIONS) {
      if (applied.has(archivo)) {
        console.log(`  ✓ ya aplicada: ${archivo}`)
        continue
      }

      const filePath = path.join(SQL_DIR, archivo)
      if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠ no encontrada: ${archivo} — saltando`)
        continue
      }

      console.log(`  → aplicando: ${archivo}`)
      const sql = fs.readFileSync(filePath, 'utf8')
      const statements = splitStatements(sql)

      for (const stmt of statements) {
        try {
          await conn.query(stmt)
        } catch (err) {
          // Ignorar errores de "ya existe" / "ya insertado" que son idempotentes
          const ignorable = [
            'ER_TABLE_EXISTS_ERROR',
            'ER_DUP_ENTRY',
            'ER_DUP_KEYNAME',
            'ER_DUP_FIELDNAME',
            'ER_CANT_DROP_FIELD_OR_KEY',
            'ER_TRG_ALREADY_EXISTS',
          ]
          if (ignorable.includes(err.code)) continue
          throw new Error(`Error en ${archivo}:\n${stmt}\n\n${err.message}`)
        }
      }

      await conn.query('INSERT IGNORE INTO migration_log (archivo) VALUES (?)', [archivo])
      console.log(`  ✅ aplicada: ${archivo}`)
      ran++
    }

    if (ran === 0) {
      console.log('✅ Base de datos al día, sin migraciones pendientes.')
    } else {
      console.log(`\n✅ ${ran} migración(es) aplicada(s) correctamente.`)
    }
  } catch (err) {
    console.error('\n❌ Falló la migración:', err.message)
    process.exitCode = 1
  } finally {
    conn.release()
    await pool.end()
  }
}

run()
