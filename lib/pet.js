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
  const hours = (totals ? totals.totalMinutes : sessions.reduce((a, s) => a + (s.minutes || 0), 0)) / 60
  const done = totals ? totals.tasksDone : tasks.filter(t => t.progress === 100).length
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
const K = { out: '#2f2410', chickOut: '#6e4f12', pupil: '#16100a', birdOut: '#1e2a3a', leg: '#c7772a', fluff: '#e9eef2',
  shell: '#f4ead0', spot: '#b9a76a', shellOut: '#5c4a26', note: '#fff6dc', spark: '#fff3b0' }
const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')
const chickOps = ({ blink, peep, sleep }, sk) => [
  ['e', 6, 7, 4.6, 3.6, sk.chick.body], ['e', 7.6, 3.8, 3, 2.8, sk.chick.body],
  ['p', [[7, 0], [8, 0], [6, 1]], sk.chick.body],
  ['e', 4.6, 7.2, 2.2, 1.6, sk.chick.dark], ['e', 6.6, 8.4, 2.4, 1.1, sk.chick.light],
  ['o', K.chickOut],
  ['p', [[9, 3]], sleep || blink ? sk.chick.dark : K.pupil],
  ['p', peep ? [[11, 3], [11, 5]] : [[11, 4], [11, 5]], sk.c.beak],
]
const birdOps = ({ young, blink, flap, sing, sleep }, sk) => {
  // fledglings wear a softer, half-grown version of the colours
  const b = young ? mix(sk.c.body, '#c9d2da', 0.35) : sk.c.body, bd = young ? mix(sk.c.dark, '#8f9aa6', 0.35) : sk.c.dark
  const belly = young ? mix(sk.c.belly, '#efe6d6', 0.4) : sk.c.belly
  return [
    ['e', 6.5, 7, 5, 3.8, b], ['e', 7.8, 8, 3.2, 2.6, belly],
    ['e', 9.6, sleep ? 4.8 : 4, 3, 2.8, b],
    ['e', 1.6, 5.6, 1.8, 1, bd],
    flap ? ['e', 5, 3.6, 3.2, 1.6, bd] : ['e', 5, 6.6, 3, 2, bd],
    ...(young ? [['p', [[9, 1], [10, 0]], K.fluff]] : [['p', [[10, 1], [11, 0], [9, 0]], b]]),
    ['o', K.birdOut],
    ...(young ? [] : [['e', 9.4, 3, 1.4, 0.8, sk.c.light]]),
    ['p', [[10, sleep ? 5 : 4]], sleep || blink ? bd : K.pupil],
    ['p', sing ? [[13, 3], [13, 5]] : [[13, sleep ? 5 : 4], [13, sleep ? 6 : 5]], sk.c.beak],
    ['p', [[6, 11], [8, 11]], K.leg],
  ]
}
const NOTE = [[2, 0], [3, 0], [2, 1], [2, 2], [0, 3], [1, 3], [2, 3], [0, 4], [1, 4]]
const SPARK = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]
const Z = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]]
function shellCup() {
  const g = build(14, 6, [['e', 7, 0.6, 6.6, 5.2, K.shell], ['p', [[3, 3], [4, 3], [9, 2], [10, 4]], K.spot]])
  for (let x = 0; x < 14; x++) { const top = 1 + (x % 3 === 1 ? 1 : 0); for (let y = 0; y < top; y++) g[y][x] = null }
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
    return kind === 'chick' ? build(12, 11, chickOps(o, sk)) : build(14, 12, birdOps({ ...o, young: kind === 'fled' }, sk))
  }
  return {
    cup: shellCup,
    bit: () => build(4, 2, [['e', 2, 0.3, 1.8, 1.7, K.shell], ['o', K.shellOut]]),
    note: () => build(5, 5, [['p', NOTE, K.note]]),
    spark: () => build(3, 3, [['p', SPARK, K.spark]]),
    z: () => build(4, 4, [['p', Z, K.note]]),
  }[name]()
}
// for the pet card: one sprite at a chosen scale (stage key + mood)
export function petPortrait(stageKey, mood, scale = 6, skin = 'bluebird', pose = '') {
  const base = { hatchling: 'chick', fledgling: 'fled', adult: 'bird' }[stageKey]
  const name = base && (pose && POSES[base + pose] ? base + pose : mood === 'sleepy' ? base + 'Sleep' : base)
  if (name) return render(sheet(name, skin), false, scale)
  const egg = build(10, 12, [['e', 5, 6.4, 4.6, 5.6, K.shell], ['p', [[3, 5], [4, 5], [6, 8], [7, 8], [6, 3]], skin === 'bluebird' ? K.spot : skinById(skin).c.dark], ['o', K.shellOut],
    ...(stageKey === 'cracking' ? [['p', [[1, 6], [2, 5], [3, 6], [4, 5], [5, 6], [6, 5], [7, 6], [8, 5]], K.shellOut]] : [])])
  return render(egg, false, scale)
}

// ── in the scene ──────────────────────────────────────────────────────────────
const EGG = { cx: 372, cy: 363, rx: 20, ry: 25 }
const NEST = { x: 372, y: 384 }          // where a chick sits
const LEDGE = { x: 458, y: 412 }         // fledgling's perch on the moss right of the glass house
const ROOF = { x: 374, y: 238 }          // adult's perch on the glass-house finial
const CRACKS = [[356, 356], [361, 352], [365, 357], [370, 351], [375, 357], [380, 352], [385, 357], [389, 353]]

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
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 56
    const x = cv.getContext('2d')
    x.drawImage(img, EGG.cx - 24, EGG.cy - 30, 48, 56, 0, 0, 48, 56)
    const d = x.getImageData(0, 0, 48, 56), px = d.data
    for (let y = 0; y < 56; y++) {
      const ay = EGG.cy - 30 + y
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
          const [x0, y0] = CRACKS[i], [x1, y1] = CRACKS[i + 1], n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / P)
          for (let k = 0; k <= n; k++) pxRect(ctx, x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)
        }
        // an eye peeks through the crack now and then
        if (!still && f % 150 > 128) { ctx.fillStyle = '#120c06'; pxRect(ctx, 369, 345, 6, 6); ctx.fillStyle = '#fff'; pxRect(ctx, 372, 345) }
      }
      ctx.restore()
      if (react) sparkles(ctx, s, f, EGG.cx, EGG.cy - 10)
      return
    }

    // hatched: paint out the egg, leave shell bits in the nest
    if (img && img.complete && img.naturalWidth) ctx.drawImage(cleanPlate(img), EGG.cx - 24, EGG.cy - 30)
    put(ctx, s('bit'), 348, 381); put(ctx, s('bit'), 384, 384)

    if (stage === 'hatchling') {
      const hop = react?.type === 'task' ? Math.abs(Math.sin(react.k / 6 * Math.PI)) * 8 : (!still && !sleepy && f % 90 > 80 ? Math.abs(Math.sin((f % 90 - 80) / 10 * Math.PI)) * 5 : 0)
      const name = sleepy && !react ? 'chickSleep' : react?.type === 'focus' && (react.k >> 2) % 2 ? 'chickPeep' : (!still && f % 70 < 2 ? 'chickBlink' : 'chick')
      const sp = s(name), x = NEST.x - sp.width / 2 + (still ? 0 : Math.round(Math.sin(f / 50)) * P)
      put(ctx, sp, x, NEST.y - sp.height - 6 - hop)
      put(ctx, s('cup'), EGG.cx - 21, 375)
      if (react) sparkles(ctx, s, f, NEST.x, NEST.y - 42)
      else if (sleepy && !still) zees(ctx, s, f, NEST.x + 12, NEST.y - 42)
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
    put(ctx, sp, x - sp.width / 2, y - sp.height, flip)
    if (!flight && !still && f - sing < 48) {
      for (let k = 0; k < 2; k++) {
        const t = ((f - sing + k * 12) % 24) / 24
        ctx.globalAlpha = 1 - t
        put(ctx, s('note'), x + 18 + t * 12 + k * 6, y - 36 - t * 21)
      }
      ctx.globalAlpha = 1
    }
    if (react && !flight) sparkles(ctx, s, f, x, y - 24)
    else if (sleepy && !still) zees(ctx, s, f, x + 14, y - 33)
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
