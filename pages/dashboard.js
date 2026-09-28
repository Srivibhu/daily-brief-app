import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'

// ── Helpers ──────────────────────────────────────────────────────────────────
function dateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}
function todayStr() { return dateStr(new Date()) }

function isoWeekYear(d) {
  // Returns { week, year } ISO week
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const jan1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((date - jan1) / 86400000) + 1) / 7)
  return { week, year: date.getUTCFullYear() }
}

function urgency(task) {
  if (!task.due) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const due = new Date(task.due + 'T00:00:00')
  const diff = Math.round((due - today) / 86400000)
  if (diff < 0) return { num: Math.abs(diff), cls: 'u-overdue', label: diff === -1 ? 'day ago' : 'days ago' }
  if (diff === 0) return { num: null, cls: 'u-today', label: 'Today' }
  if (diff === 1) return { num: 1, cls: 'u-soon', label: 'day left' }
  if (diff <= 3) return { num: diff, cls: 'u-soon', label: 'days left' }
  if (diff <= 7) return { num: diff, cls: 'u-week', label: 'days left' }
  return { num: diff, cls: 'u-later', label: 'days left' }
}

function fmtMins(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

const PRIORITY_LABEL = { p1: '🔴 P1', p2: '🟡 P2', p3: '🔵 P3' }
const PRIORITY_COLOR = { p1: '#ef4444', p2: '#eab308', p3: '#3b82f6' }
const URGENCY_COLORS = { 'u-overdue': '#ef4444', 'u-today': '#f97316', 'u-soon': '#eab308', 'u-week': '#22c55e', 'u-later': '#666' }
const FOCUS_MODES = { focus: 25*60, short: 5*60, long: 15*60 }
const PRESET_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#64748b']

// ── Notification reminder hook ────────────────────────────────────────────────
function useReminders(tasks) {
  const firedRef = useRef(new Set())

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (Notification.permission === 'default') Notification.requestPermission()

    function checkReminders() {
      if (Notification.permission !== 'granted') return
      const now = Date.now()
      tasks.forEach(t => {
        if (!t.due || t.completed_at) return
        const dueDate = new Date(t.due + 'T' + (t.due_time || '23:59') + ':00')
        const diff = dueDate.getTime() - now
        const diffMin = diff / 60000

        const thresholds = [
          { key: `${t.id}-overdue`, min: -Infinity, max: 0, msg: `⚠️ OVERDUE: ${t.name}` },
          { key: `${t.id}-1d`, min: 23*60, max: 25*60, msg: `📅 Due tomorrow: ${t.name}` },
          { key: `${t.id}-5h`, min: 4*60+30, max: 5*60+30, msg: `⏰ Due in 5 hours: ${t.name}` },
          { key: `${t.id}-1h`, min: 50, max: 70, msg: `🔔 Due in 1 hour: ${t.name}` },
        ]
        thresholds.forEach(({ key, min, max, msg }) => {
          if (diffMin >= min && diffMin <= max && !firedRef.current.has(key)) {
            firedRef.current.add(key)
            new Notification('Daily Brief', { body: msg, icon: '/favicon.ico' })
          }
          // Reset overdue key daily
          if (key.includes('-overdue') && diff > 0) firedRef.current.delete(key)
        })
      })
    }

    checkReminders()
    const id = setInterval(checkReminders, 60000)
    return () => clearInterval(id)
  }, [tasks])
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  })
  if (res.status === 204) return null
  return res.json()
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [tags, setTags] = useState([])
  const [sessions, setSessions] = useState([]) // focus_sessions rows
  const [tab, setTab] = useState('tasks')
  const [expandedId, setExpandedId] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [newTask, setNewTask] = useState({ name:'', notes:'', priority:'', tags:[], due:'', due_time:'', link:'' })

  // Focus / Pomodoro state
  const [timerMode, setTimerMode] = useState('focus') // 'focus'|'short'|'long'
  const [timerState, setTimerState] = useState('idle') // 'idle'|'running'|'paused'
  const [timerSecs, setTimerSecs] = useState(FOCUS_MODES.focus)
  const sessionStartRef = useRef(null)
  const sessionEndAtRef = useRef(null)
  const intervalRef = useRef(null)
  const completedSessionsRef = useRef(0)

  // Notification
  useReminders(tasks)

  // Date rollover
  const lastDayRef = useRef(todayStr())
  useEffect(() => {
    const check = () => { const d = todayStr(); if (d !== lastDayRef.current) { lastDayRef.current = d; loadData() } }
    const id = setInterval(check, 60000)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
    window.addEventListener('focus', check)
    return () => clearInterval(id)
  }, [])

  // Auth check
  useEffect(() => {
    api('/api/auth/me').then(data => {
      const u = data?.user || data
      if (u?.id) { setUser(u); loadData() }
      else router.replace('/login')
    }).catch(() => router.replace('/login')).finally(() => setAuthLoading(false))
  }, [])

  async function loadData() {
    const [t, tg, f] = await Promise.all([
      api('/api/tasks'),
      api('/api/tags'),
      api('/api/focus')
    ])
    if (Array.isArray(t)) setTasks(t)
    if (Array.isArray(tg)) setTags(tg)
    if (Array.isArray(f)) setSessions(f)
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  // ── Task mutations ──────────────────────────────────────────────────────────
  async function createTask() {
    if (!newTask.name.trim()) return
    const data = await api('/api/tasks', { method: 'POST', body: { ...newTask, progress: 0 } })
    if (data?.id) { setTasks(t => [data, ...t]); setNewTask({ name:'', notes:'', priority:'', tags:[], due:'', due_time:'', link:'' }); setShowNewTask(false) }
  }

  async function updateTask(id, patch) {
    const data = await api(`/api/tasks/${id}`, { method: 'PATCH', body: patch })
    if (data?.id) setTasks(ts => ts.map(t => t.id === id ? data : t))
  }

  async function deleteTask(id) {
    await api(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(ts => ts.filter(t => t.id !== id))
  }

  // ── Focus timer ─────────────────────────────────────────────────────────────
  function startTimer() {
    if (timerState === 'running') return
    sessionStartRef.current = Date.now()
    sessionEndAtRef.current = Date.now() + timerSecs * 1000
    setTimerState('running')
    intervalRef.current = setInterval(() => {
      const rem = Math.max(0, Math.round((sessionEndAtRef.current - Date.now()) / 1000))
      setTimerSecs(rem)
      if (rem <= 0) { completeTimer() }
    }, 500)
  }

  function pauseTimer() {
    clearInterval(intervalRef.current)
    if (sessionStartRef.current && timerMode === 'focus') {
      const mins = Math.round((Date.now() - sessionStartRef.current) / 60000)
      if (mins >= 1) recordFocus(mins, false)
    }
    const rem = Math.max(0, Math.round((sessionEndAtRef.current - Date.now()) / 1000))
    setTimerSecs(rem)
    sessionStartRef.current = null; sessionEndAtRef.current = null
    setTimerState('paused')
  }

  function resetTimer(mode) {
    clearInterval(intervalRef.current)
    if (timerState === 'running' && sessionStartRef.current && timerMode === 'focus') {
      const mins = Math.round((Date.now() - sessionStartRef.current) / 60000)
      if (mins >= 1) recordFocus(mins, false)
    }
    sessionStartRef.current = null; sessionEndAtRef.current = null
    const m = mode || timerMode
    setTimerMode(m); setTimerSecs(FOCUS_MODES[m]); setTimerState('idle')
  }

  function completeTimer() {
    clearInterval(intervalRef.current)
    sessionStartRef.current = null; sessionEndAtRef.current = null
    if (timerMode === 'focus') {
      completedSessionsRef.current += 1
      recordFocus(25, true)
      playChime()
    }
    setTimerState('idle')
    setTimerSecs(FOCUS_MODES[timerMode])
  }

  async function recordFocus(mins, completed) {
    const s = { date: todayStr(), minutes: mins, completed }
    const data = await api('/api/focus', { method: 'POST', body: s })
    if (data?.id) setSessions(ss => [data, ...ss])
  }

  async function deleteSession(id) {
    await api('/api/focus', { method: 'DELETE', body: { id } })
    setSessions(ss => ss.filter(s => s.id !== id))
  }

  async function manualLog(mins) {
    if (!mins || mins < 1) return
    const data = await api('/api/focus', { method: 'POST', body: { date: todayStr(), minutes: mins, completed: false, manual: true } })
    if (data?.id) setSessions(ss => [data, ...ss])
  }

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ;[0, 0.15, 0.3].forEach((t, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = [523, 659, 784][i]
        g.gain.setValueAtTime(0.3, ctx.currentTime + t)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.5)
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.5)
      })
    } catch {}
  }

  // ── Analytics computation ───────────────────────────────────────────────────
  function getWeeklyStats() {
    const weeks = {}
    tasks.forEach(t => {
      const created = new Date(t.created_at + 'T00:00:00')
      const { week, year } = isoWeekYear(created)
      const key = `${year}-W${String(week).padStart(2,'0')}`
      if (!weeks[key]) weeks[key] = { key, week, year, scheduled: 0, completed: 0 }
      weeks[key].scheduled++
      if (t.completed_at) {
        const comp = new Date(t.completed_at + 'T00:00:00')
        const { week: cw, year: cy } = isoWeekYear(comp)
        const ckey = `${cy}-W${String(cw).padStart(2,'0')}`
        if (!weeks[ckey]) weeks[ckey] = { key: ckey, week: cw, year: cy, scheduled: 0, completed: 0 }
        weeks[ckey].completed++
      }
    })
    return Object.values(weeks).sort((a,b) => b.key.localeCompare(a.key)).slice(0, 8)
  }

  function getFocusByDate() {
    const map = {}
    sessions.forEach(s => {
      if (!map[s.date]) map[s.date] = { minutes: 0, count: 0, completed: 0 }
      map[s.date].minutes += s.minutes
      map[s.date].count++
      if (s.completed) map[s.date].completed++
    })
    return map
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const activeTasks = tasks.filter(t => !t.completed_at)
  const doneTasks = tasks.filter(t => !!t.completed_at)
  const todaySessions = sessions.filter(s => s.date === todayStr())
  const todayMins = todaySessions.reduce((a,s) => a+s.minutes, 0)
  const todayPomos = todaySessions.filter(s => s.completed).length
  const focusByDate = getFocusByDate()
  const weekStats = getWeeklyStats()
  const currentWeek = isoWeekYear(new Date())
  const thisWeekStats = weekStats.find(w => w.week === currentWeek.week && w.year === currentWeek.year) || { scheduled:0, completed:0 }
  const lastWeekDate = new Date(); lastWeekDate.setDate(lastWeekDate.getDate()-7)
  const lastWeek = isoWeekYear(lastWeekDate)
  const lastWeekStats = weekStats.find(w => w.week === lastWeek.week && w.year === lastWeek.year) || { scheduled:0, completed:0 }

  const timerProgress = 1 - timerSecs / FOCUS_MODES[timerMode]
  const circumference = 2 * Math.PI * 72
  const dashOffset = circumference * (1 - timerProgress)

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#666', fontSize: 14 }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 24px',
        display: 'flex', alignItems: 'center', height: 54, gap: 24, position: 'sticky', top: 0,
        background: 'rgba(10,10,10,.95)', backdropFilter: 'blur(8px)', zIndex: 100 }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginRight: 8 }}>
          Daily Brief
        </span>
        {['tasks','focus','analytics'].map(t => (
          <button key={t} onClick={() => setTab(t)} className="btn-ghost"
            style={{ textTransform: 'capitalize', fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--text)' : 'var(--text2)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0, padding: '0 4px', height: 54 }}>
            {t}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowTagModal(true)} className="btn-ghost" style={{ fontSize: 12 }}>
          🏷 Tags
        </button>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>@{user?.username}</span>
        <button onClick={logout} className="btn-ghost" style={{ fontSize: 12 }}>Sign out</button>
      </header>

      <main style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <div>
            {/* Add task */}
            <div style={{ marginBottom: 20 }}>
              {!showNewTask ? (
                <button onClick={() => setShowNewTask(true)}
                  style={{ background: 'var(--surface)', border: '1px dashed var(--border)',
                    borderRadius: 10, padding: '10px 16px', color: 'var(--text2)', fontSize: 14,
                    cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                  + New task…
                </button>
              ) : (
                <NewTaskForm
                  newTask={newTask} setNewTask={setNewTask} tags={tags}
                  onCreate={createTask} onCancel={() => setShowNewTask(false)}
                />
              )}
            </div>

            {/* Active cards grid */}
            {activeTasks.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
                  letterSpacing: 1, marginBottom: 12 }}>
                  Active · {activeTasks.length}
                </div>
                <div style={{ display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 32 }}>
                  {activeTasks.map(t => (
                    <TaskCard key={t.id} task={t} tags={tags}
                      expanded={expandedId === t.id}
                      onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
                      onUpdate={updateTask} onDelete={deleteTask}
                    />
                  ))}
                </div>
              </>
            )}

            {activeTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 14 }}>
                No active tasks — add one above
              </div>
            )}

            {/* Done section */}
            {doneTasks.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text3)',
                  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, userSelect: 'none' }}>
                  Done · {doneTasks.length}
                </summary>
                <div style={{ display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginTop: 12 }}>
                  {doneTasks.map(t => (
                    <TaskCard key={t.id} task={t} tags={tags}
                      expanded={expandedId === t.id}
                      onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
                      onUpdate={updateTask} onDelete={deleteTask}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* ── FOCUS TAB ── */}
        {tab === 'focus' && (
          <FocusTab
            timerMode={timerMode} timerState={timerState} timerSecs={timerSecs}
            timerProgress={timerProgress} circumference={circumference} dashOffset={dashOffset}
            completedSessions={completedSessionsRef.current}
            todayMins={todayMins} todayPomos={todayPomos}
            sessions={sessions} focusByDate={focusByDate}
            onStart={startTimer} onPause={pauseTimer}
            onSetMode={m => { if (timerState !== 'running') resetTimer(m) }}
            onReset={() => resetTimer()}
            onDeleteSession={deleteSession}
            onManualLog={manualLog}
          />
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <AnalyticsTab
            weekStats={weekStats} tasks={tasks} sessions={sessions}
            thisWeekStats={thisWeekStats} lastWeekStats={lastWeekStats}
            focusByDate={focusByDate}
          />
        )}
      </main>

      {/* Tag editor modal */}
      {showTagModal && (
        <TagModal tags={tags} setTags={setTags} onClose={() => setShowTagModal(false)} />
      )}
    </div>
  )
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task: t, tags, expanded, onToggle, onUpdate, onDelete }) {
  const u = urgency(t)
  const done = !!t.completed_at
  const accent = done ? '#333' : t.priority ? PRIORITY_COLOR[t.priority] : u ? URGENCY_COLORS[u.cls] : '#2a2a2a'
  const taskTags = (t.tags || []).map(name => tags.find(tg => tg.name === name)).filter(Boolean)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      overflow: 'hidden', position: 'relative', opacity: done ? 0.6 : 1,
      boxShadow: expanded ? '0 0 0 2px var(--accent)' : 'none',
      transition: 'box-shadow .15s'
    }}>
      {/* Left accent stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: accent, borderRadius: '12px 0 0 12px' }} />

      {/* Card body — clickable to expand */}
      <div onClick={onToggle} style={{ padding: '14px 14px 10px 18px', cursor: 'pointer',
        display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* Complete circle */}
        <button onClick={e => { e.stopPropagation(); onUpdate(t.id, { progress: done ? 0 : 100 }) }}
          style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            border: done ? 'none' : '2px solid var(--border)',
            background: done ? 'var(--green)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1
          }}>
          {done && <span style={{ color: '#000', fontSize: 11 }}>✓</span>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: done ? 'var(--text2)' : 'var(--text)',
            textDecoration: done ? 'line-through' : 'none', lineHeight: '1.3',
            wordBreak: 'break-word' }}>
            {t.name}
          </div>
          {t.notes && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4,
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {t.notes.replace(/<[^>]*>/g,'').slice(0,60)}
            </div>
          )}
          {/* Chips */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {t.priority && (
              <span style={{ fontSize: 10, background: PRIORITY_COLOR[t.priority]+'22',
                color: PRIORITY_COLOR[t.priority], borderRadius: 4, padding: '1px 6px' }}>
                {PRIORITY_LABEL[t.priority]}
              </span>
            )}
            {taskTags.map(tg => (
              <span key={tg.id} style={{ fontSize: 10, borderRadius: 4, padding: '1px 6px',
                background: tg.color+'22', color: tg.color }}>
                {tg.name}
              </span>
            ))}
            {t.due_time && (
              <span style={{ fontSize: 10, color: 'var(--text3)', padding: '1px 0' }}>
                ⏰ {t.due_time}
              </span>
            )}
          </div>
        </div>

        {/* Days left */}
        {u && (
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            {u.num !== null ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: URGENCY_COLORS[u.cls] }}>
                  {u.num}
                </div>
                <div style={{ fontSize: 9, color: URGENCY_COLORS[u.cls], lineHeight: 1.2 }}>
                  {u.label}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, fontWeight: 700, color: URGENCY_COLORS[u.cls] }}>Today</div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 18px 10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--surface3)', borderRadius: 2 }}>
          <div style={{ height: '100%', borderRadius: 2, background: done ? 'var(--green)' : 'var(--accent)',
            width: `${t.progress || 0}%`, transition: 'width .3s' }} />
        </div>
        <span style={{ fontSize: 10, color: 'var(--text3)', width: 28, textAlign: 'right' }}>
          {t.progress || 0}%
        </span>
        {t.link && (
          <a href={t.link} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>↗</a>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <TaskDetail task={t} tags={tags} onUpdate={onUpdate} onDelete={onDelete}
          onClose={() => {}} />
      )}
    </div>
  )
}

// ── Task Detail (expanded section) ───────────────────────────────────────────
function TaskDetail({ task: t, tags, onUpdate, onDelete }) {
  const [localProgress, setLocalProgress] = useState(t.progress || 0)
  const [localNotes, setLocalNotes] = useState(t.notes || '')
  const [localLink, setLocalLink] = useState(t.link || '')
  const [localDue, setLocalDue] = useState(t.due || '')
  const [localTime, setLocalTime] = useState(t.due_time || '')
  const [localPriority, setLocalPriority] = useState(t.priority || '')
  const [localTags, setLocalTags] = useState(t.tags || [])
  const saveTimer = useRef(null)

  function autosave(patch) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onUpdate(t.id, patch), 800)
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
      onClick={e => e.stopPropagation()}>

      {/* Progress slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
          <span>Progress</span><span>{localProgress}%</span>
        </div>
        <input type="range" min="0" max="100" value={localProgress}
          onChange={e => { const v = +e.target.value; setLocalProgress(v); autosave({ progress: v }) }}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>

      {/* Due date + time */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Due date</label>
          <input type="date" value={localDue}
            onChange={e => { setLocalDue(e.target.value); autosave({ due: e.target.value || null }) }}
            style={{ fontSize: 12 }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Time</label>
          <input type="time" value={localTime}
            onChange={e => { setLocalTime(e.target.value); autosave({ due_time: e.target.value || null }) }}
            style={{ fontSize: 12 }} />
        </div>
      </div>

      {/* Priority */}
      <div>
        <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Priority</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {['','p1','p2','p3'].map(p => (
            <button key={p} onClick={() => { setLocalPriority(p); autosave({ priority: p || null }) }}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5,
                background: localPriority === p ? (PRIORITY_COLOR[p] || 'var(--surface3)') : 'var(--surface2)',
                color: localPriority === p ? '#fff' : 'var(--text2)',
                border: '1px solid var(--border)' }}>
              {p ? PRIORITY_LABEL[p] : 'None'}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Tags</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map(tg => {
            const active = localTags.includes(tg.name)
            return (
              <button key={tg.id} onClick={() => {
                const next = active ? localTags.filter(x => x !== tg.name) : [...localTags, tg.name]
                setLocalTags(next); autosave({ tags: next })
              }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5,
                background: active ? tg.color+'33' : 'var(--surface2)',
                color: active ? tg.color : 'var(--text2)',
                border: `1px solid ${active ? tg.color : 'var(--border)'}` }}>
                {tg.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Link */}
      <div>
        <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Link</label>
        <input type="url" value={localLink} placeholder="https://..."
          onChange={e => { setLocalLink(e.target.value); autosave({ link: e.target.value }) }}
          style={{ fontSize: 12 }} />
      </div>

      {/* Notes */}
      <div>
        <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Notes</label>
        <textarea value={localNotes} rows={3} placeholder="Add notes…"
          onChange={e => { setLocalNotes(e.target.value); autosave({ notes: e.target.value }) }}
          style={{ fontSize: 13, resize: 'vertical', minHeight: 60 }} />
      </div>

      {/* Delete */}
      <button className="btn-danger" onClick={() => { if (confirm('Delete this task?')) onDelete(t.id) }}
        style={{ alignSelf: 'flex-start' }}>
        Delete task
      </button>
    </div>
  )
}

// ── New Task Form ─────────────────────────────────────────────────────────────
function NewTaskForm({ newTask, setNewTask, tags, onCreate, onCancel }) {
  function set(k, v) { setNewTask(t => ({ ...t, [k]: v })) }
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)',
      borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input value={newTask.name} onChange={e => set('name', e.target.value)}
        placeholder="Task name" autoFocus style={{ fontSize: 15, fontWeight: 600 }}
        onKeyDown={e => { if (e.key === 'Enter') onCreate(); if (e.key === 'Escape') onCancel() }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <select value={newTask.priority} onChange={e => set('priority', e.target.value)}
          style={{ flex: 1, fontSize: 12 }}>
          <option value="">Priority</option>
          <option value="p1">🔴 P1 — Critical</option>
          <option value="p2">🟡 P2 — High</option>
          <option value="p3">🔵 P3 — Normal</option>
        </select>
        <input type="date" value={newTask.due} onChange={e => set('due', e.target.value)}
          style={{ flex: 1, fontSize: 12 }} />
        <input type="time" value={newTask.due_time} onChange={e => set('due_time', e.target.value)}
          style={{ flex: 1, fontSize: 12 }} />
      </div>

      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map(tg => {
            const active = newTask.tags.includes(tg.name)
            return (
              <button key={tg.id} onClick={() => set('tags', active
                ? newTask.tags.filter(x => x !== tg.name) : [...newTask.tags, tg.name])}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5,
                  background: active ? tg.color+'33' : 'var(--surface2)', color: active ? tg.color : 'var(--text2)',
                  border: `1px solid ${active ? tg.color : 'var(--border)'}` }}>
                {tg.name}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onCreate}>Add task</button>
      </div>
    </div>
  )
}

// ── Focus Tab ────────────────────────────────────────────────────────────────
function FocusTab({ timerMode, timerState, timerSecs, circumference, dashOffset,
  completedSessions, todayMins, todayPomos, sessions, focusByDate,
  onStart, onPause, onSetMode, onReset, onDeleteSession, onManualLog }) {

  const [manualMins, setManualMins] = useState('')
  const today = todayStr()
  const todaySessions = sessions.filter(s => s.date === today)

  // Activity grid — last 28 days
  const days = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const mins = focusByDate[ds]?.minutes || 0
    days.push({ ds, mins, label: d.toLocaleDateString('en-US', { month:'short', day:'numeric' }) })
  }
  const maxMins = Math.max(...days.map(d => d.mins), 1)

  const modes = [['focus','25m'],['short','5m'],['long','15m']]

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Timer */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '32px 24px', textAlign: 'center', marginBottom: 20 }}>
        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
          {modes.map(([m,l]) => (
            <button key={m} onClick={() => onSetMode(m)} className="btn-ghost"
              style={{ fontWeight: timerMode === m ? 700 : 400, color: timerMode === m ? 'var(--accent)' : 'var(--text2)',
                borderBottom: timerMode === m ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: 0 }}>
              {l === '25m' ? 'Focus' : l === '5m' ? 'Short break' : 'Long break'}
            </button>
          ))}
        </div>

        {/* SVG ring */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}>
          <svg width="172" height="172" viewBox="0 0 172 172">
            <circle cx="86" cy="86" r="72" fill="none" stroke="var(--surface2)" strokeWidth="8"/>
            <circle cx="86" cy="86" r="72" fill="none"
              stroke={timerMode === 'focus' ? 'var(--accent)' : '#22c55e'}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '86px 86px', transition: 'stroke-dashoffset .5s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
              {fmtTime(timerSecs)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {timerMode === 'focus' ? 'focus' : timerMode === 'short' ? 'short break' : 'long break'}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {timerState === 'running' ? (
            <button className="btn-primary" onClick={onPause}>Pause</button>
          ) : (
            <button className="btn-primary" onClick={onStart}>
              {timerState === 'paused' ? 'Resume' : 'Start'}
            </button>
          )}
          {timerState !== 'idle' && (
            <button className="btn-ghost" onClick={onReset}>Reset</button>
          )}
        </div>

        {/* Today stats */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{fmtMins(todayMins)}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>today</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{todayPomos}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>sessions</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text2)' }}>{completedSessions}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>pomos done</div>
          </div>
        </div>
      </div>

      {/* Activity grid */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 12 }}>
          28-day activity
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(28, 1fr)', gap: 3 }}>
          {days.map(({ ds, mins, label }) => (
            <div key={ds} title={`${label}: ${fmtMins(mins)}`}
              style={{ height: 18, borderRadius: 3,
                background: mins > 0 ? `rgba(59,130,246,${Math.min(0.9, 0.2 + 0.7 * mins / maxMins)})` : 'var(--surface2)',
                cursor: mins > 0 ? 'help' : 'default' }} />
          ))}
        </div>
      </div>

      {/* Manual log + session list */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Today's sessions</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={manualMins} onChange={e => setManualMins(e.target.value)}
              placeholder="min" style={{ width: 56, fontSize: 12 }} min="1" max="480" />
            <button className="btn-ghost" style={{ fontSize: 12 }}
              onClick={() => { onManualLog(+manualMins); setManualMins('') }}>
              + Log
            </button>
          </div>
        </div>
        {todaySessions.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>
            No sessions yet today
          </div>
        )}
        {[...todaySessions].reverse().map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 0', borderBottom: '1px solid var(--surface2)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 40 }}>
              {fmtMins(s.minutes)}
            </span>
            {s.completed && <span style={{ fontSize: 10, color: '#22c55e' }}>✓ Pomo</span>}
            {s.manual && <span style={{ fontSize: 10, color: 'var(--text3)' }}>manual</span>}
            <div style={{ flex: 1 }} />
            <button onClick={() => onDeleteSession(s.id)}
              style={{ background: 'none', color: 'var(--text3)', fontSize: 14, padding: '0 4px',
                border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ weekStats, tasks, thisWeekStats, lastWeekStats, focusByDate }) {
  // Week-over-week comparison
  const tw = thisWeekStats.completed || 0
  const lw = lastWeekStats.completed || 0
  const pctChange = lw === 0 ? null : Math.round(((tw - lw) / lw) * 100)
  const maxScheduled = Math.max(...weekStats.map(w => w.scheduled), 1)
  const maxCompleted = Math.max(...weekStats.map(w => w.completed), 1)
  const maxBar = Math.max(maxScheduled, maxCompleted)

  // Focus data
  const totalFocusMins = Object.values(focusByDate).reduce((a,d) => a+d.minutes, 0)
  const focusDays = Object.keys(focusByDate).length

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Headline stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Tasks this week', value: thisWeekStats.scheduled || 0 },
          { label: 'Completed this week', value: tw, color: '#22c55e' },
          { label: 'Completion rate', value: thisWeekStats.scheduled ? `${Math.round(tw/(thisWeekStats.scheduled||1)*100)}%` : '—' },
          { label: 'vs last week', value: pctChange === null ? '—' : `${pctChange > 0 ? '+' : ''}${pctChange}%`,
            color: pctChange === null ? undefined : pctChange >= 0 ? '#22c55e' : '#ef4444',
            sub: pctChange !== null ? (pctChange >= 0 ? '↑ more work done' : '↓ less work done') : 'no prior data' },
          { label: 'Total focus time', value: fmtMins(totalFocusMins) },
          { label: 'Focus days', value: focusDays },
          { label: 'Avg focus/day', value: focusDays ? fmtMins(Math.round(totalFocusMins/focusDays)) : '—' },
          { label: 'All tasks', value: tasks.length },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--text)', lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: color || 'var(--text3)', marginTop: 4 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Week-by-week bar chart */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>
          Weekly tasks — scheduled vs completed
        </div>
        {weekStats.length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No task history yet
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...weekStats].reverse().map(w => (
            <div key={w.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', width: 68, flexShrink: 0, textAlign: 'right' }}>
                W{w.week} '{String(w.year).slice(2)}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ position: 'relative', height: 10, background: 'var(--surface2)', borderRadius: 5 }}>
                  <div style={{ height: '100%', borderRadius: 5, background: 'var(--surface3)',
                    width: `${(w.scheduled / maxBar) * 100}%` }} />
                </div>
                <div style={{ position: 'relative', height: 10, background: 'var(--surface2)', borderRadius: 5 }}>
                  <div style={{ height: '100%', borderRadius: 5, background: 'var(--accent)',
                    width: `${(w.completed / maxBar) * 100}%` }} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', width: 52, textAlign: 'right', flexShrink: 0 }}>
                {w.completed}/{w.scheduled}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
            <div style={{ width: 12, height: 6, borderRadius: 3, background: 'var(--surface3)' }} />
            Scheduled
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
            <div style={{ width: 12, height: 6, borderRadius: 3, background: 'var(--accent)' }} />
            Completed
          </div>
        </div>
      </div>

      {/* Recent completed tasks */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '20px 24px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
          Recently completed
        </div>
        {tasks.filter(t => t.completed_at).sort((a,b) => b.completed_at.localeCompare(a.completed_at)).slice(0,10).map(t => (
          <div key={t.id} style={{ display: 'flex', gap: 10, padding: '8px 0',
            borderBottom: '1px solid var(--surface2)', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#22c55e' }}>✓</span>
            <span style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>{t.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t.completed_at}</span>
          </div>
        ))}
        {tasks.filter(t => t.completed_at).length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>No completed tasks yet</div>
        )}
      </div>
    </div>
  )
}

// ── Tag Modal ─────────────────────────────────────────────────────────────────
function TagModal({ tags, setTags, onClose }) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  async function createTag() {
    if (!newName.trim()) return
    const data = await api('/api/tags', { method: 'POST', body: { name: newName.trim(), color: newColor } })
    if (data?.id) { setTags(t => [...t, data]); setNewName('') }
  }

  async function updateTag(id) {
    const data = await api(`/api/tags/${id}`, { method: 'PUT', body: { name: editName.trim(), color: editColor } })
    if (data?.id) { setTags(t => t.map(tg => tg.id === id ? data : tg)); setEditingId(null) }
  }

  async function deleteTag(id) {
    await api(`/api/tags/${id}`, { method: 'DELETE' })
    setTags(t => t.filter(tg => tg.id !== id))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 28, width: 380, maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Tag editor</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)',
            fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Create new tag */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tag name"
            style={{ flex: 1, fontSize: 13 }}
            onKeyDown={e => e.key === 'Enter' && createTag()} />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <button className="btn-primary" onClick={createTag} style={{ padding: '8px 14px', fontSize: 13 }}>
            Add
          </button>
        </div>

        {/* Existing tags */}
        {tags.length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            No tags yet — create one above
          </div>
        )}
        {tags.map(tg => (
          <div key={tg.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            {editingId === tg.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  style={{ flex: 1, fontSize: 13 }} onKeyDown={e => e.key === 'Enter' && updateTag(tg.id)} />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <button className="btn-primary" onClick={() => updateTag(tg.id)}
                  style={{ padding: '5px 10px', fontSize: 12 }}>Save</button>
                <button className="btn-ghost" onClick={() => setEditingId(null)}
                  style={{ padding: '5px 8px', fontSize: 12 }}>✕</button>
              </>
            ) : (
              <>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: tg.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: tg.color }}>{tg.name}</span>
                <button className="btn-ghost" onClick={() => { setEditingId(tg.id); setEditName(tg.name); setEditColor(tg.color) }}
                  style={{ padding: '4px 8px', fontSize: 12 }}>Edit</button>
                <button className="btn-ghost" onClick={() => deleteTag(tg.id)}
                  style={{ padding: '4px 8px', fontSize: 12, color: 'var(--red)' }}>✕</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Color Picker ──────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', width: 80 }}>
      {PRESET_COLORS.slice(0,5).map(c => (
        <button key={c} onClick={() => onChange(c)}
          style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: 'none',
            padding: 0, outline: value === c ? `2px solid #fff` : 'none', cursor: 'pointer' }} />
      ))}
      {PRESET_COLORS.slice(5).map(c => (
        <button key={c} onClick={() => onChange(c)}
          style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: 'none',
            padding: 0, outline: value === c ? `2px solid #fff` : 'none', cursor: 'pointer' }} />
      ))}
    </div>
  )
}
