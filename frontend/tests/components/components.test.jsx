import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Button from '../../src/components/ui/Button'
import PasswordInput from '../../src/components/ui/PasswordInput'
import SmartDateInput from '../../src/components/ui/SmartDateInput'
import SmartTimeInput from '../../src/components/ui/SmartTimeInput'
import ThemeToggle from '../../src/components/ui/ThemeToggle'
import SeoManager from '../../src/components/SeoManager'
import Navbar from '../../src/components/layout/Navbar'
import { ThemeProvider } from '../../src/context/ThemeContext'
import { renderWithProviders, usuarios } from '../helpers/render'

describe('Button', () => {
  it('aplica variante, tamaño y ancho completo', () => {
    render(<Button variant="danger" size="sm" fullWidth className="extra">Borrar</Button>)
    const button = screen.getByRole('button', { name: 'Borrar' })
    expect(button).toHaveClass('btn', 'btn-danger', 'btn-sm', 'btn-full', 'extra')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('dispara onClick y respeta disabled', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Ok</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<Button onClick={onClick} disabled>Ok</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('PasswordInput', () => {
  it('muestra y oculta la contraseña', async () => {
    render(<PasswordInput id="pw" value="secreta" onChange={() => {}} aria-label="Contraseña" />)
    const input = screen.getByLabelText('Contraseña')
    expect(input).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true')
  })
})

function Controlado({ Component, initial = '', onValue }) {
  const [value, setValue] = useState(initial)
  return (
    <Component
      name="campo"
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        onValue(e.target.value)
      }}
    />
  )
}

describe('SmartDateInput', () => {
  it('formatea mientras se escribe y emite la fecha ISO completa', async () => {
    const onValue = vi.fn()
    render(<Controlado Component={SmartDateInput} onValue={onValue} />)
    const input = screen.getByPlaceholderText('DD/MM/AAAA')

    await userEvent.type(input, '08102026')

    expect(input).toHaveValue('08/10/2026')
    expect(onValue).toHaveBeenLastCalledWith('2026-10-08')
  })

  it('al salir con una fecha incompleta vuelve al último valor válido', async () => {
    const onValue = vi.fn()
    render(<Controlado Component={SmartDateInput} initial="2026-10-08" onValue={onValue} />)
    const input = screen.getByPlaceholderText('DD/MM/AAAA')
    expect(input).toHaveValue('08/10/2026')

    await userEvent.clear(input)
    expect(onValue).toHaveBeenLastCalledWith('')
    await userEvent.type(input, '0911')
    fireEvent.blur(input)
    expect(input).toHaveValue('')
  })

  it('en pantallas táctiles usa el selector nativo', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(pointer: coarse)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const { container } = render(<SmartDateInput value="2026-10-08" onChange={() => {}} />)
    expect(container.querySelector('input')).toHaveAttribute('type', 'date')
  })
})

describe('SmartTimeInput', () => {
  it('formatea HH:MM y emite la hora válida', async () => {
    const onValue = vi.fn()
    render(<Controlado Component={SmartTimeInput} onValue={onValue} />)
    const input = screen.getByPlaceholderText('HH:MM')

    await userEvent.type(input, '0930')
    expect(input).toHaveValue('09:30')
    expect(onValue).toHaveBeenLastCalledWith('09:30')
  })

  it('descarta horas inválidas al salir', async () => {
    const onValue = vi.fn()
    render(<Controlado Component={SmartTimeInput} initial="10:00" onValue={onValue} />)
    const input = screen.getByPlaceholderText('HH:MM')

    await userEvent.clear(input)
    await userEvent.type(input, '2575')
    fireEvent.blur(input)
    expect(input).toHaveValue('')
  })
})

describe('ThemeToggle', () => {
  it('cambia el modo de tema', async () => {
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    const select = screen.getByLabelText('Modo de tema')
    expect(select).toHaveValue('dark')

    await userEvent.selectOptions(select, 'light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })
})

describe('SeoManager', () => {
  function renderAt(path) {
    render(<MemoryRouter initialEntries={[path]}><SeoManager /></MemoryRouter>)
    return {
      robots: document.head.querySelector('meta[name="robots"]').getAttribute('content'),
      canonical: document.head.querySelector('link[rel="canonical"]').getAttribute('href'),
      description: document.head.querySelector('meta[name="description"]').getAttribute('content'),
    }
  }

  it('las páginas públicas son indexables', () => {
    const seo = renderAt('/registro/paciente/')
    expect(document.title).toBe('Registro de pacientes | Agisad')
    expect(seo.robots).toBe('index, follow')
    expect(seo.canonical).toBe('https://agisad.ar/registro/paciente')
  })

  it('los alias apuntan a la URL canónica y no se indexan', () => {
    const seo = renderAt('/registro/medico')
    expect(seo.robots).toBe('noindex, follow')
    expect(seo.canonical).toBe('https://agisad.ar/registro/profesional')
  })

  it('los paneles privados no se indexan', () => {
    const seo = renderAt('/medico/consultorios')
    expect(document.title).toBe('Panel médico | Agisad')
    expect(seo.robots).toBe('noindex, follow')
    expect(seo.description).toMatch(/Agisad es el sistema/)
  })

  it('las rutas desconocidas se titulan como no encontradas', () => {
    renderAt('/cualquier-cosa')
    expect(document.title).toBe('Página no encontrada | Agisad')
  })
})

describe('Navbar', () => {
  it('sin sesión muestra marca y tema, sin acciones de usuario', () => {
    renderWithProviders(<Navbar titulo="Hola" subtitulo="Sub" />)
    expect(screen.getByText('Agisad')).toBeInTheDocument()
    expect(screen.getByText('Sub')).toBeInTheDocument()
    expect(screen.queryByTitle('Cerrar sesión')).not.toBeInTheDocument()
  })

  it('el título puede enlazar al panel', () => {
    renderWithProviders(<Navbar titulo="Hola, Ana" tituloTo="/paciente/panel" />, { usuario: usuarios.paciente })
    expect(screen.getByTitle('Ir a mi panel')).toHaveAttribute('href', '/paciente/panel')
  })

  it('cerrar sesión borra la sesión y vuelve al inicio', async () => {
    renderWithProviders(<Navbar titulo="Panel" />, { usuario: usuarios.medico, route: '/medico' })

    await userEvent.click(screen.getByTitle('Cerrar sesión'))

    expect(screen.getByTestId('location')).toHaveTextContent('/')
    expect(localStorage.getItem('agisad-user')).toBeNull()
  })
})
