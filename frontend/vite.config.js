import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    // Valores fijos para que los tests no dependan del .env local (ni apunten a la API real).
    env: {
      VITE_API_BASE: 'http://api.test/api',
      VITE_APP_TIMEZONE: 'America/Argentina/Buenos_Aires',
      VITE_APP_LOCALE: 'es-AR',
    },
    restoreMocks: true,
  },
})
