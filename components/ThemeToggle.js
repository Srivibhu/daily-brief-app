import { useTheme, setTheme } from '../lib/theme'

export default function ThemeToggle({ className = '' }) {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button className={`theme-toggle ${className}`} onClick={() => setTheme(next)} title={`Switch to ${next} mode`} aria-label={`Switch to ${next} mode`}>
      {theme === 'dark' ? '☀ Light' : '☾ Dark'}
    </button>
  )
}
