const { Router } = require('express')
const pool = require('../db/pool')

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1')
    res.json({
      status: 'ok',
      db: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
