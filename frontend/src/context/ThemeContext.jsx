import { createContext, useContext, useState, useEffect, useMemo } from 'react'

const ThemeContext = createContext(null)

function resolverTema(mode) {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('agisad-theme-mode') || 'dark'
  })
  const [systemIsDark, setSystemIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  const theme = useMemo(() => {
    if (themeMode === 'system') {
      return systemIsDark ? 'dark' : 'light'
    }
    return resolverTema(themeMode)
  }, [themeMode, systemIsDark])

  useEffect(() => {
    localStorage.setItem('agisad-theme-mode', themeMode)
  }, [themeMode])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      if (themeMode === 'system') {
        setSystemIsDark(media.matches)
      }
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [themeMode])

  function toggleTheme() {
    setThemeMode(prev => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'system'
      return 'light'
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}
