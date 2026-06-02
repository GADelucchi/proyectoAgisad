import { useTheme } from '../../context/ThemeContext'
import './ThemeToggle.css'

export default function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme()

  return (
    <select
      className="theme-toggle-select"
      value={themeMode}
      onChange={e => setThemeMode(e.target.value)}
      aria-label="Modo de tema"
    >
      <option value="light">Claro</option>
      <option value="dark">Oscuro</option>
      <option value="system">Sistema</option>
    </select>
  )
}
