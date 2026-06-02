const pool = require('./pool')

async function query(sql, params = {}) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

module.exports = { query, pool }
