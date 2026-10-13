// Pixel critters that live in the scene: a dog asleep in its bed on the porch, frogs on lily pads,
// rabbits in the front meadow and the odd flock of birds. Drawn on the scene canvas in art pixels
// (1376 × 768) on the same 3-art-pixel grid as the illustration: one sprite pixel = one art "pixel".

export const P = 3
export const snap = v => Math.round(v / P) * P
// grid-true primitives for the scene canvas
export function pxRect(ctx, x, y, w = P, h = P) { ctx.fillRect(snap(x), snap(y), Math.max(P, snap(w)), Math.max(P, snap(h))) }
export function pxEllipse(ctx, cx, cy, rx, ry) {
  const seen = new Set(), n = Math.max(12, Math.round((rx + ry) / 2))
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = snap(cx + Math.cos(a) * rx), y = snap(cy + Math.sin(a) * ry), k = x + ',' + y
    if (!seen.has(k)) { seen.add(k); ctx.fillRect(x, y, P, P) }
  }
}
// draw a sprite on the grid, optionally mirrored
export function put(ctx, sp, x, y, flip = false) {
  x = snap(x); y = snap(y)
  if (!flip) return ctx.drawImage(sp, x, y)
  ctx.save(); ctx.translate(x + sp.width, y); ctx.scale(-1, 1); ctx.drawImage(sp, 0, 0); ctx.restore()
}
// sprite from rows of palette letters ('.' = empty)
export function grid(rows, pal) { return rows.map(r => [...r].map(c => (c === '.' || c === ' ') ? null : pal[c])) }

const C = {
  out: '#2e1d10',
  fawn: '#d2a266', fawnL: '#ecc68e', fawnD: '#94612f', muzzle: '#f0dfbc', nose: '#21140b',
  bed: '#a8473a', bedL: '#d07059', bedD: '#7a2f28', check: '#ecd6b2',
  frog: '#5f9a3a', frogL: '#9cc35a', frogD: '#3c6824', frogOut: '#1d3311', belly: '#dfe8a4', eye: '#f7f2da', pupil: '#120d07',
  pad: '#4c8833', padL: '#79b04e', padOut: '#1f3d17', petal: '#f1a9c0', petalL: '#fde0ea',
  bun: '#a58d72', bunL: '#cdb99a', bunD: '#7b6650', bunOut: '#382a1c', tail: '#f6f1e6', pink: '#e09a9a',
  bird: '#3a3d48',
}

// ── sprite builder ────────────────────────────────────────────────────────────
// ops: ['e', cx, cy, rx, ry, colour] ellipse · ['p', [[x,y]...], colour|null] pixels · ['o', colour] outline pass
export function build(w, h, ops) {
  const g = Array.from({ length: h }, () => Array(w).fill(null))
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c }
  for (const o of ops) {
    if (o[0] === 'e') {
      const [, cx, cy, rx, ry, c] = o
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) g[y][x] = C[c] || c
    } else if (o[0] === 'p') {
      for (const [x, y] of o[1]) put(x, y, o[2] ? C[o[2]] || o[2] : null)
    } else if (o[0] === 'o') {
      const add = []
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (g[y][x]) continue
        if ((g[y - 1] && g[y - 1][x]) || (g[y + 1] && g[y + 1][x]) || g[y][x - 1] || g[y][x + 1]) add.push([x, y])
      }
      for (const [x, y] of add) g[y][x] = C[o[1]] || o[1]
    }
  }
  return g
}

// night: the same moonlit cooling the illustration got, a touch lighter so the critters still read
export function nightify(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  const c = v => Math.max(0, Math.min(255, Math.round(v)))
  return `rgb(${c(r * 0.36 + 10)},${c(g * 0.4 + 14)},${c(b * 0.55 + 30)})`
}

export function render(grid, dark, scale = P) {
  const cv = document.createElement('canvas')
  cv.width = grid[0].length * scale; cv.height = grid.length * scale
  const x = cv.getContext('2d')
  grid.forEach((row, y) => row.forEach((c, i) => { if (c) { x.fillStyle = dark ? nightify(c) : c; x.fillRect(i * scale, y * scale, scale, scale) } }))
  return cv
}

// ── sprite sheet ──────────────────────────────────────────────────────────────
// The dog: black with a white blaze, chest and paws, rose ears, curled up asleep on a grey blanket
const DOGPAL = { k: '#141010', b: '#2c2624', h: '#5a514c', w: '#efe9df', s: '#c9c1b5', n: '#050404', p: '#a06a6a', G: '#b2ada6', d: '#7a766f', o: '#47433f' }
function dogGrid(breath = 0, ear = 0) {
  const W = 24, H = 14, g = Array.from({ length: H }, () => Array(W).fill('.'))
  const stamp = (rows, x0, y0) => rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.' && g[y0 + y] && x0 + x < W) g[y0 + y][x0 + x] = c }))
  stamp(['..oooooooooooooooooooo..', '.oGGGGGGdGGGGGGGGdGGGGo.', 'oGGdGGGGGGGGdGGGGGGGdGGo', '.oooooooooooooooooooooo.'], 0, 10)
  stamp(['....kkkkkkkk....', '..kkbbbhhhbbkk..', '.kbbbhhbbbbbbbk.', 'kbbbbbbbbbbbbbbk', 'kbbbbbbbbbbbbbbk', 'kbbbbbbbbbbbbbbk', 'kbbbkbbbbbbbbbbk', '.kbbbkkwwwkbbbk.'], 1, 3 - breath)
  if (breath) stamp(['kbbbbbbbbbbbbbbk'], 1, 9)
  stamp(['kbbbbbk'], 1, 10); stamp(['kwwswk', 'kwwwwk'], 8, 9)
  stamp(['kkk....kkk', ear ? 'kpbk...kkk' : 'kpbk..kbpk', ear ? 'kbbkkkkbpk' : 'kbbkkkkbbk', '.kbbbwbbbk', '.kbbbwbbbk', '.khhbwbhhk', '.kbbwwwbbk', '..kbwnwbk.', '...kkkkk..'], 13, 1)
  stamp(['ww', 'sw'], 12, 7)
  return grid(g.map(r => r.join('')), DOGPAL)
}
const SPAL = { k: '#382a1c', b: '#a58d72', l: '#cdb99a', d: '#7b6650', t: '#f6f1e6', e: '#120d07', p: '#e09a9a',
  F: '#1d3311', f: '#5f9a3a', L: '#9cc35a', D: '#3c6824', y: '#dfe8a4', E: '#f7f2da',
  P: '#1f3d17', a: '#4c8833', A: '#79b04e', r: '#f1a9c0', R: '#fde0ea', B: '#3a3d48', z: '#f6eedb', o: '#2e1d10' }
const G = rows => () => grid(rows, SPAL)

const SHEET = {
  dogA: () => dogGrid(0, 0), dogB: () => dogGrid(1, 0), dogEar: () => dogGrid(0, 1),
  frog: G(['.FF..FF.', 'FEeFFeEF', 'FffffffF', 'FfLLLLfF', 'FfDDDDfF', 'DFffffFD']),
  frogBlink: G(['.FF..FF.', 'FDDFFDDF', 'FffffffF', 'FfLLLLfF', 'FfDDDDfF', 'DFffffFD']),
  frogPuff: G(['.FF..FF.', 'FEeFFeEF', 'FffffffF', 'FfLLLLfF', 'FfyyyyfF', 'DFfyyfFD']),
  frogLeap: G(['.FF..FF.', 'FEeFFeEF', 'FffffffF', '.FfLLfF.', 'D.FffF.D', 'D......D']),
  pad: G(['.PPPPPPP..', 'PaaAAAaaPP', 'PaAAaaaaaP', '.PPPPPPPP.']),
  bloom: G(['...PrP....', '..PrRrP...', '.PPrrrPPP.', 'PaarrraaPP', 'PaAAaaaaaP', '.PPPPPPPP.']),
  bun: G(['......kk..', '.....kpk..', '.....kpkk.', '..kkkkbbbk', '.kbbbbbebk', 'ktbllbbbbp', 'kbbbbbbbk.', '.kddkkddk.']),
  bunNibble: G(['..........', '......kk..', '.....kpkk.', '..kkkkpbbk', '.kbllbbbbk', 'ktbbbbbbek', 'kbbbbbbbbp', '.kddkkddk.']),
  bunLeap: G(['......kkk.', '...kkkkbbk', '.kkbbbbbek', 'ktbllbbbbp', '.kbbbbbbk.', 'kdk...kdk.', 'k.......k.', '..........']),
  bird0: G(['B.....B', '.BB.BB.', '...B...']),
  bird1: G(['.......', '.BBBBBB', '...B...']),
  bird2: G(['..BBB..', '.B.B.B.', 'B.....B']),
  z: G(['oooo', 'zzzo', 'ozoo', 'zzzz']),
}

// ── where everything lives (art pixels) ───────────────────────────────────────
const DOG = { x: 141, y: 363, w: 72, h: 42 }
// top edge of the porch rail in front of the door, per 3px column from DOG.x; the rail is redrawn over the dog from here down
const RAIL_TOP = [390, 390, 390, 390, 390, 390, 393, 393, 393, 393, 393, 396, 396, 396, 396, 396, 396, 393, 393, 393, 393, 393, 393, 393, 393]
const PADS = [[648, 724], [752, 748], [866, 728], [972, 742]]
const BLOOM = 1 // this pad carries a pink flower instead of a frog to start
const MEADOW = [ // rabbits: x range and the ground line at each end
  { x0: 186, x1: 342, y0: 706, y1: 694 },
  { x0: 1104, x1: 1268, y0: 536, y1: 528 },
]

const rnd = (a, b) => a + Math.random() * (b - a)

export function createCritters() {
  const cache = { day: {}, night: {} }
  const spr = (name, dark) => { const c = cache[dark ? 'night' : 'day']; return c[name] || (c[name] = render(SHEET[name](), dark)) }
  const occ = new WeakMap() // image -> rail occluder canvas

  function railOccluder(img) {
    if (occ.has(img)) return occ.get(img)
    const cv = document.createElement('canvas'); cv.width = DOG.w; cv.height = DOG.h
    const x = cv.getContext('2d'), bottom = DOG.y + DOG.h
    RAIL_TOP.forEach((yt, i) => { if (i * P < DOG.w) x.drawImage(img, DOG.x + i * P, yt, P, bottom - yt, i * P, yt - DOG.y, P, bottom - yt) })
    occ.set(img, cv); return cv
  }

  const frogs = [{ pad: 0, blinkAt: 30, croakAt: 90, jumpAt: 260 }, { pad: 2, blinkAt: 55, croakAt: 160, jumpAt: 420 }]
  let bloomPad = BLOOM
  const buns = [
    { m: 0, x: 220, dir: 1, state: 'sit', t: 40, hops: 0, phase: 0 },
    { m: 0, x: 312, dir: -1, state: 'sit', t: 90, hops: 0, phase: 0 },
    { m: 1, x: 1150, dir: 1, state: 'sit', t: 70, hops: 0, phase: 0 },
  ]
  const ripples = []
  let flock = [], nextFlock = 60

  const groundY = (m, x) => { const z = MEADOW[m]; return Math.round(z.y0 + (z.y1 - z.y0) * (x - z.x0) / (z.x1 - z.x0)) }

  function step(f, dark) {
    // frogs: blink, croak, and now and then hop to a free pad
    for (const fr of frogs) {
      if (fr.jump) { fr.jump.k++; if (fr.jump.k >= 12) { fr.pad = fr.jump.to; ripples.push({ x: PADS[fr.pad][0], y: PADS[fr.pad][1] + 3, k: 0 }); fr.jump = null } continue }
      if (f >= fr.blinkAt + 2) fr.blinkAt = f + Math.round(rnd(40, 90))
      if (f >= fr.croakAt + 16) fr.croakAt = f + Math.round(rnd(dark ? 60 : 100, dark ? 140 : 220))
      if (f >= fr.jumpAt) {
        const taken = new Set(frogs.map(o => o.jump ? o.jump.to : o.pad))
        const free = PADS.map((_, i) => i).filter(i => !taken.has(i) && i !== bloomPad && Math.abs(PADS[i][0] - PADS[fr.pad][0]) < 240)
        if (free.length) { const to = free[Math.floor(Math.random() * free.length)]; fr.jump = { from: fr.pad, to, k: 0 } }
        fr.jumpAt = f + Math.round(rnd(240, 480))
      }
    }
    // rabbits: sit (sometimes nibbling), then a run of hops; turn back at the meadow's edge
    for (const b of buns) {
      if (dark && b !== buns[0]) continue
      b.t--
      if (b.state === 'sit' && b.t <= 0) {
        if (Math.random() < 0.25) { b.dir *= -1; b.t = Math.round(rnd(12, 30)) }
        else { b.state = 'hop'; b.hops = 1 + Math.floor(Math.random() * 3); b.phase = 0 }
      } else if (b.state === 'hop') {
        b.phase++
        b.x += b.dir * 3
        const z = MEADOW[b.m]
        if (b.x < z.x0 + 10 || b.x > z.x1 - 10) { b.dir *= -1; b.x = Math.max(z.x0 + 10, Math.min(z.x1 - 10, b.x)) }
        if (b.phase >= 6) { b.phase = 0; b.hops--; if (!b.hops) { b.state = 'sit'; b.t = Math.round(rnd(30, 90)) } }
      }
    }
    // birds by day: a small flock crosses the sky every half minute or so
    if (!dark && !flock.length && f >= nextFlock) {
      const dir = Math.random() < 0.5 ? 1 : -1, n = 2 + Math.floor(Math.random() * 3), y = rnd(56, 150), sp = rnd(3.6, 5)
      flock = Array.from({ length: n }, (_, i) => ({ x: dir > 0 ? -30 - i * 24 : 1406 + i * 24, y: y + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 9, dir, sp, ph: i * 2 }))
    }
    for (const bd of flock) bd.x += bd.dir * bd.sp
    if (flock.length && flock.every(bd => bd.dir > 0 ? bd.x > 1400 : bd.x < -30)) { flock = []; nextFlock = f + Math.round(rnd(200, 420)) }
    for (const r of ripples) r.k++
    while (ripples.length && ripples[0].k > 16) ripples.shift()
  }

  function draw(ctx, f, dark, img, still) {
    if (!still) step(f, dark)
    const s = n => spr(n, dark)
    const bob = i => still ? 0 : (Math.sin((f + i * 17) / 14) > 0.4 ? P : 0)
    const drift = i => still ? 0 : Math.round(Math.sin((f + i * 31) / 46)) * P

    // lily pads, the flower, landing ripples, frogs
    const frogOn = new Set(frogs.filter(fr => !fr.jump).map(fr => fr.pad))
    if (frogOn.has(bloomPad) || frogs.some(fr => fr.jump && fr.jump.to === bloomPad)) {
      bloomPad = PADS.findIndex((_, i) => !frogOn.has(i) && !frogs.some(fr => fr.jump && fr.jump.to === i))
    }
    PADS.forEach(([x, y], i) => {
      const sp = s(i === bloomPad ? 'bloom' : 'pad')
      put(ctx, sp, x - 15 + drift(i), y - sp.height + 6 + bob(i))
    })
    for (const r of ripples) {
      const t = r.k / 16
      ctx.fillStyle = dark ? `rgba(170,200,240,${0.6 * (1 - t)})` : `rgba(255,255,255,${0.8 * (1 - t)})`
      pxEllipse(ctx, r.x, r.y, 15 + t * 24, 4 + t * 6)
    }
    for (const fr of frogs) {
      let x, y, name = 'frog'
      if (fr.jump) {
        const t = fr.jump.k / 12, [x0, y0] = PADS[fr.jump.from], [x1, y1] = PADS[fr.jump.to]
        x = x0 + (x1 - x0) * t + drift(fr.jump.to) * t; y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 26; name = 'frogLeap'
      } else {
        x = PADS[fr.pad][0] + drift(fr.pad); y = PADS[fr.pad][1] + bob(fr.pad)
        const c = f - fr.croakAt
        if (!still && c >= 0 && c < 16 && (c >> 2) % 2 === 0) name = 'frogPuff'
        else if (!still && f >= fr.blinkAt && f < fr.blinkAt + 2) name = 'frogBlink'
      }
      put(ctx, s(name), x - 12, y - 15)
    }

    // the dog, asleep in its bed on the porch: slow breathing, an ear twitch now and then, a few Zs
    const br = still ? 0 : (f % 28 < 14 ? 0 : 1)
    const twitch = !still && f % 190 > 182
    put(ctx, s(twitch ? 'dogEar' : br ? 'dogB' : 'dogA'), DOG.x, DOG.y)
    if (img && img.complete && img.naturalWidth) put(ctx, railOccluder(img), DOG.x, DOG.y)
    if (!still) {
      for (let k = 0; k < 2; k++) {
        const t = ((f + k * 22) % 44) / 44
        ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
        put(ctx, s('z'), DOG.x + 48 + t * 12, DOG.y - 6 - t * 27)
      }
      ctx.globalAlpha = 1
    }

    // rabbits
    for (const b of buns) {
      if (dark && b !== buns[0]) continue
      const air = b.state === 'hop' ? Math.sin((b.phase / 6) * Math.PI) : 0
      const name = air > 0.2 ? 'bunLeap' : (b.state === 'sit' && !still && (f >> 3) % 7 === 0 ? 'bunNibble' : 'bun')
      const sp = s(name), gy = groundY(b.m, b.x)
      put(ctx, sp, b.x - sp.width / 2, gy - sp.height - air * 12, b.dir < 0)
    }

    // birds
    if (!dark && !still) {
      for (const bd of flock) {
        const sp = s('bird' + [0, 1, 2, 1][((f + bd.ph) >> 1) % 4])
        put(ctx, sp, bd.x, bd.y + Math.sin((f + bd.ph * 3) / 9) * 3)
      }
    }
  }

  return { draw }
}
