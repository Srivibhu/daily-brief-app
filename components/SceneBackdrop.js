import { useEffect, useRef } from 'react'
import { useTheme } from '../lib/theme'
import { createCritters, pxRect, pxEllipse, snap, P } from '../lib/critters'
import { createPet } from '../lib/pet'

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

// Phones swipe between pages and the scene walks along the cliff with them. Each page has a stop
// (the art x to centre): Tasks by the house and egg, Focus at the falls, Calendar by the pool,
// Stats at the gazebo. Stops are spaced so the scene never moves faster than the cards.
export const PAN_STOPS = [300, 655, 960, 1199]
let pan = null, wrapEl = null
function panX(p) {
  const n = PAN_STOPS.length - 1, q = Math.max(0, Math.min(n, p)), i = Math.min(n - 1, Math.floor(q))
  return PAN_STOPS[i] + (PAN_STOPS[i + 1] - PAN_STOPS[i]) * (q - i)
}
function placeScene() {
  if (!wrapEl) return
  const vw = window.innerWidth, vh = window.innerHeight, b = sceneBox(vw, vh)
  const left = pan === null ? b.left : Math.min(0, Math.max(vw - b.width, vw / 2 - panX(pan) * b.s))
  const st = wrapEl.style
  st.width = b.width + 'px'; st.height = b.height + 'px'; st.top = b.top + 'px'; st.left = '0px'
  st.transform = `translate3d(${left}px,0,0)`
  // where the landmarks are on screen, so the layout can sit around them (egg house, falls, gazebo)
  const r = document.documentElement.style, X = ax => Math.round(left + ax * b.s) + 'px', Y = ay => Math.round(b.top + ay * b.s) + 'px'
  r.setProperty('--egg-l', X(308)); r.setProperty('--egg-r', X(442)); r.setProperty('--egg-b', Y(432))
  r.setProperty('--scene-l', Math.round(left) + 'px'); r.setProperty('--scene-t', Math.round(b.top) + 'px'); r.setProperty('--scene-s', String(b.s))
  r.setProperty('--falls-l', X(648)); r.setProperty('--falls-r', X(838)); r.setProperty('--gaz-l', X(1120))
}
// p = page position as a float (0 = Tasks … 3 = Stats), or null to go back to the fixed layout
export function setScenePan(p) { pan = p; placeScene() }

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
    wrapEl = wrap.current
    placeScene()
    window.addEventListener('resize', placeScene)
    return () => { window.removeEventListener('resize', placeScene); wrapEl = null }
  }, [])

  // animation loop (~12 fps, paused when the tab is hidden, off for reduced motion)
  useEffect(() => {
    // the canvas is the art's own pixel grid (one cell = 3 art pixels); everything is drawn in art coordinates
    const ctx = cv.current.getContext('2d')
    ctx.setTransform(1 / P, 0, 0, 1 / P, 0, 0)
    ctx.imageSmoothingEnabled = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const R = rng(42)
    const streaks = SCENE.falls.flatMap((f, fi) => {
      const out = []
      for (let x = snap(f.x0 + 6); x < f.x1 - 3; x += P * 2) {
        if (R() < 0.35) continue
        out.push({ fi, x, len: P * (4 + Math.floor(R() * 8)), sp: P * (1 + Math.floor(R() * 2)), ph: P * Math.floor(R() * 140) })
      }
      return out
    })
    const flies = Array.from({ length: 16 }, (_, i) => ({ x: R() < 0.5 ? 20 + R() * 420 : 960 + R() * 400, y: 420 + R() * 330, ph: R() * 100, sp: 0.4 + R() * 0.6 }))
    const stars = Array.from({ length: 26 }, () => ({ x: SCENE.sky.x0 + R() * (SCENE.sky.x1 - SCENE.sky.x0), y: 8 + R() * (SCENE.sky.y1 - 30), ph: Math.floor(R() * 60) }))
    const winPh = SCENE.windows.map(() => R() * 50)
    const critters = createCritters()
    const pet = createPet()
    let f = 0, raf = 0, last = 0, alive = true

    function draw() {
      const dark = themeRef.current === 'dark'
      ctx.clearRect(0, 0, SCENE.w, SCENE.h)
      const img = dark ? nightImg.current : dayImg.current
      if (reduced) { critters.draw(ctx, 0, dark, img, true); pet.draw(ctx, 0, dark, img, true); return }

      // falling water: soft light streaks sliding down each fall
      for (const st of streaks) {
        const fl = SCENE.falls[st.fi], span = fl.y1 - fl.y0 + st.len
        const y = fl.y0 - st.len + ((st.ph + f * st.sp) % span)
        ctx.fillStyle = dark ? 'rgba(190,215,255,0.28)' : 'rgba(255,255,255,0.55)'
        const yTop = Math.max(fl.y0, y), yBot = Math.min(fl.y1 - 6, y + st.len)
        if (yBot > yTop) pxRect(ctx, st.x, yTop, P, yBot - yTop)
      }
      // foam flicker where the main fall hits the pool
      const mf = SCENE.falls[0]
      ctx.fillStyle = dark ? 'rgba(200,225,255,0.55)' : 'rgba(255,255,255,0.85)'
      for (let i = 0; i < 46; i++) {
        const hx = hash(i, f >> 1, 1), hy = hash(i, f >> 1, 2)
        const x = mf.x0 - 10 + hx * (mf.x1 - mf.x0 + 20), y = mf.y1 - 14 + hy * hy * 18
        pxRect(ctx, x, y, hx > 0.8 ? 6 : 3, 3)
      }
      // pool ripples spreading from the fall
      for (let k = 0; k < 3; k++) {
        const t = ((f + k * 22) % 66) / 66, a = (1 - t) * (dark ? 0.35 : 0.55)
        ctx.fillStyle = dark ? `rgba(170,200,240,${a})` : `rgba(255,255,255,${a})`
        pxEllipse(ctx, SCENE.pool.cx, SCENE.pool.cy + 6, 100 + t * 170, 10 + t * 26)
      }

      // dog, frogs, rabbits, birds
      critters.draw(ctx, f, dark, img, false)

      // the egg (or the bird it became)
      pet.draw(ctx, f, dark, img, false)

      if (dark) {
        // windows breathe, lanterns glow, stars twinkle, fireflies drift
        SCENE.windows.forEach(([x, y, ww, hh], i) => {
          ctx.fillStyle = `rgba(255,200,110,${0.08 + 0.08 * Math.sin((f + winPh[i]) / 9)})`
          pxRect(ctx, x, y, ww, hh)
        })
        for (const [x, y] of SCENE.lanterns) {
          // stepped pixel glow: three rings of cells, brighter toward the lamp
          const a = 0.16 + 0.05 * Math.sin(f / 7 + x)
          for (const [r, k] of [[21, 1], [14, 1.6], [7, 2.4]]) {
            ctx.fillStyle = `rgba(255,205,120,${a * k / 2.4})`
            for (let dy = -r; dy <= r; dy += P) for (let dx = -r; dx <= r; dx += P) if (dx * dx + dy * dy <= r * r && dx * dx + dy * dy > (r - 7) * (r - 7)) pxRect(ctx, x + dx, y + dy)
          }
        }
        for (const s of stars) if ((f + s.ph) % 60 < 6) { ctx.fillStyle = 'rgba(255,255,240,0.9)'; pxRect(ctx, s.x - 3, s.y); pxRect(ctx, s.x + 3, s.y); pxRect(ctx, s.x, s.y - 3); pxRect(ctx, s.x, s.y + 3) }
        for (const fl of flies) {
          const t = f * 0.05 * fl.sp + fl.ph
          const x = fl.x + Math.sin(t * 0.9) * 24, y = fl.y + Math.sin(t * 1.4) * 12
          const on = Math.sin(t * 2.1) > -0.1
          if (on) {
            ctx.fillStyle = 'rgba(250,236,140,0.25)'; pxRect(ctx, x - 3, y - 3, 9, 9)
            ctx.fillStyle = 'rgba(250,236,140,0.95)'; pxRect(ctx, x, y)
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
    dayImg.current?.addEventListener('load', onTheme); nightImg.current?.addEventListener('load', onTheme)
    window.addEventListener('db-theme', onTheme); window.addEventListener('db-scene', onTheme)
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('db-theme', onTheme); window.removeEventListener('db-scene', onTheme) }
  }, [])

  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-art" ref={wrap}>
        <img ref={dayImg} src="/scene/day.webp" alt="" className="scene-img" />
        <img ref={nightImg} src="/scene/night.webp" alt="" className={`scene-img night${theme === 'dark' ? ' on' : ''}`} />
        <canvas ref={cv} width={Math.ceil(SCENE.w / 3)} height={Math.ceil(SCENE.h / 3)} className="scene-fx" />
      </div>
    </div>
  )
}
