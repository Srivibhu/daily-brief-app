// Pixel critters that live in the scene: a dog asleep in its bed on the porch, frogs on lily pads,
// rabbits in the front meadow and the odd flock of birds. Drawn on the scene canvas in art pixels
// (1376 × 768). Sprites are built from a few ellipses at a 2-art-pixel grid, then outlined, so they
// sit at the same pixel size as the illustration.

const P = 2

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
const dogBody = (breath, ear) => [
  ['e', 16.5, 10 - breath * 0.4, 8.6, 4.2 + breath * 0.4, 'fawn'],
  ['e', 21.5, 9.4 - breath * 0.3, 4.6, 4.2 + breath * 0.3, 'fawn'],
  ['e', 16, 7 - breath * 0.4, 5.8, 1.1, 'fawnL'],
  ['e', 7, 9.6, 4.8, 3.8, 'fawn'],
  ['e', 7, 7.2, 2.6, 0.9, 'fawnL'],
  ['e', 9.4, 9.6 - ear, 2, 3, 'fawnD'],
  ['e', 3.4, 11.4, 2.8, 1.9, 'muzzle'],
  ['e', 5.5, 13.8, 4, 1.2, 'muzzle'],
  ['e', 25, 13.4, 3.6, 1.1, 'fawnD'],
  ['o', 'out'],
  ['p', [[4, 9], [5, 9], [6, 9]], 'out'],
  ['p', [[1, 10], [1, 11], [2, 10]], 'nose'],
]
const frogOps = ({ blink, puff, leap }) => [
  ...(leap
    ? [['e', 5, 4.4, 4, 2.2, 'frog'], ['e', 1, 6.8, 1.6, 0.9, 'frogD'], ['e', 9, 6.8, 1.6, 0.9, 'frogD']]
    : [['e', 5, 5, 4, 2.6, 'frog'], ['e', 1.4, 6.4, 1.3, 1.1, 'frogD'], ['e', 8.6, 6.4, 1.3, 1.1, 'frogD']]),
  ['e', 3, 2.4, 1.5, 1.5, 'frog'], ['e', 7, 2.4, 1.5, 1.5, 'frog'],
  ['e', 5, 4.2, 2.2, 0.9, 'frogL'],
  ['o', 'frogOut'],
  ['p', [[2, 2], [3, 2], [6, 2], [7, 2]], blink ? 'frogD' : 'eye'],
  ...(blink ? [] : [['p', [[3, 2], [6, 2]], 'pupil']]),
  ...(puff ? [['e', 5, 5.6, 2, 1.3, 'belly']] : [['p', [[4, 4], [5, 4]], 'frogD']]),
]
const bunOps = pose => pose === 'leap' ? [
  ['e', 6.2, 7.4, 5.2, 2.4, 'bun'], ['e', 6.4, 6.4, 3.4, 0.8, 'bunL'],
  ['e', 11.2, 5.6, 2.6, 2.2, 'bun'],
  ['e', 7.4, 3.2, 2.6, 0.9, 'bunD'], ['e', 8.2, 2.4, 2.8, 1, 'bun'],
  ['e', 1.8, 9.6, 2.2, 0.9, 'bunD'], ['e', 12.2, 8.4, 1.5, 0.8, 'bunD'],
  ['e', 1.4, 6.2, 1.3, 1.3, 'tail'],
  ['o', 'bunOut'],
  ['p', [[12, 5]], 'pupil'], ['p', [[13, 6]], 'pink'],
] : pose === 'nibble' ? [
  ['e', 5.6, 8.6, 4.4, 3, 'bun'], ['e', 4.4, 8.2, 3.4, 3.2, 'bun'], ['e', 6.2, 7, 3, 0.9, 'bunL'],
  ['e', 10.6, 8.4, 2.8, 2.4, 'bun'], ['e', 11.4, 9.4, 1.3, 0.8, 'bunL'],
  ['e', 8.4, 4.8, 1, 2.8, 'bunD'], ['e', 9.6, 4.6, 1.1, 3, 'bun'],
  ['e', 8.4, 11.2, 2.2, 0.8, 'bunD'],
  ['e', 1.2, 7.6, 1.4, 1.4, 'tail'],
  ['o', 'bunOut'],
  ['p', [[10, 3], [10, 4], [10, 5]], 'pink'], ['p', [[11, 7]], 'pupil'], ['p', [[12, 8]], 'pink'],
] : [
  ['e', 5.6, 8.6, 4.4, 3, 'bun'], ['e', 4.4, 8.2, 3.4, 3.2, 'bun'], ['e', 6.2, 7, 3, 0.9, 'bunL'],
  ['e', 10.2, 6.2, 2.9, 2.5, 'bun'], ['e', 11, 7.2, 1.4, 0.9, 'bunL'],
  ['e', 8.4, 2.8, 1, 2.8, 'bunD'], ['e', 9.8, 2.6, 1.1, 3, 'bun'],
  ['e', 8.4, 11.2, 2.2, 0.8, 'bunD'],
  ['e', 1.2, 7.6, 1.4, 1.4, 'tail'],
  ['o', 'bunOut'],
  ['p', [[10, 1], [10, 2], [10, 3]], 'pink'], ['p', [[11, 5]], 'pupil'], ['p', [[12, 6]], 'pink'],
]
const BIRD = [
  [[0, 0], [8, 0], [1, 1], [2, 1], [6, 1], [7, 1], [3, 2], [4, 2], [5, 2], [4, 3]],
  [[0, 1], [1, 1], [2, 1], [6, 1], [7, 1], [8, 1], [3, 2], [4, 2], [5, 2], [4, 3]],
  [[3, 1], [4, 1], [5, 1], [1, 2], [2, 2], [4, 2], [6, 2], [7, 2], [0, 3], [8, 3]],
]

const SHEET = {
  bedBack: () => build(30, 18, [['e', 15, 12, 14.6, 5.4, 'bed'], ['e', 15, 9.2, 12.4, 1.6, 'bedL'], ['e', 15, 12.6, 11.6, 3.4, 'bedD'], ['o', 'out']]),
  bedFront: () => build(30, 18, [['e', 15, 15.6, 14.4, 2.4, 'bed'], ['o', 'out'], ['p', [[4, 15], [8, 16], [12, 15], [16, 16], [20, 15], [24, 16]], 'check']]),
  dogA: () => build(30, 18, dogBody(0, 0)),
  dogB: () => build(30, 18, dogBody(1, 0)),
  dogEar: () => build(30, 18, dogBody(0, 0.8)),
  frog: () => build(10, 8, frogOps({})),
  frogBlink: () => build(10, 8, frogOps({ blink: true })),
  frogPuff: () => build(10, 8, frogOps({ puff: true })),
  frogLeap: () => build(10, 8, frogOps({ leap: true })),
  pad: () => build(14, 6, [['e', 7, 3, 6.6, 2.6, 'pad'], ['e', 6, 2.4, 4, 1, 'padL'], ['p', [[10, 2], [11, 2], [12, 2], [11, 3], [12, 3], [13, 2], [13, 3]], null], ['o', 'padOut']]),
  bloom: () => build(14, 8, [['e', 7, 5, 6.6, 2.6, 'pad'], ['e', 6, 4.4, 4, 1, 'padL'], ['p', [[11, 4], [12, 4], [12, 5], [13, 4], [13, 5]], null],
    ['e', 6, 3, 1.4, 2.2, 'petal'], ['e', 4.4, 3.6, 1.2, 1.4, 'petal'], ['e', 7.6, 3.6, 1.2, 1.4, 'petal'], ['o', 'padOut'], ['p', [[5, 2], [6, 1]], 'petalL']]),
  bun: () => build(14, 12, bunOps('sit')),
  bunNibble: () => build(14, 12, bunOps('nibble')),
  bunLeap: () => build(14, 12, bunOps('leap')),
  bird0: () => build(9, 4, [['p', BIRD[0], 'bird']]),
  bird1: () => build(9, 4, [['p', BIRD[1], 'bird']]),
  bird2: () => build(9, 4, [['p', BIRD[2], 'bird']]),
  z: () => build(6, 6, [['p', [[1, 1], [2, 1], [3, 1], [4, 1], [3, 2], [2, 3], [1, 4], [2, 4], [3, 4], [4, 4]], '#f6eedb'], ['o', 'out']]),
}

// ── where everything lives (art pixels) ───────────────────────────────────────
const DOG = { x: 146, y: 360 }
// top edge of the porch rail in front of the door (x 146…215); the rail is redrawn over the dog from here down
const RAIL_TOP = [392, 392, 392, 392, 391, 391, 391, 391, 391, 392, 392, 392, 392, 392, 393, 393, 393, 394, 394, 394, 394, 394, 393, 394, 394, 394, 395, 395, 396, 396, 396, 396, 396, 396, 396, 396, 395, 395, 395, 396, 395, 395, 395, 395, 394, 395, 394, 394, 394, 395, 395, 395, 395, 395, 395, 395, 394, 392, 393, 393]
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
    const cv = document.createElement('canvas'); cv.width = 60; cv.height = 44
    const x = cv.getContext('2d')
    RAIL_TOP.forEach((yt, i) => x.drawImage(img, DOG.x + i, yt, 1, DOG.y + 44 - yt, i, yt - DOG.y, 1, DOG.y + 44 - yt))
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
      flock = Array.from({ length: n }, (_, i) => ({ x: dir > 0 ? -30 - i * 16 : 1406 + i * 16, y: y + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 7, dir, sp, ph: i * 2 }))
    }
    for (const bd of flock) bd.x += bd.dir * bd.sp
    if (flock.length && flock.every(bd => bd.dir > 0 ? bd.x > 1400 : bd.x < -30)) { flock = []; nextFlock = f + Math.round(rnd(200, 420)) }
    for (const r of ripples) r.k++
    while (ripples.length && ripples[0].k > 16) ripples.shift()
  }

  function draw(ctx, f, dark, img, still) {
    if (!still) step(f, dark)
    const s = n => spr(n, dark)
    const bob = i => still ? 0 : Math.round(Math.sin((f + i * 17) / 14))
    const drift = i => still ? 0 : Math.round(Math.sin((f + i * 31) / 46) * 2)

    // lily pads, the flower, landing ripples, frogs
    const frogOn = new Set(frogs.filter(fr => !fr.jump).map(fr => fr.pad))
    if (frogOn.has(bloomPad) || frogs.some(fr => fr.jump && fr.jump.to === bloomPad)) {
      bloomPad = PADS.findIndex((_, i) => !frogOn.has(i) && !frogs.some(fr => fr.jump && fr.jump.to === i))
    }
    PADS.forEach(([x, y], i) => {
      const sp = s(i === bloomPad ? 'bloom' : 'pad')
      ctx.drawImage(sp, x - 14 + drift(i), y - sp.height / 2 + 3 + bob(i))
    })
    for (const r of ripples) {
      const t = r.k / 16
      ctx.strokeStyle = dark ? `rgba(170,200,240,${0.5 * (1 - t)})` : `rgba(255,255,255,${0.75 * (1 - t)})`
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.ellipse(r.x, r.y, 14 + t * 22, 4 + t * 6, 0, 0, Math.PI * 2); ctx.stroke()
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
      ctx.drawImage(s(name), Math.round(x - 10), Math.round(y - 13))
    }

    // the dog, asleep in its bed on the porch: slow breathing, an ear twitch now and then, a few Zs
    const br = still ? 0 : (f % 28 < 14 ? 0 : 1)
    const twitch = !still && f % 190 > 182
    ctx.drawImage(s('bedBack'), DOG.x, DOG.y)
    ctx.drawImage(s(twitch ? 'dogEar' : br ? 'dogB' : 'dogA'), DOG.x, DOG.y)
    ctx.drawImage(s('bedFront'), DOG.x, DOG.y)
    if (img && img.complete && img.naturalWidth) ctx.drawImage(railOccluder(img), DOG.x, DOG.y)
    if (!still) {
      for (let k = 0; k < 2; k++) {
        const t = ((f + k * 22) % 44) / 44
        ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
        ctx.drawImage(s('z'), Math.round(DOG.x + 8 + t * 10 + Math.sin(t * 6) * 2), Math.round(DOG.y + 10 - t * 26))
      }
      ctx.globalAlpha = 1
    }

    // rabbits
    for (const b of buns) {
      if (dark && b !== buns[0]) continue
      const air = b.state === 'hop' ? Math.sin((b.phase / 6) * Math.PI) : 0
      const name = air > 0.2 ? 'bunLeap' : (b.state === 'sit' && !still && (f >> 3) % 7 === 0 ? 'bunNibble' : 'bun')
      const sp = s(name), gy = groundY(b.m, b.x)
      const x = Math.round(b.x - sp.width / 2), y = Math.round(gy - sp.height - air * 9)
      if (b.dir < 0) { ctx.save(); ctx.translate(x + sp.width, y); ctx.scale(-1, 1); ctx.drawImage(sp, 0, 0); ctx.restore() }
      else ctx.drawImage(sp, x, y)
    }

    // birds
    if (!dark && !still) {
      for (const bd of flock) {
        const sp = s('bird' + [0, 1, 2, 1][((f + bd.ph) >> 1) % 4])
        ctx.drawImage(sp, Math.round(bd.x), Math.round(bd.y + Math.sin((f + bd.ph * 3) / 9) * 3))
      }
    }
  }

  return { draw }
}
