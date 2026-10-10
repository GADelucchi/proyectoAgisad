import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom no implementa matchMedia (lo usa ThemeContext).
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// jsdom tampoco implementa scrollTo / scrollIntoView, que usan algunos paneles.
window.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}

beforeEach(() => {
  localStorage.clear()
  // Ningún test le pega a la red: el que necesite fetch lo mockea explícitamente.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fetch no mockeado en este test'))))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
