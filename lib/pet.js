// The egg in the glass house, and the bird it becomes.
// Growth and mood are worked out from data the app already has (focus sessions, finished tasks);
// nothing about the pet is stored on the server yet. Its name lives in this browser until the
// pets table lands (see the plan doc, Phase 2).
import { build, render } from './critters'
import { dateStr } from './util'

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
export function computePet({ sessions = [], tasks = [] }, previewStage = null) {
  const hours = sessions.reduce((a, s) => a + (s.minutes || 0), 0) / 60
  const done = tasks.filter(t => t.progress === 100).length
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
const K = {
  out: '#2f2410', chick: '#f5d454', chickL: '#fdeb98', chickD: '#d9a92c', chickOut: '#6e4f12', beak: '#e8902e', pupil: '#16100a',
  blue: '#5f9bd1', blueL: '#9cc6ea', blueD: '#3b6f9f', peach: '#f3c08c', birdOut: '#1e2a3a', leg: '#c7772a',
  fblue: '#93b2c9', fblueD: '#6d8ca5', fpeach: '#ead7bd', fluff: '#e9eef2',
  shell: '#f4ead0', spot: '#b9a76a', shellOut: '#5c4a26', note: '#fff6dc', spark: '#fff3b0',
}
const chickOps = ({ blink, peep, sleep }) => [
  ['e', 6, 7, 4.6, 3.6, K.chick], ['e', 7.6, 3.8, 3, 2.8, K.chick],
  ['p', [[7, 0], [8, 0], [6, 1]], K.chick],
  ['e', 4.6, 7.2, 2.2, 1.6, K.chickD], ['e', 6.6, 8.4, 2.4, 1.1, K.chickL],
  ['o', K.chickOut],
  ['p', [[9, 3]], sleep || blink ? K.chickD : K.pupil],
  ['p', peep ? [[11, 3], [11, 5]] : [[11, 4], [11, 5]], K.beak],
]
const birdOps = ({ young, blink, flap, sing, sleep }) => {
  const b = young ? K.fblue : K.blue, bd = young ? K.fblueD : K.blueD, belly = young ? K.fpeach : K.peach
  return [
    ['e', 6.5, 7, 5, 3.8, b], ['e', 7.8, 8, 3.2, 2.6, belly],
    ['e', 9.6, sleep ? 4.8 : 4, 3, 2.8, b],
    ['e', 1.6, 5.6, 1.8, 1, bd],
    flap ? ['e', 5, 3.6, 3.2, 1.6, bd] : ['e', 5, 6.6, 3, 2, bd],
    ...(young ? [['p', [[9, 1], [10, 0]], K.fluff]] : [['p', [[10, 1], [11, 0], [9, 0]], b]]),
    ['o', K.birdOut],
    ...(young ? [] : [['e', 9.4, 3, 1.4, 0.8, K.blueL]]),
    ['p', [[10, sleep ? 5 : 4]], sleep || blink ? bd : K.pupil],
    ['p', sing ? [[13, 3], [13, 5]] : [[13, sleep ? 5 : 4], [13, sleep ? 6 : 5]], K.beak],
    ['p', [[6, 11], [8, 11]], K.leg],
  ]
}
const NOTE = [[2, 0], [3, 0], [2, 1], [4, 1], [2, 2], [0, 3], [1, 3], [2, 3], [0, 4], [1, 4]]
const SPARK = [[2, 0], [2, 1], [0, 2], [1, 2], [3, 2], [4, 2], [2, 3], [2, 4]]
const Z = [[1, 1], [2, 1], [3, 1], [4, 1], [3, 2], [2, 3], [1, 4], [2, 4], [3, 4], [4, 4]]
function shellCup() {
  const ops = [['e', 11, 1.5, 10.4, 8.4, K.shell], ['p', [[5, 5], [6, 5], [14, 4], [15, 4], [10, 7], [17, 6]], K.spot]]
  const g = build(22, 10, ops)
  for (let x = 0; x < 22; x++) { const top = 2 + (x % 4 < 2 ? 0 : 1); for (let y = 0; y < top; y++) g[y][x] = null }
  // outline after the zigzag cut
  const add = []
  g.forEach((row, y) => row.forEach((c, x) => { if (!c && ((g[y - 1] && g[y - 1][x]) || (g[y + 1] && g[y + 1][x]) || row[x - 1] || row[x + 1])) add.push([x, y]) }))
  add.forEach(([x, y]) => { g[y][x] = K.shellOut })
  return g
}
const SHEET = {
  chick: () => build(12, 11, chickOps({})), chickBlink: () => build(12, 11, chickOps({ blink: true })),
  chickPeep: () => build(12, 11, chickOps({ peep: true })), chickSleep: () => build(12, 11, chickOps({ sleep: true })),
  fled: () => build(14, 12, birdOps({ young: true })), fledBlink: () => build(14, 12, birdOps({ young: true, blink: true })),
  fledFlap: () => build(14, 12, birdOps({ young: true, flap: true })), fledSing: () => build(14, 12, birdOps({ young: true, sing: true })),
  fledSleep: () => build(14, 12, birdOps({ young: true, sleep: true })),
  bird: () => build(14, 12, birdOps({})), birdBlink: () => build(14, 12, birdOps({ blink: true })),
  birdFlap: () => build(14, 12, birdOps({ flap: true })), birdSing: () => build(14, 12, birdOps({ sing: true })),
  birdSleep: () => build(14, 12, birdOps({ sleep: true })),
  cup: shellCup,
  bit: () => build(5, 3, [['e', 2.5, 0.5, 2.4, 2.2, K.shell], ['o', K.shellOut]]),
  note: () => build(7, 7, [['p', NOTE.map(([x, y]) => [x + 1, y + 1]), K.note], ['o', K.out]]),
  spark: () => build(5, 5, [['p', SPARK, K.spark]]),
  z: () => build(6, 6, [['p', Z, K.note], ['o', K.out]]),
}
// for the pet card: one sprite at a chosen scale (stage key + mood)
export function petPortrait(stageKey, mood, scale = 6) {
  const name = { egg: null, cracking: null, hatchling: mood === 'sleepy' ? 'chickSleep' : 'chick', fledgling: mood === 'sleepy' ? 'fledSleep' : 'fled', adult: mood === 'sleepy' ? 'birdSleep' : 'bird' }[stageKey]
  if (name) return render(SHEET[name](), false, scale)
  const egg = build(10, 12, [['e', 5, 6.4, 4.6, 5.6, K.shell], ['p', [[3, 5], [4, 5], [6, 8], [7, 8], [6, 3]], K.spot], ['o', K.shellOut],
    ...(stageKey === 'cracking' ? [['p', [[1, 6], [2, 5], [3, 6], [4, 5], [5, 6], [6, 5], [7, 6], [8, 5]], K.shellOut]] : [])])
  return render(egg, false, scale)
}

// ── in the scene ──────────────────────────────────────────────────────────────
const EGG = { cx: 372, cy: 363, rx: 20, ry: 25 }
const NEST = { x: 372, y: 384 }          // where a chick sits
const LEDGE = { x: 458, y: 412 }         // fledgling's perch on the moss right of the glass house
const ROOF = { x: 374, y: 238 }          // adult's perch on the glass-house finial
const CRACKS = [[356, 356], [361, 352], [365, 357], [370, 351], [375, 357], [380, 352], [385, 357], [389, 353]]

let state = { stage: 'egg', mood: 'content' }
export function setPetState(s) { state = { ...state, ...s }; if (typeof window !== 'undefined') window.dispatchEvent(new Event('db-scene')) }
let pending = []
export function petReact(type) { pending.push(type) }

export function createPet() {
  const cache = { day: {}, night: {} }
  const spr = (n, dark) => { const c = cache[dark ? 'night' : 'day']; return c[n] || (c[n] = render(SHEET[n](), dark)) }
  let react = null           // { type, k }
  let flight = null          // { k, dir }
  let nextFlight = 300, sing = -999
  const plates = new WeakMap()

  // the art's egg painted out (for after the hatch): each row blends the glass on either side
  function cleanPlate(img) {
    if (plates.has(img)) return plates.get(img)
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 56
    const x = cv.getContext('2d')
    x.drawImage(img, EGG.cx - 24, EGG.cy - 28, 48, 56, 0, 0, 48, 56)
    const d = x.getImageData(0, 0, 48, 56), px = d.data
    for (let y = 0; y < 56; y++) {
      const ay = EGG.cy - 28 + y
      if (ay > 386) break
      const dy = (ay - EGG.cy) / (EGG.ry + 2)
      if (Math.abs(dy) > 1) continue
      const half = Math.ceil((EGG.rx + 3) * Math.sqrt(1 - dy * dy))
      const l = 24 - half - 2, r = 24 + half + 1
      for (let i = l + 1; i < r; i++) {
        const t = (i - l) / (r - l)
        for (let c = 0; c < 4; c++) px[(y * 48 + i) * 4 + c] = px[(y * 48 + l) * 4 + c] * (1 - t) + px[(y * 48 + r) * 4 + c] * t
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
        ctx.fillStyle = dark ? '#1a140c' : '#4a3a1c'
        for (let i = 0; i < CRACKS.length - 1; i++) {
          const [x0, y0] = CRACKS[i], [x1, y1] = CRACKS[i + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
          for (let k = 0; k <= n; k++) ctx.fillRect(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), 2, 2)
        }
        // an eye peeks through the crack now and then
        if (!still && f % 150 > 128) { ctx.fillStyle = '#120c06'; ctx.fillRect(369, 346, 4, 4); ctx.fillStyle = '#fff'; ctx.fillRect(371, 346, 1, 1) }
      }
      ctx.restore()
      if (react) sparkles(ctx, s, f, EGG.cx, EGG.cy - 10)
      return
    }

    // hatched: paint out the egg, leave shell bits in the nest
    if (img && img.complete && img.naturalWidth) ctx.drawImage(cleanPlate(img), EGG.cx - 24, EGG.cy - 28)
    ctx.drawImage(s('bit'), 350, 380); ctx.drawImage(s('bit'), 386, 382)

    if (stage === 'hatchling') {
      const hop = react?.type === 'task' ? Math.abs(Math.sin(react.k / 6 * Math.PI)) * 8 : (!still && !sleepy && f % 90 > 80 ? Math.abs(Math.sin((f % 90 - 80) / 10 * Math.PI)) * 5 : 0)
      const name = sleepy && !react ? 'chickSleep' : react?.type === 'focus' && (react.k >> 2) % 2 ? 'chickPeep' : (!still && f % 70 < 2 ? 'chickBlink' : 'chick')
      const x = NEST.x - 12 + (still ? 0 : Math.round(Math.sin(f / 50) * 3))
      ctx.drawImage(s(name), x, Math.round(NEST.y - 32 - hop))
      ctx.drawImage(s('cup'), EGG.cx - 22, 377)
      if (react) sparkles(ctx, s, f, NEST.x, NEST.y - 36)
      else if (sleepy && !still) zees(ctx, s, f, NEST.x + 8, NEST.y - 34)
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
    const sp = s(name), dx = Math.round(x - sp.width / 2), dy = Math.round(y - sp.height)
    if (flip) { ctx.save(); ctx.translate(dx + sp.width, dy); ctx.scale(-1, 1); ctx.drawImage(sp, 0, 0); ctx.restore() }
    else ctx.drawImage(sp, dx, dy)
    if (!flight && !still && f - sing < 48) {
      for (let k = 0; k < 2; k++) {
        const t = ((f - sing + k * 12) % 24) / 24
        ctx.globalAlpha = 1 - t
        ctx.drawImage(s('note'), Math.round(x + 14 + t * 10 + k * 6), Math.round(y - 26 - t * 18))
      }
      ctx.globalAlpha = 1
    }
    if (react && !flight) sparkles(ctx, s, f, x, y - 18)
    else if (sleepy && !still) zees(ctx, s, f, x + 10, y - 22)
  }

  function sparkles(ctx, s, f, x, y) {
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + (react ? react.k / 10 : 0), r = 12 + (react ? react.k * 0.5 : 0)
      ctx.globalAlpha = react ? Math.max(0, 1 - react.k / 36) : 1
      ctx.drawImage(s('spark'), Math.round(x + Math.cos(a) * r - 5), Math.round(y + Math.sin(a) * r * 0.7 - 5))
    }
    ctx.globalAlpha = 1
  }
  function zees(ctx, s, f, x, y) {
    for (let k = 0; k < 2; k++) {
      const t = ((f + k * 22) % 44) / 44
      ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
      ctx.drawImage(s('z'), Math.round(x + t * 8), Math.round(y - t * 22))
    }
    ctx.globalAlpha = 1
  }

  return { draw }
}
