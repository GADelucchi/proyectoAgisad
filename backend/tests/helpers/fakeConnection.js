/**
 * Conexión de mysql2 falsa para los services y repositories que abren
 * transacciones con pool.getConnection().
 *
 * `responder(sql, params)` decide qué devuelve cada execute/query: lo que
 * retorne se envuelve como `[rows]`, igual que el driver real. Si tira un
 * error, el execute lo propaga (sirve para simular ER_DUP_ENTRY, etc.).
 */
function createFakeConnection(responder = () => []) {
  const run = jest.fn(async (sql, params) => [await responder(sql, params)])

  return {
    execute: run,
    query: run,
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(),
  }
}

/** SQL de todas las llamadas a execute, para hacer aserciones sobre el orden. */
function executedSql(conn) {
  return conn.execute.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').trim())
}

module.exports = { createFakeConnection, executedSql }
