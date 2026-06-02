const env = require('./config/env')
process.env.TZ = env.APP_TIMEZONE
const app = require('./app')

const PORT = env.PORT

app.listen(PORT, () => {
  console.log(`Agisad API listening on port ${PORT}`)
})
