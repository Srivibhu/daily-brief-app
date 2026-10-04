// Pixel-art waterfall scene for the page background.
// Every pixel is a flat palette colour (no gradients). The scene is generated once
// per size/theme from a seeded RNG, then a few dynamic layers (water, mist, splashes,
// critters, clouds/stars) are painted over it at ~10 fps.

const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

export const PALETTES = {
  light: {
    sky: '#dde8d0', cloud: '#f4f7ea', sun: '#f2dc8c',
    hillFar: '#c5d5aa', hillNear: '#b0c692', pine: '#8eab72',
    rockD: '#7c836b', rockM: '#969c83', rockL: '#afb49a',
    mossD: '#5b7b3b', mossM: '#7a9b4d', mossL: '#9fbe6a',
    waterD: '#84bac3', waterM: '#a7d5d9', waterL: '#d0edee', foam: '#f3fbf8', mist: '#eaf6f1',
    pool: '#92c4ca', poolD: '#78aeb7',
    cap: '#c8503c', capDot: '#f6f0dc', stem: '#efe6cc', flower: '#f0d27a', flower2: '#f6f0dc',
    wing: '#e9a07d', wing2: '#f6f0dc', body: '#4a3a2c',
  },
  dark: {
    sky: '#131c18', star: '#e8efd8', moon: '#efe8c8', moonD: '#cfc7a2',
    hillFar: '#1b2921', hillNear: '#213227', pine: '#182719',
    rockD: '#292d24', rockM: '#353a2f', rockL: '#434939',
    mossD: '#33502a', mossM: '#476f2f', mossL: '#699340',
    waterD: '#346875', waterM: '#4c8b97', waterL: '#7ebcc5', foam: '#c9ecee', mist: '#8fbcc2',
    pool: '#2d5a66', poolD: '#254c57',
    cap: '#b9503f', capDot: '#e9e1c4', stem: '#d8cfb2', flower: '#d9bf6c', flower2: '#e9e1c4',
    fire: '#f3e08a', fireD: '#8a7d3c',
  },
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash2(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s)
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function createWaterfall(canvas, { theme = 'light', reduced = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false })
  let W = 0, H = 0, P = 5
  let img, base, kind, C, dark, themeName = theme
  let ledge, ledgeY, poolY, falls = [], clouds = [], stars = [], critters = [], parts = []
  let colPhase, colSpeed, colLen
  let raf = 0, last = 0, frame = 0, resizeT = 0, alive = true

  function build() {
    dark = themeName === 'dark'
    const pal = PALETTES[dark ? 'dark' : 'light']
    C = {}; for (const k in pal) C[k] = rgb(pal[k])
    const rnd = mulberry32(dark ? 7 : 11)
    base = new Uint8ClampedArray(W * H * 4)
    kind = new Uint8Array(W * H) // 0 sky · 1 solid · 2 pool
    img = ctx.createImageData(W, H)
    const set = (x, y, c, k) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return
      const i = y * W + x
      base[i * 4] = c[0]; base[i * 4 + 1] = c[1]; base[i * 4 + 2] = c[2]; base[i * 4 + 3] = 255
      if (k !== undefined) kind[i] = k
    }

    ledgeY = Math.round(H * 0.33)
    poolY = Math.round(H * 0.8)

    // fall definitions ------------------------------------------------------
    falls = [{ x: Math.round(W * 0.5), w: clamp(Math.round(W * 0.055), 6, 15), main: true }]
    if (W > 120) {
      falls.push({ x: Math.round(W * 0.05), w: 4 }, { x: Math.round(W * 0.95), w: 4 })
    }
    ledge = new Int16Array(W)
    for (let x = 0; x < W; x++) ledge[x] = ledgeY + Math.round((vnoise(x / 16, 1.5, 1) - 0.5) * 6)
    falls.forEach((f, i) => {
      f.y0 = ledgeY + 2
      f.left = []; f.right = []
      const span = poolY - f.y0
      for (let y = f.y0; y < poolY; y++) {
        const wob = Math.round((vnoise(y / 9, i * 3.3, 41) - 0.5) * 3)
        const grow = Math.round(((y - f.y0) / span) * 2)
        f.left.push(f.x - Math.floor(f.w / 2) + wob - grow)
        f.right.push(f.x + Math.floor(f.w / 2) + wob + grow)
      }
      // carve a channel into the ledge so water pours over a lip
      for (let x = f.x - Math.floor(f.w / 2) - 2; x <= f.x + Math.floor(f.w / 2) + 2; x++) {
        if (x >= 0 && x < W) ledge[x] = f.y0
      }
    })
    const nearFall = x => {
      let d = 1e9
      for (const f of falls) d = Math.min(d, Math.abs(x - f.x) - f.w / 2)
      return d
    }

    // sky, hills, pines ------------------------------------------------------
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, C.sky, 0)
    const hillN = new Int16Array(W)
    for (let x = 0; x < W; x++) {
      const hf = ledgeY - 6 - Math.round(vnoise(x / 26, 3, 5) * ledgeY * 0.38)
      hillN[x] = ledge[x] - 1 - Math.round(vnoise(x / 13, 7, 9) * 5)
      for (let y = hf; y < ledge[x]; y++) set(x, y, y >= hillN[x] ? C.hillNear : C.hillFar, 1)
    }
    const nTrees = Math.round(W / 14)
    for (let t = 0; t < nTrees; t++) {
      const x = Math.floor(rnd() * W), h = 6 + Math.floor(rnd() * 6), by = hillN[x] + 1
      for (let r = 0; r < h; r++) {
        const hw = 1 + Math.floor(r * 0.45), y = by - h + r
        for (let xx = x - hw; xx <= x + hw; xx++) if (y < ledge[clamp(xx, 0, W - 1)]) set(xx, y, C.pine, 1)
      }
    }
    // sun / moon
    if (dark) {
      const mx = Math.round(W * 0.84), my = Math.round(H * 0.11)
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        if (dx * dx + dy * dy <= 24) {
          const crater = (dx === -2 && dy === -1) || (dx === 1 && dy === 2) || (dx === 2 && dy === -2)
          set(mx + dx, my + dy, crater ? C.moonD : C.moon, 1)
        }
      }
      stars = []
      const n = Math.round(W / 4)
      for (let s = 0; s < n; s++) {
        const x = Math.floor(rnd() * W), y = Math.floor(rnd() * ledgeY * 0.42)
        if (kind[y * W + x] === 0) stars.push({ x, y, ph: Math.floor(rnd() * 40), big: rnd() > 0.85 })
      }
      clouds = []
    } else {
      const sx = Math.round(W * 0.12), sy = Math.round(H * 0.1)
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 16) set(sx + dx, sy + dy, C.sun, 1)
      clouds = Array.from({ length: 4 }, (_, i) => ({
        x: rnd() * W, y: Math.round(H * (0.06 + rnd() * 0.16)), w: 12 + Math.floor(rnd() * 14), s: 0.15 + rnd() * 0.2,
      }))
      stars = []
    }

    // cliff face: strata + moss ---------------------------------------------
    for (let x = 0; x < W; x++) {
      for (let y = ledge[x]; y < H; y++) {
        const t = vnoise(x / 5, y / 2.5, 11) * 0.55 + vnoise(x / 2, y / 1.3, 12) * 0.45
        let c = t < 0.36 ? C.rockD : t > 0.64 ? C.rockL : C.rockM
        const fromTop = y - ledge[x]
        const nf = nearFall(x)
        let m = vnoise(x / 6, y / 6, 21)
        m += Math.max(0, 1 - fromTop / (H * 0.17)) * 0.5
        m += nf < 10 ? 0.4 * (1 - Math.max(0, nf) / 10) : 0
        m += y > poolY - 12 ? 0.3 : 0
        if (m > 0.72) {
          const n2 = vnoise(x / 2.5, y / 2.5, 22)
          c = n2 < 0.4 ? C.mossD : n2 < 0.75 ? C.mossM : C.mossL
        }
        set(x, y, c, 1)
      }
    }
    // hanging vines
    for (let x = 0; x < W; x++) {
      if (nearFall(x) < 1 || hash2(x, 0, 61) > 0.16) continue
      const len = 3 + Math.floor(hash2(x, 1, 62) * (H * 0.09))
      for (let k = 0; k < len; k++) {
        set(x, ledge[x] + k, k % 4 === 3 ? C.mossL : C.mossM, 1)
        if (k % 3 === 1 && hash2(x, k, 63) > 0.4) set(x + (k % 2 ? 1 : -1), ledge[x] + k, C.mossL, 1)
      }
      set(x, ledge[x] + len, C.mossD, 1)
    }
    // moss mounds on top of the ledge
    for (let x = 0; x < W; x++) {
      if (nearFall(x) < 2) continue
      const h = 1 + Math.round(vnoise(x / 3.5, 0, 31) * 3)
      for (let k = 1; k <= h; k++) set(x, ledge[x] - k, k === h ? C.mossL : k === 1 ? C.mossD : C.mossM, 1)
    }
    // tiny mushrooms + flowers on the moss
    const nMush = Math.max(3, Math.round(W / 55))
    for (let m = 0; m < nMush; m++) {
      const x = 3 + Math.floor(rnd() * (W - 6))
      if (nearFall(x) < 4) continue
      const gy = ledge[x] - 1 - Math.round(vnoise(x / 3.5, 0, 31) * 3)
      set(x, gy, C.stem, 1); set(x, gy - 1, C.stem, 1)
      for (let dx = -1; dx <= 1; dx++) set(x + dx, gy - 2, C.cap, 1)
      set(x, gy - 3, C.cap, 1)
      set(x - 1, gy - 2, C.capDot, 1)
    }
    const nFlower = Math.round(W / 22)
    for (let m = 0; m < nFlower; m++) {
      const x = Math.floor(rnd() * W)
      if (nearFall(x) < 3) continue
      const gy = ledge[x] - 2 - Math.round(vnoise(x / 3.5, 0, 31) * 3)
      set(x, gy, rnd() > 0.5 ? C.flower : C.flower2, 1)
    }

    // pool ------------------------------------------------------------------
    for (let y = poolY; y < H; y++) for (let x = 0; x < W; x++) set(x, y, C.pool, 2)
    // mossy stepping stones
    const nRock = Math.max(4, Math.round(W / 34))
    for (let r = 0; r < nRock; r++) {
      const cx = Math.floor(rnd() * W), rx = 4 + Math.floor(rnd() * 6), ry = 3 + Math.floor(rnd() * 3)
      const cy = poolY + 2 + Math.floor(rnd() * 9)
      if (Math.abs(cx - falls[0].x) < falls[0].w + rx) continue
      for (let dy = -ry; dy <= 0; dy++) for (let dx = -rx; dx <= rx; dx++) {
        if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1) continue
        const top = dy + ry
        let c = top > ry - 2 ? C.rockD : top > ry - 4 ? C.rockM : C.rockL
        if (top <= 1 + (hash2(cx + dx, 0, 71) > 0.5 ? 1 : 0)) c = hash2(cx + dx, dy, 72) > 0.6 ? C.mossL : C.mossM
        set(cx + dx, cy + dy, c, 1)
      }
    }
    // foreground moss tufts
    for (let x = 0; x < W; x++) {
      const h = 2 + Math.round(vnoise(x / 3, 0, 51) * 4)
      for (let k = 0; k < h; k++) {
        const y = H - 1 - k
        set(x, y, k === h - 1 ? (hash2(x, k, 73) > 0.5 ? C.mossL : C.mossM) : C.mossD, 1)
      }
    }

    // per-column water tables
    colPhase = new Uint8Array(W); colSpeed = new Uint8Array(W); colLen = new Uint8Array(W)
    for (let x = 0; x < W; x++) {
      colPhase[x] = Math.floor(hash2(x, 0, 81) * 24)
      colSpeed[x] = 2 + (hash2(x, 0, 82) > 0.55 ? 1 : 0)
      colLen[x] = 7 + Math.floor(hash2(x, 0, 83) * 9)
    }

    // critters
    const total = dark ? 10 : 3
    critters = Array.from({ length: total }, (_, i) => ({
      x: rnd() * W, y: dark ? ledgeY - 8 + rnd() * (H - ledgeY) * 0.8 : ledgeY - 14 + rnd() * 10 + (i === 2 ? (poolY - ledgeY) * 0.7 : 0),
      ph: rnd() * 100, sp: 0.5 + rnd() * 0.7,
    }))
    parts = []
  }

  // ── per-frame drawing ────────────────────────────────────────────────────
  function px(d, x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = (y * W + x) * 4
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255
  }
  function pxSky(d, x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H || kind[y * W + x] !== 0) return
    px(d, x, y, c)
  }

  function draw() {
    const d = img.data
    d.set(base)
    const f = frame

    // clouds / stars
    if (dark) {
      for (const s of stars) {
        const tw = (f + s.ph) % 40
        if (tw < 30) pxSky(d, s.x, s.y, C.star)
        if (s.big && tw < 20) { pxSky(d, s.x - 1, s.y, C.star); pxSky(d, s.x + 1, s.y, C.star); pxSky(d, s.x, s.y - 1, C.star); pxSky(d, s.x, s.y + 1, C.star) }
      }
    } else {
      for (const c of clouds) {
        const cx = Math.floor(((c.x + f * c.s) % (W + c.w * 2)) - c.w)
        const rows = [Math.round(c.w * 0.45), Math.round(c.w * 0.75), c.w]
        rows.forEach((rw, r) => { for (let dx = -Math.floor(rw / 2); dx <= Math.floor(rw / 2); dx++) pxSky(d, cx + dx, c.y + r, C.cloud) })
        for (let dx = -Math.floor(c.w * 0.15); dx <= Math.floor(c.w * 0.15); dx++) pxSky(d, cx + dx - 2, c.y - 1, C.cloud)
      }
    }

    // waterfalls
    falls.forEach((fl, fi) => {
      for (let y = fl.y0 - 1; y < poolY; y++) {
        const idx = y - fl.y0
        const l = idx >= 0 ? fl.left[idx] : fl.left[0], r = idx >= 0 ? fl.right[idx] : fl.right[0]
        for (let x = l; x <= r; x++) {
          const dEdge = Math.min(x - l, r - x)
          if (dEdge === 0 && hash2(x, y, 90 + fi) < 0.45) continue
          let c
          if (y <= fl.y0 + 1) c = ((x + f) & 3) === 0 ? C.foam : C.waterL
          else if (y >= poolY - 2) c = ((x + f) & 1) ? C.foam : C.waterL
          else {
            const L = colLen[x], yy = (((y + colPhase[x] - f * colSpeed[x]) % L) + L) % L
            if (dEdge <= 1) c = C.waterD
            else if (yy <= 1) c = C.waterL
            else if (yy === 2 && hash2(x, 0, 84) > 0.5) c = C.foam
            else if (yy >= L - 2) c = C.waterD
            else c = C.waterM
          }
          px(d, x, y, c)
        }
      }
    })

    // pool surface
    for (let y = poolY; y < H; y++) {
      const r = y - poolY, per = 9 + (r % 4) * 3, dir = r & 1 ? 1 : -1, sp = 2 + (r % 3)
      const shift = Math.floor(f / sp) * dir
      for (let x = 0; x < W; x++) {
        if (kind[y * W + x] !== 2) continue
        const v = (((x + shift + r * 13) % per) + per) % per
        let c = null
        if (r % 3 === 0 && v < 3 + (r % 2) * 2) c = C.waterL
        else if (r >= 6 && r % 4 === 1) c = C.poolD
        else if (r % 4 === 2 && v < 3) c = C.poolD
        if (hash2(x, y, 100 + (f >> 2)) > 0.9965) c = C.foam
        if (c) px(d, x, y, c)
      }
    }
    // ripple rings under each fall
    falls.forEach(fl => {
      for (let k = 0; k < 3; k++) {
        const rr = (f * 0.5 + k * 7) % 21
        if (rr < 2.5) continue
        const a = rr * (fl.main ? 1 : 0.6), b = Math.max(1, rr * 0.28)
        for (let y = poolY; y < poolY + Math.ceil(b) + 4; y++) for (let x = Math.floor(fl.x - a - 1); x <= Math.ceil(fl.x + a + 1); x++) {
          if (y < 0 || y >= H || x < 0 || x >= W || kind[y * W + x] !== 2) continue
          const e = ((x - fl.x) / a) ** 2 + ((y - (poolY + 3)) / b) ** 2
          if (Math.abs(e - 1) < 0.28 && (rr < 13 || (x + y) % 2 === 0)) px(d, x, y, C.waterL)
        }
      }
    })

    // mist (stippled, re-rolled every other frame)
    falls.forEach((fl, fi) => {
      const halfW = fl.w * (fl.main ? 2.6 : 3.2), hgt = fl.main ? 15 : 9
      for (let y = poolY - hgt; y <= poolY + 2; y++) for (let x = Math.floor(fl.x - halfW); x <= Math.ceil(fl.x + halfW); x++) {
        if (x < 0 || x >= W || y < 0) continue
        const dx = 1 - Math.abs(x - fl.x) / halfW, dy = 1 - (poolY + 2 - y) / (hgt + 2)
        if (dx <= 0 || dy <= 0) continue
        if (hash2(x, y, 110 + fi * 7 + (f >> 1)) < dx * dy * 0.62) px(d, x, y, C.mist)
      }
    })

    // splash particles
    for (const p of parts) if (p.y <= poolY + 1) { px(d, Math.round(p.x), Math.round(p.y), C.foam); if (p.life > 6) px(d, Math.round(p.x), Math.round(p.y) - 1, C.waterL) }

    // butterflies (day) / fireflies (night)
    critters.forEach((c, i) => {
      const t = f * 0.11 * c.sp + c.ph
      const x = Math.round(((c.x + Math.sin(t * 0.7) * 10 + f * 0.05 * c.sp) % (W + 8)) - 4)
      const y = Math.round(c.y + Math.sin(t * 1.3) * 5)
      if (dark) {
        const glow = Math.sin(t * 1.1) > -0.2
        if (glow) { px(d, x, y, C.fire); if (Math.sin(t * 1.1) > 0.85) { px(d, x - 1, y, C.fireD); px(d, x + 1, y, C.fireD); px(d, x, y - 1, C.fireD); px(d, x, y + 1, C.fireD) } }
      } else {
        const open = ((f + i * 2) >> 1) % 2 === 0
        const wc = i % 2 ? C.wing : C.wing2
        px(d, x, y, C.body)
        if (open) { px(d, x - 1, y - 1, wc); px(d, x + 1, y - 1, wc); px(d, x - 1, y, wc); px(d, x + 1, y, wc) }
        else { px(d, x, y - 1, wc); px(d, x, y - 2, wc) }
      }
    })

    ctx.putImageData(img, 0, 0)
  }

  function step() {
    frame++
    falls.forEach(fl => {
      const n = fl.main ? 3 : 1
      for (let k = 0; k < n; k++) {
        parts.push({ x: fl.x + (Math.random() - 0.5) * fl.w, y: poolY, vx: (Math.random() - 0.5) * 2.2, vy: -(0.9 + Math.random() * 2.3), life: 8 + Math.random() * 6 })
      }
    })
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.36; p.life -= 1 }
    parts = parts.filter(p => p.life > 0 && p.y <= poolY + 2)
  }

  function loop(t) {
    if (!alive) return
    raf = requestAnimationFrame(loop)
    if (t - last < 100) return
    last = t
    step(); draw()
  }

  let lastVw = 0
  const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight
    // On phones the address bar collapsing/expanding fires resize with only a height change.
    // Size the canvas to the tallest viewport up front and skip rebuilds that don't need one.
    if (W && vw === lastVw && vh <= H * P) return
    lastVw = vw
    const tall = touch ? Math.max(vh, (window.screen && window.screen.height) || 0) : vh
    P = clamp(Math.round(vw / 240), 4, 9)
    W = Math.ceil(vw / P); H = Math.ceil(tall / P)
    canvas.width = W; canvas.height = H
    canvas.style.width = W * P + 'px'; canvas.style.height = H * P + 'px'
    build(); draw()
  }
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(resize, 150) }

  resize()
  window.addEventListener('resize', onResize)
  if (!reduced) raf = requestAnimationFrame(loop)

  return {
    setTheme(name) { if (name !== themeName) { themeName = name; build(); draw() } },
    destroy() { alive = false; cancelAnimationFrame(raf); clearTimeout(resizeT); window.removeEventListener('resize', onResize) },
    // test hook: advance n frames synchronously
    _advance(n) { for (let i = 0; i < n; i++) step(); draw() },
  }
}
