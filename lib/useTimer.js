import { useEffect, useRef, useState } from 'react'

export const MODES = { focus: 25, short: 5, long: 15 }

function playDone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination); o.frequency.value = f
      g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.18)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.3)
      o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.3)
    })
  } catch {}
}

// Timestamp-driven pomodoro timer (survives tab throttling). Same behaviour as the v8 artifact.
// onRecord(minutes, completed) is called when focus time should be logged.
export function useTimer(onRecord) {
  const [mode, setModeState] = useState('focus')
  const [running, setRunning] = useState(false)
  const [secs, setSecs] = useState(MODES.focus * 60)
  const [count, setCount] = useState(0)
  const st = useRef({ interval: null, start: null, endAt: null, mode: 'focus', secs: MODES.focus * 60, count: 0 })
  const rec = useRef(onRecord)
  rec.current = onRecord

  useEffect(() => () => clearInterval(st.current.interval), [])

  const applyMode = m => { st.current.mode = m; st.current.secs = MODES[m] * 60; setModeState(m); setSecs(MODES[m] * 60) }

  function pauseAndRecord() {
    const s = st.current
    clearInterval(s.interval)
    if (s.start && s.mode === 'focus') {
      const mins = Math.round((Date.now() - s.start) / 60000)
      if (mins >= 1) rec.current(mins, false)
    }
    if (s.endAt) { s.secs = Math.max(0, Math.round((s.endAt - Date.now()) / 1000)); setSecs(s.secs) }
    s.start = null; s.endAt = null
  }

  function tick() {
    const s = st.current
    s.secs = Math.max(0, Math.round((s.endAt - Date.now()) / 1000))
    setSecs(s.secs)
    if (s.secs > 0) return
    clearInterval(s.interval); s.start = null; s.endAt = null; setRunning(false)
    if (s.mode === 'focus') {
      s.count += 1; setCount(s.count)
      rec.current(MODES.focus, true); playDone()
      applyMode(s.count % 4 === 0 ? 'long' : 'short')
    } else applyMode('focus')
  }

  return {
    mode, running, secs, count, total: MODES[mode] * 60,
    setMode(m) { if (!running) applyMode(m) },
    toggle() {
      const s = st.current
      if (running) { setRunning(false); pauseAndRecord() }
      else {
        setRunning(true); s.start = Date.now(); s.endAt = Date.now() + s.secs * 1000
        clearInterval(s.interval); s.interval = setInterval(tick, 500)
      }
    },
    reset() {
      const s = st.current
      if (running) pauseAndRecord()
      setRunning(false); s.start = null; s.endAt = null
      s.secs = MODES[s.mode] * 60; setSecs(s.secs)
    },
    skip() {
      const s = st.current
      if (running) pauseAndRecord()
      setRunning(false); s.start = null; s.endAt = null
      if (s.mode === 'focus') { s.count += 1; setCount(s.count); applyMode('short') } else applyMode('focus')
    },
  }
}
