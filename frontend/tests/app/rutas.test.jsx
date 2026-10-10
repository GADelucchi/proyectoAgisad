import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../../src/App'

afterEach(() => {
  window.history.pushState({}, '', '/')
})

describe('rutas de la app', () => {
  it('/registro/gerente redirige al registro profesional (con plan Empresarial se crea el gerente)', async () => {
    window.history.pushState({}, '', '/registro/gerente')
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Crear cuenta de médico' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/registro/profesional')
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://agisad.ar/registro/profesional')
  })

  it('una ruta desconocida muestra la página 404', async () => {
    window.history.pushState({}, '', '/no-existe')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })
})
