import { useEffect, useRef } from 'react'
import { useTheme } from '../lib/theme'
import { createWaterfall } from '../lib/pixelscene'

// Fixed, full-viewport pixel-art waterfall that sits behind every page.
export default function PixelBackdrop() {
  const ref = useRef(null)
  const scene = useRef(null)
  const theme = useTheme()

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = document.documentElement.getAttribute('data-theme') || 'light'
    scene.current = createWaterfall(ref.current, { theme: t, reduced })
    return () => scene.current && scene.current.destroy()
  }, [])

  useEffect(() => { scene.current && scene.current.setTheme(theme) }, [theme])

  return <canvas ref={ref} className="pixel-backdrop" aria-hidden="true" />
}
