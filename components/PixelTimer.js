import { useEffect, useRef } from 'react'
import { TW, TH, drawTimer, drawTomatoIcon } from '../lib/pixeltimer'

// Animated pixel tomato-timer. `count` (completed focus sessions) changing triggers a little celebration.
export default function PixelTimer({ mode, running, secs, total, count, scale = 5 }) {
  const ref = useRef(null)
  const st = useRef({ f: 0, cheer: 0 })
  const props = useRef({})
  props.current = { mode, running, frac: total ? secs / total : 1 }
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    st.current.cheer = 30
  }, [count])

  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    ctx.imageSmoothingEnabled = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const paint = () => drawTimer(ctx, { ...props.current, f: st.current.f, cheer: st.current.cheer })
    paint()
    if (reduced) return
    const id = setInterval(() => {
      st.current.f++
      if (st.current.cheer > 0) st.current.cheer--
      paint()
    }, 125)
    return () => clearInterval(id)
  }, [])

  // repaint immediately when the dial changes so it never lags a tick
  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    drawTimer(ctx, { ...props.current, f: st.current.f, cheer: st.current.cheer })
  }, [mode, running, secs, total])

  return (
    <canvas ref={ref} className="pixel-timer" width={TW} height={TH}
      style={{ width: TW * scale, height: TH * scale }} role="img"
      aria-label={running ? 'Tomato timer, running' : 'Tomato timer'} />
  )
}

// Tiny static-ish tomato for the tab label
export function PixelTomato() {
  const ref = useRef(null)
  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    drawTomatoIcon(ctx, 0)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    let f = 0
    const id = setInterval(() => drawTomatoIcon(ctx, ++f), 700)
    return () => clearInterval(id)
  }, [])
  return <canvas ref={ref} className="pixel-tomato" width={10} height={10} aria-hidden="true" />
}
