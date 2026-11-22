import { useEffect, useRef, useState } from 'react'

// Defaults (minutes)
export const DEFAULT_MODES = { focus: 25, short: 5, long: 15 }

// Persist custom durations in localStorage so they survive page reloads / new sessions
function loadDurations() {
  try {
    const s = localStorage.getItem('pomodoro-durations')
    if (s) {
      const p = JSON.parse(s)
      return {
        focus: (p.focus >= 1 && p.focus <= 120) ? p.focus : DEFAULT_MODES.focus,
        short: (p.short >= 1 && p.short <= 60)  ? p.short : DEFAULT_MODES.short,
        long:  (p.long  >= 1 && p.long  <= 120) ? p.long  : DEFAULT_MODES.long,
      }
    }
  } catch {}
  return { ...DEFAULT_MODES }
}

function saveDurations(d) {
  try { localStorage.setItem('pomodoro-durations', JSON.stringify(d)) } catch {}
}

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

// Timestamp-driven pomodoro timer (survives tab throttling).
// onRecord(minutes, completed) is called when focus time should be logged.
export function useTimer(onRecord) {
  const [mode, setModeState] = useState('focus')
  const [running, setRunning] = useState(false)
  const [secs, setSecs] = useState(() => loadDurations().focus * 60)
  const [count, setCount] = useState(0)
  const [durations, setDurationsState] = useState(loadDurations)

  const st = useRef({ interval: null, start: null, endAt: null, mode: 'focus', secs: 0, count: 0, durations: loadDurations() })
  // Keep ref in sync with state
  st.current.durations = durations

  const rec = useRef(onRecord)
  rec.current = onRecord

  useEffect(() => () => clearInterval(st.current.interval), [])

  const applyMode = m => {
    const mins = st.current.durations[m]
    st.current.mode = m; st.current.secs = mins * 60
    setModeState(m); setSecs(mins * 60)
  }

  function setDurations(next) {
    saveDurations(next)
    setDurationsState(next)
    st.current.durations = next
    // If not running, update the current display to reflect the new duration
    if (!st.current.start) {
      const mins = next[st.current.mode]
      st.current.secs = mins * 60
      setSecs(mins * 60)
    }
  }

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
      rec.current(s.durations.focus, true); playDone()
      applyMode(s.count % 4 === 0 ? 'long' : 'short')
    } else applyMode('focus')
  }

  return {
    mode, running, secs, count, durations,
    get total() { return st.current.durations[mode] * 60 },
    setMode(m) { if (!running) applyMode(m) },
    setDurations,
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
      s.secs = s.durations[s.mode] * 60; setSecs(s.secs)
    },
    skip() {
      const s = st.current
      if (running) pauseAndRecord()
      setRunning(false); s.start = null; s.endAt = null
      if (s.mode === 'focus') { s.count += 1; setCount(s.count); applyMode('short') } else applyMode('focus')
    },
  }
}
