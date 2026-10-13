import { useEffect, useRef } from 'react'
import { useTheme } from '../lib/theme'

// The illustrated cliffside behind every page (public/scene/*.webp, one layout for day and night),
// plus a small canvas layer, drawn at the art's own pixel size, that animates only the live parts.
// Coordinates below are in art pixels (1376 × 768).
export const SCENE = {
  w: 1376, h: 768,
  focusX: 780,                         // centre of the calm middle; kept centred behind the content
  falls: [
    { x0: 648, x1: 838, y0: 250, y1: 626, main: true },
    { x0: 1283, x1: 1311, y0: 132, y1: 462 },
  ],
  pool: { cx: 742, cy: 642 },
  egg: { cx: 372, cy: 363, rx: 20, ry: 25 },
  windows: [[36, 220, 42, 40], [164, 193, 58, 54], [44, 318, 38, 42], [212, 316, 38, 42], [36, 128, 40, 48], [164, 334, 14, 20]],
  lanterns: [[62, 404], [1271, 424], [121, 634], [204, 598]],
  sky: { x0: 330, x1: 1230, y0: 0, y1: 190 },
}

// where the art sits on screen: cover the viewport, keep the calm middle centred, crop more sky than pool
export function sceneBox(vw, vh) {
  const s = Math.max(vw / SCENE.w, vh / SCENE.h)
  const width = SCENE.w * s, height = SCENE.h * s
  const left = Math.min(0, Math.max(vw - width, vw / 2 - SCENE.focusX * s))
  const top = Math.min(0, (vh - height) * 0.35)
  return { s, width, height, left, top }
}

// cheap deterministic noise for per-frame sparkle
function hash(a, b, c) { let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 } }

export default function SceneBackdrop() {
  const wrap = useRef(null)
  const cv = useRef(null)
  const dayImg = useRef(null)
  const nightImg = useRef(null)
  const theme = useTheme()
  const themeRef = useRef(theme)
  themeRef.current = theme

  // size + place the art
  useEffect(() => {
    const place = () => {
      const b = sceneBox(window.innerWidth, window.innerHeight)
      Object.assign(wrap.current.style, { width: b.width + 'px', height: b.height + 'px', left: b.left + 'px', top: b.top + 'px' })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [])

  // animation loop (~12 fps, paused when the tab is hidden, off for reduced motion)
  useEffect(() => {
    const ctx = cv.current.getContext('2d')
    ctx.imageSmoothingEnabled = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const R = rng(42)
    const streaks = SCENE.falls.flatMap((f, fi) => {
      const out = []
      for (let x = f.x0 + 4; x < f.x1 - 3; x += f.main ? 5 : 4) {
        out.push({ fi, x: x + Math.floor(R() * 3), len: 10 + Math.floor(R() * 26), sp: 3 + Math.floor(R() * 4), ph: Math.floor(R() * 400) })
      }
      return out
    })
    const flies = Array.from({ length: 16 }, (_, i) => ({ x: R() < 0.5 ? 20 + R() * 420 : 960 + R() * 400, y: 420 + R() * 330, ph: R() * 100, sp: 0.4 + R() * 0.6 }))
    const stars = Array.from({ length: 26 }, () => ({ x: SCENE.sky.x0 + R() * (SCENE.sky.x1 - SCENE.sky.x0), y: 8 + R() * (SCENE.sky.y1 - 30), ph: Math.floor(R() * 60) }))
    const winPh = SCENE.windows.map(() => R() * 50)
    let f = 0, raf = 0, last = 0, alive = true

    function draw() {
      const dark = themeRef.current === 'dark'
      ctx.clearRect(0, 0, SCENE.w, SCENE.h)
      if (reduced) return

      // falling water: soft light streaks sliding down each fall
      for (const st of streaks) {
        const fl = SCENE.falls[st.fi], span = fl.y1 - fl.y0 + st.len
        const y = fl.y0 - st.len + ((st.ph + f * st.sp) % span)
        ctx.fillStyle = dark ? 'rgba(190,215,255,0.20)' : 'rgba(255,255,255,0.42)'
        const yTop = Math.max(fl.y0, y), yBot = Math.min(fl.y1 - 6, y + st.len)
        if (yBot > yTop) ctx.fillRect(st.x, yTop, 2, yBot - yTop)
      }
      // foam flicker where the main fall hits the pool
      const mf = SCENE.falls[0]
      ctx.fillStyle = dark ? 'rgba(200,225,255,0.55)' : 'rgba(255,255,255,0.85)'
      for (let i = 0; i < 46; i++) {
        const hx = hash(i, f >> 1, 1), hy = hash(i, f >> 1, 2)
        const x = mf.x0 - 10 + hx * (mf.x1 - mf.x0 + 20), y = mf.y1 - 14 + hy * hy * 18
        ctx.fillRect(Math.round(x), Math.round(y), hx > 0.8 ? 4 : 3, 3)
      }
      // pool ripples spreading from the fall
      for (let k = 0; k < 3; k++) {
        const t = ((f + k * 22) % 66) / 66, a = (1 - t) * (dark ? 0.35 : 0.55)
        ctx.strokeStyle = dark ? `rgba(170,200,240,${a})` : `rgba(255,255,255,${a})`
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.ellipse(SCENE.pool.cx, SCENE.pool.cy + 6, 100 + t * 170, 10 + t * 26, 0, 0, Math.PI * 2); ctx.stroke()
      }

      // the egg: a little wobble every ~5 s
      const img = dark ? nightImg.current : dayImg.current
      const w = f % 60
      if (img && img.complete && w < 8) {
        const e = SCENE.egg, ang = Math.sin(w / 8 * Math.PI * 3) * 0.09 * (1 - w / 8)
        ctx.save()
        ctx.translate(e.cx, e.cy + e.ry)
        ctx.rotate(ang)
        ctx.beginPath(); ctx.ellipse(0, -e.ry, e.rx + 1, e.ry + 1, 0, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(img, e.cx - e.rx - 2, e.cy - e.ry - 2, e.rx * 2 + 4, e.ry * 2 + 4, -e.rx - 2, -e.ry * 2 - 2, e.rx * 2 + 4, e.ry * 2 + 4)
        ctx.restore()
      }

      if (dark) {
        // windows breathe, lanterns glow, stars twinkle, fireflies drift
        SCENE.windows.forEach(([x, y, ww, hh], i) => {
          ctx.fillStyle = `rgba(255,200,110,${0.08 + 0.08 * Math.sin((f + winPh[i]) / 9)})`
          ctx.fillRect(x, y, ww, hh)
        })
        for (const [x, y] of SCENE.lanterns) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 22)
          g.addColorStop(0, `rgba(255,205,120,${0.32 + 0.08 * Math.sin(f / 7 + x)})`); g.addColorStop(1, 'rgba(255,205,120,0)')
          ctx.fillStyle = g; ctx.fillRect(x - 22, y - 22, 44, 44)
        }
        for (const s of stars) if ((f + s.ph) % 60 < 6) { ctx.fillStyle = 'rgba(255,255,240,0.9)'; ctx.fillRect(s.x - 1, s.y, 3, 1); ctx.fillRect(s.x, s.y - 1, 1, 3) }
        for (const fl of flies) {
          const t = f * 0.05 * fl.sp + fl.ph
          const x = fl.x + Math.sin(t * 0.9) * 24, y = fl.y + Math.sin(t * 1.4) * 12
          const on = Math.sin(t * 2.1) > -0.1
          if (on) {
            ctx.fillStyle = 'rgba(250,236,140,0.95)'; ctx.fillRect(x, y, 3, 3)
            ctx.fillStyle = 'rgba(250,236,140,0.25)'; ctx.fillRect(x - 3, y - 3, 9, 9)
          }
        }
      }
    }

    const loop = t => {
      if (!alive) return
      raf = requestAnimationFrame(loop)
      if (document.hidden || t - last < 80) return
      last = t; f++; draw()
    }
    draw()
    if (!reduced) raf = requestAnimationFrame(loop)
    const onTheme = () => draw()
    window.addEventListener('db-theme', onTheme)
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('db-theme', onTheme) }
  }, [])

  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-art" ref={wrap}>
        <img ref={dayImg} src="/scene/day.webp" alt="" className="scene-img" />
        <img ref={nightImg} src="/scene/night.webp" alt="" className={`scene-img night${theme === 'dark' ? ' on' : ''}`} />
        <canvas ref={cv} width={SCENE.w} height={SCENE.h} className="scene-fx" />
      </div>
    </div>
  )
}
