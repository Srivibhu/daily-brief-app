// The egg in the glass house, and the bird it becomes.
// Growth and mood are worked out from focus sessions and finished tasks; the name, the worn skin and
// the shop live in the pets table (/api/pet). Drawn on the scene's 3-art-pixel grid.
import { build, render, put, pxRect, P } from './critters'
import { dateStr } from './util'
import { skinById } from './shop'

export const STAGES = [
  { key: 'egg', name: 'Egg', at: 0, look: 'A speckled egg in its nest. It wobbles when you finish things.' },
  { key: 'cracking', name: 'Cracking', at: 3, look: 'Hairline cracks, and now and then an eye peeks out.' },
  { key: 'hatchling', name: 'Hatchling', at: 6, orTasks: 10, look: 'A fluffy chick that hops around the nest.' },
  { key: 'fledgling', name: 'Fledgling', at: 25, look: 'Short flights out over the pool and back.' },
  { key: 'adult', name: 'Adult', at: 75, look: 'Full plumage. Sings from the roof of the glass house.' },
]
export const MOODS = {
  happy: { name: 'Happy', note: 'Plenty of focus and finished tasks lately.' },
  content: { name: 'Content', note: 'Ticking along. A focus session would perk it up.' },
  sleepy: { name: 'Sleepy', note: 'Quiet few days. One focus session wakes it.' },
}

// growth: total focus hours (or finished tasks for the hatch) · mood: the last 3 days, never one missed day
// totals (all-time, from /api/pet) win over the loaded lists, which only reach back 90 days
export function computePet({ sessions = [], tasks = [], totals = null }, previewStage = null) {
  const has = totals && totals.totalMinutes != null
  const hours = (has ? totals.totalMinutes : sessions.reduce((a, s) => a + (s.minutes || 0), 0)) / 60
  const done = has ? totals.tasksDone : tasks.filter(t => t.progress === 100).length
  let idx = 0
  STAGES.forEach((st, i) => { if (hours >= st.at || (st.orTasks && done >= st.orTasks)) idx = i })
  const real = idx
  if (previewStage !== null) idx = previewStage
  const next = STAGES[idx + 1]
  const from = Math.min(STAGES[idx].at, hours)
  const progress = next ? Math.max(0, Math.min(1, (hours - from) / (next.at - from || 1))) : 1

  const recent = new Set([0, 1, 2].map(d => { const x = new Date(); x.setDate(x.getDate() - d); return dateStr(x) }))
  const mins = sessions.filter(s => recent.has(s.date)).reduce((a, s) => a + s.minutes, 0)
  const finished = tasks.filter(t => t.progress === 100 && t.completed_at && recent.has(String(t.completed_at).slice(0, 10))).length
  const score = mins + finished * 15
  const mood = score >= 90 ? 'happy' : score >= 20 ? 'content' : 'sleepy'
  return { idx, real, stage: STAGES[idx], next, hours, done, progress, mood, mins, finished, preview: previewStage !== null }
}

// ── sprites ───────────────────────────────────────────────────────────────────
const K = { out: '#2f2410', chickOut: '#5a3a0e', pupil: '#16100a', birdOut: '#1a2232', leg: '#c7772a', fluff: '#e9eef2',
  shell: '#f0e4c0', shellWarm: '#f7eed8', spot: '#a8924a', shellOut: '#5c4a26', crackGlow: '#f0a832',
  note: '#fff6dc', spark: '#fff3b0' }
const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')

// ── hatchling (16×14) — big round chick with crest and wide beak ──────────────
const chickOps = ({ blink, peep, sleep }, sk) => [
  // body — large oval
  ['e', 8, 9, 6.5, 5.2, sk.chick.body],
  // head — big dome
  ['e', 9.5, 4.5, 4.5, 4.2, sk.chick.body],
  // crest — three tuft pixels
  ['p', [[9, 0], [10, 0], [11, 0], [10, 1]], sk.chick.body],
  // dark wing patch
  ['e', 5.5, 9, 3, 2.2, sk.chick.dark],
  // belly highlight
  ['e', 8.5, 10, 2.8, 2, sk.chick.light],
  ['o', K.chickOut],
  // eye
  ['p', [[12, 3]], sleep || blink ? sk.chick.dark : K.pupil],
  // beak — 3 pixels wide to look prominent
  ['p', peep ? [[14, 2], [15, 3], [14, 4]] : [[14, 3], [15, 3], [14, 4]], sk.c.beak],
  // feet
  ['p', [[7, 13], [9, 13]], K.leg],
]

// ── fledgling & adult (20×16) — full-sized bird with tail ────────────────────
const birdOps = ({ young, blink, flap, sing, sleep }, sk) => {
  // fledgling keeps full colour — just slightly less saturated, still vibrant
  const b = young ? mix(sk.c.body, '#c9d2da', 0.15) : sk.c.body
  const bd = young ? mix(sk.c.dark, '#8f9aa6', 0.15) : sk.c.dark
  const belly = young ? mix(sk.c.belly, '#efe6d6', 0.15) : sk.c.belly
  const lt = young ? mix(sk.c.light, '#d8e0ea', 0.2) : sk.c.light
  return [
    // main body — bigger oval
    ['e', 8.5, 10, 7, 5.5, b],
    // belly patch
    ['e', 10, 11, 4.5, 3.8, belly],
    // head — moved up for bigger bird
    ['e', 13, sleep ? 5.5 : 4.5, 4.5, 4.2, b],
    // tail — wide spread of feathers at the back
    ['e', 1.5, 11, 2.2, 1.4, bd],
    ['p', [[0, 8], [1, 9], [0, 10], [2, 7]], bd],
    // wing
    flap ? ['e', 7, 4.5, 4.5, 2.4, bd] : ['e', 6.5, 9.5, 4.5, 2.8, bd],
    // crest
    ...(young
      ? [['p', [[13, 0], [14, 0], [14, 1]], K.fluff]]
      : [['p', [[13, 0], [14, 0], [15, 0], [14, 1], [13, 1]], b]]),
    ['o', K.birdOut],
    // light crest highlight (adults only)
    ...(young ? [] : [['e', 13.5, 3, 2, 1.2, lt]]),
    // eye
    ['p', [[15, sleep ? 6 : 5]], sleep || blink ? bd : K.pupil],
    // beak — 3 px
    ['p', sing ? [[18, 4], [19, 4], [18, 5], [18, 6]] : [[18, sleep ? 6 : 5], [19, sleep ? 6 : 5], [18, sleep ? 7 : 6]], sk.c.beak],
    // legs
    ['p', [[8, 15], [11, 15]], K.leg],
  ]
}

const NOTE = [[2, 0], [3, 0], [2, 1], [2, 2], [0, 3], [1, 3], [2, 3], [0, 4], [1, 4]]
const SPARK = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]
const Z = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]]

function shellCup() {
  // wider cup (18×7) to fit the bigger hatchling
  const g = build(18, 7, [['e', 9, 0.8, 8.5, 6.5, K.shell], ['p', [[4, 4], [5, 4], [12, 3], [13, 5]], K.spot]])
  for (let x = 0; x < 18; x++) { const top = 1 + (x % 3 === 1 ? 1 : 0); for (let y = 0; y < top; y++) g[y][x] = null }
  const add = []
  g.forEach((row, y) => row.forEach((c, x) => { if (!c && ((g[y - 1] && g[y - 1][x]) || (g[y + 1] && g[y + 1][x]) || row[x - 1] || row[x + 1])) add.push([x, y]) }))
  add.forEach(([x, y]) => { g[y][x] = K.shellOut })
  return g
}

const POSES = {
  chick: ['chick', {}], chickBlink: ['chick', { blink: true }], chickPeep: ['chick', { peep: true }], chickSleep: ['chick', { sleep: true }],
  fled: ['fled', {}], fledBlink: ['fled', { blink: true }], fledFlap: ['fled', { flap: true }], fledSing: ['fled', { sing: true }], fledSleep: ['fled', { sleep: true }],
  bird: ['bird', {}], birdBlink: ['bird', { blink: true }], birdFlap: ['bird', { flap: true }], birdSing: ['bird', { sing: true }], birdSleep: ['bird', { sleep: true }],
}
function sheet(name, skin) {
  const sk = skinById(skin)
  if (POSES[name]) {
    const [kind, o] = POSES[name]
    return kind === 'chick' ? build(16, 14, chickOps(o, sk)) : build(20, 16, birdOps({ ...o, young: kind === 'fled' }, sk))
  }
  return {
    cup: shellCup,
    bit: () => build(4, 2, [['e', 2, 0.3, 1.8, 1.7, K.shell], ['o', K.shellOut]]),
    note: () => build(5, 5, [['p', NOTE, K.note]]),
    spark: () => build(3, 3, [['p', SPARK, K.spark]]),
    z: () => build(4, 4, [['p', Z, K.note]]),
  }[name]()
}

// ── egg sprite (14×16) — jewel-like speckled oval ─────────────────────────────
function buildEgg(stageKey, skin) {
  const spotCol = skin === 'bluebird' ? K.spot : mix(skinById(skin).c.dark, K.spot, 0.4)
  // rich warm belly + cooler crown shading
  const ops = [
    ['e', 7, 9, 6.5, 7.5, K.shell],
    // warm belly highlight
    ['e', 8, 11, 3.5, 4, K.shellWarm],
    // top-left shade (crown)
    ['p', [[3, 2], [4, 2], [3, 3], [5, 2], [4, 3]], mix(K.shellOut, K.shell, 0.6)],
    // speckles — scattered pattern
    ['p', [[4, 5], [5, 5], [8, 4], [9, 5], [5, 8], [9, 8], [6, 11], [3, 7], [10, 7], [7, 13]], spotCol],
    ['o', K.shellOut],
    ...(stageKey === 'cracking' ? [
      // glowing crack line in amber
      ['p', [[2, 8], [3, 7], [4, 8], [5, 7], [6, 8], [7, 7], [8, 8], [9, 7], [10, 8], [11, 7]], K.crackGlow],
    ] : []),
  ]
  return build(14, 16, ops)
}

// for the pet card: one sprite at a chosen scale (stage key + mood)
export function petPortrait(stageKey, mood, scale = 6, skin = 'bluebird', pose = '') {
  const base = { hatchling: 'chick', fledgling: 'fled', adult: 'bird' }[stageKey]
  const name = base && (pose && POSES[base + pose] ? base + pose : mood === 'sleepy' ? base + 'Sleep' : base)
  if (name) return render(sheet(name, skin), false, scale)
  return render(buildEgg(stageKey, skin), false, scale)
}

// ── in the scene ──────────────────────────────────────────────────────────────
const EGG = { cx: 372, cy: 360, rx: 22, ry: 27 }   // slightly larger egg region
const NEST = { x: 372, y: 388 }          // where a chick sits
const LEDGE = { x: 390, y: 338 }         // fledgling perches on glass-house frame, inside scene
const ROOF = { x: 374, y: 234 }          // adult's perch on the glass-house finial
const CRACKS = [[355, 356], [360, 351], [365, 357], [370, 350], [375, 357], [381, 351], [386, 357], [391, 352]]

let state = { stage: 'egg', mood: 'content', skin: 'bluebird' }
export function setPetState(s) { state = { ...state, ...s }; if (typeof window !== 'undefined') window.dispatchEvent(new Event('db-scene')) }
let pending = []
export function petReact(type) { pending.push(type) }

export function createPet() {
  const cache = {}
  const spr = (n, dark) => { const k = (dark ? 'n:' : 'd:') + state.skin + ':' + n; return cache[k] || (cache[k] = render(sheet(n, state.skin), dark)) }
  let react = null           // { type, k }
  let flight = null          // { k, dir }
  let nextFlight = 300, sing = -999
  const plates = new WeakMap()

  // the art's egg painted out (for after the hatch): each row blends the glass on either side
  function cleanPlate(img) {
    if (plates.has(img)) return plates.get(img)
    const W = (EGG.rx + 4) * 2, H = (EGG.ry + 4) * 2
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const x = cv.getContext('2d')
    x.drawImage(img, EGG.cx - W / 2, EGG.cy - H / 2, W, H, 0, 0, W, H)
    const d = x.getImageData(0, 0, W, H), px = d.data
    for (let y = 0; y < H; y++) {
      const ay = EGG.cy - H / 2 + y
      if (ay > EGG.cy + EGG.ry + 4) break
      const dy = (ay - EGG.cy) / (EGG.ry + 2)
      if (Math.abs(dy) > 1) continue
      const half = Math.ceil((EGG.rx + 3) * Math.sqrt(1 - dy * dy))
      const l = W / 2 - half - 2, r = W / 2 + half + 1
      for (let i = l + 1; i < r; i++) {
        const t = (i - l) / (r - l)
        for (let c = 0; c < 4; c++) px[(y * W + i) * 4 + c] = px[(y * W + l) * 4 + c] * (1 - t) + px[(y * W + r) * 4 + c] * t
      }
    }
    x.putImageData(d, 0, 0)
    plates.set(img, cv); return cv
  }

  function draw(ctx, f, dark, img, still) {
    const s = n => spr(n, dark)
    const { stage, mood } = state
    if (still) pending = []
    else if (pending.length) react = { type: pending.shift(), k: 0 }
    if (react && ++react.k > 36) react = null
    const sleepy = mood === 'sleepy'

    if (stage === 'egg' || stage === 'cracking') {
      // bigger, warmer glow for the egg — it's the main character at this stage
      glow(ctx, f, EGG.cx, EGG.cy, EGG.rx + 28, EGG.ry + 26, still, dark, [EGG.rx + 2, EGG.ry + 2])
      // wobble: every few seconds (more often when happy), harder on a reaction
      const every = mood === 'happy' ? 40 : mood === 'content' ? 64 : 140
      const w = react ? react.k : f % every
      const len = react ? 14 : 8
      const amp = react ? 0.16 : 0.09
      const wob = !still && img && img.complete && w < len
      const ang = wob ? Math.sin(w / len * Math.PI * 3) * amp * (1 - w / len) : 0
      ctx.save()
      if (wob) {
        ctx.translate(EGG.cx, EGG.cy + EGG.ry); ctx.rotate(ang)
        ctx.beginPath(); ctx.ellipse(0, -EGG.ry, EGG.rx + 1, EGG.ry + 1, 0, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(img, EGG.cx - EGG.rx - 2, EGG.cy - EGG.ry - 2, EGG.rx * 2 + 4, EGG.ry * 2 + 4, -EGG.rx - 2, -EGG.ry * 2 - 2, EGG.rx * 2 + 4, EGG.ry * 2 + 4)
        ctx.translate(-EGG.cx, -EGG.cy - EGG.ry)
      }
      if (stage === 'cracking') {
        // amber glow through the crack — light seeping from inside
        const crackAlpha = 0.7 + 0.3 * Math.sin(f / 7)
        ctx.fillStyle = `rgba(240,168,50,${crackAlpha})`
        for (let i = 0; i < CRACKS.length - 1; i++) {
          const [x0, y0] = CRACKS[i], [x1, y1] = CRACKS[i + 1], n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / P)
          for (let k = 0; k <= n; k++) pxRect(ctx, x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)
        }
        // outline the crack dark for contrast
        ctx.fillStyle = dark ? '#1a140c' : '#3a2a0e'
        ctx.globalAlpha = 0.5
        for (let i = 0; i < CRACKS.length - 1; i++) {
          const [x0, y0] = CRACKS[i], [x1, y1] = CRACKS[i + 1], n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / P)
          for (let k = 0; k <= n; k++) pxRect(ctx, x0 + (x1 - x0) * k / n - P, y0 + (y1 - y0) * k / n + P)
        }
        ctx.globalAlpha = 1
        // eye peeks through crack more frequently (every 80 frames instead of 150)
        if (!still && f % 80 > 64) { ctx.fillStyle = '#120c06'; pxRect(ctx, 369, 346, 6, 6); ctx.fillStyle = '#ffe8b0'; pxRect(ctx, 372, 346) }
      }
      ctx.restore()
      if (react) sparkles(ctx, s, f, EGG.cx, EGG.cy - 12)
      return
    }

    // hatched: paint out the egg, leave shell bits in the nest
    if (img && img.complete && img.naturalWidth) {
      const W = (EGG.rx + 4) * 2, H = (EGG.ry + 4) * 2
      ctx.drawImage(cleanPlate(img), EGG.cx - W / 2, EGG.cy - H / 2)
    }
    put(ctx, s('bit'), 348, 381); put(ctx, s('bit'), 384, 384)

    if (stage === 'hatchling') {
      const hop = react?.type === 'task' ? Math.abs(Math.sin(react.k / 6 * Math.PI)) * 10 : (!still && !sleepy && f % 90 > 80 ? Math.abs(Math.sin((f % 90 - 80) / 10 * Math.PI)) * 6 : 0)
      const name = sleepy && !react ? 'chickSleep' : react?.type === 'focus' && (react.k >> 2) % 2 ? 'chickPeep' : (!still && f % 70 < 2 ? 'chickBlink' : 'chick')
      const sp = s(name), x = NEST.x - sp.width / 2 + (still ? 0 : Math.round(Math.sin(f / 50)) * P)
      // larger glow radius for the bigger chick
      glow(ctx, f, NEST.x, NEST.y - sp.height / 2 - 6 - hop, sp.width / 2 + 28, sp.height / 2 + 22, still, dark)
      put(ctx, sp, x, NEST.y - sp.height - 6 - hop)
      put(ctx, s('cup'), EGG.cx - 27, 377)
      if (react) sparkles(ctx, s, f, NEST.x, NEST.y - 52)
      else if (sleepy && !still) zees(ctx, s, f, NEST.x + 14, NEST.y - 52)
      return
    }

    // fledgling and adult: perched, the odd flight out over the pool and back, songs at dawn and after a session
    const young = stage === 'fledgling', base = young ? 'fled' : 'bird', perch = young ? LEDGE : ROOF
    if (!still && !flight && !sleepy && (f >= nextFlight || react?.type === 'task' && react.k === 1)) { flight = { k: 0, dir: young ? 1 : -1 }; nextFlight = f + 500 + Math.floor(Math.random() * 500) }
    if (react?.type === 'focus' && react.k === 1) sing = f
    if (!still && !sleepy && f % 900 === 120) sing = f
    let x = perch.x, y = perch.y, name = base, flip = false
    if (flight) {
      const t = ++flight.k / 72
      if (t >= 1) flight = null
      else {
        const span = young ? 150 : 120
        x = perch.x + Math.sin(t * Math.PI * 2) * span * 0.5 * flight.dir + Math.sin(t * Math.PI) * span * 0.6 * flight.dir
        y = perch.y - Math.sin(t * Math.PI) * (young ? 40 : 70) + Math.sin(t * Math.PI * 2) * 14
        name = base + ((f >> 1) % 2 ? 'Flap' : '')
        flip = Math.cos(t * Math.PI * 2) * flight.dir + Math.cos(t * Math.PI) * flight.dir * 1.2 < 0
      }
    }
    if (!flight) {
      if (sleepy && !react) name = base + 'Sleep'
      else if (!still && f - sing < 48) name = base + ((f - sing) % 12 < 6 ? 'Sing' : '')
      else if (!still && f % 80 < 2) name = base + 'Blink'
    }
    const sp = s(name)
    // bigger glow for the larger 20×16 sprite; adult gets an even warmer halo
    const glowRx = sp.width / 2 + (young ? 26 : 32), glowRy = sp.height / 2 + (young ? 22 : 28)
    glow(ctx, f, x, y - sp.height / 2, glowRx, glowRy, still, dark)
    put(ctx, sp, x - sp.width / 2, y - sp.height, flip)
    if (!flight && !still && f - sing < 48) {
      for (let k = 0; k < 2; k++) {
        const t = ((f - sing + k * 12) % 24) / 24
        ctx.globalAlpha = 1 - t
        put(ctx, s('note'), x + 24 + t * 14 + k * 8, y - 44 - t * 24)
      }
      ctx.globalAlpha = 1
    }
    if (react && !flight) sparkles(ctx, s, f, x, y - 32)
    else if (sleepy && !still) zees(ctx, s, f, x + 16, y - 42)
  }

  // warm pixel halo: rings of grid cells, brighter toward the middle, breathing slowly
  function glow(ctx, f, cx, cy, rx, ry, still, dark, hole = null) {
    const pulse = still ? 1 : 0.88 + 0.12 * Math.sin(f / 9)
    const base = (dark ? 0.42 : 0.33) * pulse
    for (const [k, a] of [[1.0, 0.3], [0.75, 0.65], [0.5, 1]]) {
      ctx.fillStyle = `rgba(255,208,92,${base * a})`
      const ox = rx * k, oy = ry * k, ix = rx * (k - 0.25), iy = ry * (k - 0.25)
      for (let dy = -oy; dy <= oy; dy += P) for (let dx = -ox; dx <= ox; dx += P) {
        const o = (dx / ox) ** 2 + (dy / oy) ** 2, i = (dx / ix) ** 2 + (dy / iy) ** 2
        if (hole && (dx / hole[0]) ** 2 + (dy / hole[1]) ** 2 <= 1) continue
        if (o <= 1 && (k === 0.5 || i > 1)) pxRect(ctx, cx + dx, cy + dy)
      }
    }
  }

  function sparkles(ctx, s, f, x, y) {
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + (react ? react.k / 10 : 0), r = 12 + (react ? react.k * 0.5 : 0)
      ctx.globalAlpha = react ? Math.max(0, 1 - react.k / 36) : 1
      put(ctx, s('spark'), x + Math.cos(a) * r - 4, y + Math.sin(a) * r * 0.7 - 4)
    }
    ctx.globalAlpha = 1
  }
  function zees(ctx, s, f, x, y) {
    for (let k = 0; k < 2; k++) {
      const t = ((f + k * 22) % 44) / 44
      ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
      put(ctx, s('z'), x + t * 9, y - t * 24)
    }
    ctx.globalAlpha = 1
  }

  return { draw }
}
