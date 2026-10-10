const fs = require('fs')
const path = require('path')
const { MIGRATIONS, SQL_DIR, splitStatements } = require('../../../src/scripts/migrate')

describe('splitStatements', () => {
  it('separa por ; e ignora comentarios', () => {
    const sql = [
      '-- comentario',
      'CREATE TABLE a (id INT);',
      '',
      'ALTER TABLE a',
      '  ADD COLUMN b INT;',
    ].join('\n')

    expect(splitStatements(sql)).toEqual(['CREATE TABLE a (id INT)', 'ALTER TABLE a\n  ADD COLUMN b INT'])
  })

  it('respeta los bloques DELIMITER $$ de procedimientos', () => {
    const sql = [
      'DELIMITER $$',
      'CREATE PROCEDURE p()',
      'BEGIN',
      '  SELECT 1;',
      '  SELECT 2;',
      'END$$',
      'DELIMITER ;',
      'CALL p();',
      'DROP PROCEDURE p;',
    ].join('\n')

    expect(splitStatements(sql)).toEqual([
      'CREATE PROCEDURE p()\nBEGIN\n  SELECT 1;\n  SELECT 2;\nEND',
      'CALL p()',
      'DROP PROCEDURE p',
    ])
  })

  it('acepta $$ en una línea propia', () => {
    const sql = ['DELIMITER $$', 'CREATE TRIGGER t BEFORE INSERT ON a FOR EACH ROW BEGIN SET NEW.b = 1; END', '$$', 'DELIMITER ;'].join('\n')
    expect(splitStatements(sql)).toEqual(['CREATE TRIGGER t BEFORE INSERT ON a FOR EACH ROW BEGIN SET NEW.b = 1; END'])
  })

  it('conserva un último statement sin ;', () => {
    expect(splitStatements('SELECT 1;\nSELECT 2')).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('no devuelve statements vacíos', () => {
    expect(splitStatements(';\n\n-- nada\n;')).toEqual([])
  })
})

describe('lista de migraciones', () => {
  it('todas las migraciones listadas existen en sql/', () => {
    for (const archivo of MIGRATIONS) {
      expect(fs.existsSync(path.join(SQL_DIR, archivo))).toBe(true)
    }
  })

  it('están en orden y sin repetidos', () => {
    expect([...MIGRATIONS].sort()).toEqual(MIGRATIONS)
    expect(new Set(MIGRATIONS).size).toBe(MIGRATIONS.length)
  })

  it('cada archivo listado se puede partir en statements', () => {
    for (const archivo of MIGRATIONS) {
      const sql = fs.readFileSync(path.join(SQL_DIR, archivo), 'utf8')
      expect(splitStatements(sql).length).toBeGreaterThan(0)
    }
  })
})
