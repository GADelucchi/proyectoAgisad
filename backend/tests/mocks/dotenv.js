// Los tests nunca leen el .env real: así no se usan credenciales de la base
// ni la API key de Resend por accidente. Las variables las define setup-env.js.
module.exports = {
  config: () => ({ parsed: {} }),
}
