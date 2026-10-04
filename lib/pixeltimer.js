// Pixel-art pomodoro timer character. Flat colours only, drawn per frame on a tiny canvas.
// The clock belly is a real "time timer" dial: the coloured wedge is the time remaining.

export const TW = 36, TH = 44

const COL = {
  out: '#7d2a20', red: '#c8503c', redD: '#a63f2e', hi: '#e98a72', blush: '#f4a394',
  foot: '#7d2a20', eye: '#2a1812', white: '#ffffff', mouth: '#5a1f16',
  cream: '#f8f2dc', rim: '#5b3a2a', tick: '#8a6a52', hand: '#3b241a',
  wedgeFocus: '#a7c46f', wedgeBreak: '#86c2bd',
  leafD: '#4b7030', leaf: '#6f9a44', leafL: '#9cc266', stem: '#5b4a2c',
  shadow: 'rgba(40,30,20,.20)', heart: '#e8807a', z: '#6fb0ab', spark: '#f6e7a3',
}

const HEART = [[0, 1, 0, 1, 0], [1, 1, 1, 1, 1], [0, 1, 1, 1, 0], [0, 0, 1, 0, 0]]
const ZED = [[1, 1, 1], [0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 1]]

function stamp(ctx, pat, x, y, color) {
  ctx.fillStyle = color
  pat.forEach((row, j) => row.forEach((v, i) => { if (v) ctx.fillRect(x + i, y + j, 1, 1) }))
}

// s = { f, mode, running, frac (0..1 time remaining), cheer (frames left, 0 = none) }
export function drawTimer(ctx, s) {
  const { f, mode, running, frac, cheer = 0 } = s
  ctx.clearRect(0, 0, TW, TH)
  const brk = mode !== 'focus'
  const cheering = cheer > 0

  // motion ------------------------------------------------------------------
  let ox = 0, bob = 0
  if (cheering) { ox = f % 2 ? 1 : -1; bob = f % 4 < 2 ? -2 : 0 }
  else if (running) { ox = 0; bob = f % 8 < 4 ? 0 : -1; if (f % 16 === 0) ox = 1 }
  else bob = f % 24 < 12 ? 0 : 1 // slow breathing
  const cx = 18 + ox, cy = 26 + bob

  // ground shadow
  ctx.fillStyle = COL.shadow
  const sw = cheering && bob < 0 ? 9 : 11
  for (let dx = -sw; dx <= sw; dx++) ctx.fillRect(18 + dx, 41, 1, 1)
  for (let dx = -sw + 2; dx <= sw - 2; dx++) ctx.fillRect(18 + dx, 42, 1, 1)

  // feet
  const hopL = running && f % 8 < 4, hopR = running && f % 8 >= 4
  ctx.fillStyle = COL.foot
  ctx.fillRect(cx - 8, 39 - (hopL ? 1 : 0), 4, 2)
  ctx.fillRect(cx + 4, 39 - (hopR ? 1 : 0), 4, 2)

  // body ---------------------------------------------------------------------
  const rx = 14, ry = 13.4
  for (let y = cy - 14; y <= cy + 14; y++) for (let x = cx - 16; x <= cx + 16; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy
    if (d > 1) continue
    let c
    if (d > 0.8) c = COL.out
    else {
      c = COL.red
      if (dx * 0.6 + dy * 0.8 > 0.5) c = COL.redD
      const hx = (x + 0.5 - (cx - 9)) / 3, hy = (y + 0.5 - (cy - 7)) / 2
      if (hx * hx + hy * hy < 1) c = COL.hi
    }
    ctx.fillStyle = c
    ctx.fillRect(x, y, 1, 1)
  }

  // leaf crown (sways) -------------------------------------------------------
  const sway = f % 12 < 6 ? 0 : 1
  const top = cy - 13
  const L = (dx, dy, c) => { ctx.fillStyle = c; ctx.fillRect(cx + dx, top + dy, 1, 1) }
  ;[[-1, 0], [-2, 0], [-3, 0], [-4, 1 + sway], [-5, 1 + sway]].forEach(([a, b]) => L(a, b, COL.leaf))
  ;[[1, 0], [2, 0], [3, 0], [4, 1 + sway], [5, 1 + sway]].forEach(([a, b]) => L(a, b, COL.leaf))
  ;[[-1, -1], [-2, -1], [-3, 0 - 1 + sway], [-4, 0 + sway]].forEach(([a, b]) => L(a, b, COL.leafL))
  ;[[1, -1], [2, -1], [3, -1 + sway], [4, 0 + sway]].forEach(([a, b]) => L(a, b, COL.leafL))
  ;[[0, 1], [-1, 1], [1, 1], [0, 2]].forEach(([a, b]) => L(a, b, COL.leafD))
  ;[[0, -1], [0, -2], [0, -3], [1, -3 + (sway ? 0 : 0)]].forEach(([a, b]) => L(a, b, COL.stem))

  // face ---------------------------------------------------------------------
  const ey = cy - 7
  const happy = brk || cheering
  const blink = !happy && f % 44 < 2
  const eyeAt = (x) => {
    if (happy) { // ^ ^
      ctx.fillStyle = COL.eye
      ctx.fillRect(x, ey + 1, 1, 1); ctx.fillRect(x + 1, ey, 2, 1); ctx.fillRect(x + 3, ey + 1, 1, 1)
    } else if (blink) {
      ctx.fillStyle = COL.eye; ctx.fillRect(x, ey + 1, 2, 1)
    } else {
      ctx.fillStyle = COL.eye; ctx.fillRect(x, ey - 1, 2, 3)
      ctx.fillStyle = COL.white; ctx.fillRect(x, ey - 1, 1, 1)
    }
  }
  eyeAt(happy ? cx - 7 : cx - 6)
  eyeAt(happy ? cx + 3 : cx + 4)
  // smile
  ctx.fillStyle = COL.mouth
  ctx.fillRect(cx - 1, ey + 2, 2, 1)
  // blush
  ctx.fillStyle = COL.blush
  ctx.fillRect(cx - 11, ey + 3, 3, 1); ctx.fillRect(cx + 8, ey + 3, 3, 1)

  // clock belly --------------------------------------------------------------
  const dcx = cx, dcy = cy + 4.5, R = 7.4
  const wedge = brk ? COL.wedgeBreak : COL.wedgeFocus
  const fr = Math.max(0, Math.min(1, frac))
  for (let y = Math.floor(dcy - R); y <= Math.ceil(dcy + R); y++) for (let x = Math.floor(dcx - R); x <= Math.ceil(dcx + R); x++) {
    const ddx = x + 0.5 - dcx, ddy = y + 0.5 - dcy, rr = Math.hypot(ddx, ddy)
    if (rr > R) continue
    let c
    if (rr > R - 1.3) c = COL.rim
    else {
      let a = Math.atan2(ddx, -ddy); if (a < 0) a += Math.PI * 2
      c = fr >= 0.999 || a <= fr * Math.PI * 2 ? wedge : COL.cream
      if (rr > 4.4 && (Math.abs(ddx) < 0.9 || Math.abs(ddy) < 0.9)) c = COL.tick
    }
    ctx.fillStyle = c
    ctx.fillRect(x, y, 1, 1)
  }
  // hand
  const th = fr * Math.PI * 2
  ctx.fillStyle = COL.hand
  for (let t = 0; t <= 4.9; t += 0.5) ctx.fillRect(Math.floor(dcx + Math.sin(th) * t), Math.floor(dcy - Math.cos(th) * t), 1, 1)
  ctx.fillRect(Math.floor(dcx) - 0, Math.floor(dcy) - 0, 1, 1)

  // extras -------------------------------------------------------------------
  if (running && !cheering) {
    const on = f % 8 < 4
    ctx.fillStyle = COL.spark
    const sx = cx + 14, sy = cy - 15
    if (on) { ctx.fillRect(sx, sy, 1, 1); ctx.fillRect(sx - 1, sy, 1, 1); ctx.fillRect(sx + 1, sy, 1, 1); ctx.fillRect(sx, sy - 1, 1, 1); ctx.fillRect(sx, sy + 1, 1, 1) }
    else ctx.fillRect(sx, sy, 1, 1)
  }
  if (brk && !cheering) {
    for (let k = 0; k < 3; k++) {
      const t = (f * 0.35 + k * 6.5) % 19
      if (t > 15) continue
      ctx.globalAlpha = t > 11 ? 0.5 : 1
      stamp(ctx, ZED, Math.round(cx + 12 + t * 0.35), Math.round(cy - 12 - t * 0.9), COL.z)
      ctx.globalAlpha = 1
    }
  }
  if (cheering) {
    ctx.fillStyle = COL.out
    const v = f % 2
    for (const side of [-1, 1]) {
      const bx = cx + side * (17 + v)
      ctx.fillRect(bx, cy - 3, 1, 1); ctx.fillRect(bx + side, cy - 1, 1, 3); ctx.fillRect(bx, cy + 3, 1, 1)
    }
    const age = 30 - cheer
    for (let k = 0; k < 3; k++) {
      const t = age * 0.5 + k * 3
      if (t < 0 || t > 13) continue
      ctx.globalAlpha = t > 9 ? 0.5 : 1
      stamp(ctx, HEART, Math.round(cx - 12 + k * 10 + Math.sin(t) * 2), Math.round(cy - 16 - t * 1.2), COL.heart)
      ctx.globalAlpha = 1
    }
  }
}

// 10×10 tomato-timer icon for the Focus tab label
export function drawTomatoIcon(ctx, f = 0) {
  ctx.clearRect(0, 0, 10, 10)
  const cx = 5, cy = 6.2, rx = 4.6, ry = 3.9
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy
    if (d > 1) continue
    ctx.fillStyle = d > 0.62 ? COL.out : COL.red
    ctx.fillRect(x, y, 1, 1)
  }
  ctx.fillStyle = COL.hi; ctx.fillRect(2, 5, 1, 1)
  ctx.fillStyle = COL.cream; ctx.fillRect(4, 6, 2, 2)
  ctx.fillStyle = COL.hand; ctx.fillRect(5, 6, 1, 1)
  const s = f % 2
  ctx.fillStyle = COL.leaf
  ctx.fillRect(3, 2, 1, 1); ctx.fillRect(4, 2, 1, 1); ctx.fillRect(6, 2, 1, 1); ctx.fillRect(7, 2, 1, 1)
  ctx.fillRect(2, 2 + s, 1, 1); ctx.fillRect(8, 2 + s, 1, 1)
  ctx.fillStyle = COL.leafL; ctx.fillRect(3, 1, 1, 1); ctx.fillRect(7, 1, 1, 1)
  ctx.fillStyle = COL.stem; ctx.fillRect(5, 0, 1, 3)
}
