import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import CategoryStacks from '../components/CategoryStacks'
import TaskDetail from '../components/TaskDetail'
import FocusTab from '../components/FocusTab'
import CalendarTab from '../components/CalendarTab'
import AnalyticsTab from '../components/AnalyticsTab'
import AddTaskSheet from '../components/AddTaskSheet'
import PixelIcon from '../components/PixelIcon'
import TagModal from '../components/TagModal'
import AccountModal from '../components/AccountModal'
import { useTheme, setTheme } from '../lib/theme'
import { PixelTomato } from '../components/PixelTimer'
import { useTimer } from '../lib/useTimer'
import { useReminders } from '../lib/useReminders'
import { api, todayStr, statusOf, urgencyInfo, PRIORITY_SORT } from '../lib/util'

// Categories shown first, in this order (from the sketch); any other tag gets its own stack after them.
const CATEGORY_ORDER = ['Study', 'Work', 'Health']
const categoryOf = t => CATEGORY_ORDER.find(c => (t.tags || []).includes(c)) || (t.tags || [])[0] || 'Unsorted'
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

export default function Dashboard() {
  const router = useRouter()
  const theme = useTheme()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [tags, setTags] = useState([])
  const [sessions, setSessions] = useState([])
  const [activity, setActivity] = useState({})
  const [tab, setTab] = useState('tasks')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('due')
  const [detailId, setDetailId] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [doneOpen, setDoneOpen] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [focusTaskId, setFocusTaskId] = useState(null)
  const [today, setToday] = useState(todayStr())
  const [adding, setAdding] = useState(false)
  const pending = useRef({})

  // ── Boot ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    api('/api/auth/me').then(data => {
      const u = data?.user || data
      if (u?.id) { setUser(u); loadData() } else router.replace('/login')
    }).catch(() => router.replace('/login')).finally(() => setAuthLoading(false))
  }, []) // eslint-disable-line

  async function loadData() {
    const [t, tg, f, a] = await Promise.all([api('/api/tasks'), api('/api/tags'), api('/api/focus'), api('/api/activity')])
    if (Array.isArray(t)) setTasks(t)
    if (Array.isArray(tg)) setTags(tg)
    if (Array.isArray(f)) setSessions(f)
    if (Array.isArray(a)) setActivity(Object.fromEntries(a.map(r => [r.date, r.count])))
  }

  // Date rollover
  useEffect(() => {
    const check = () => { const d = todayStr(); if (d !== today) { setToday(d); loadData() } }
    const id = setInterval(check, 60000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [today])

  useReminders(tasks)

  // N opens the new-task sheet (when not typing somewhere)
  useEffect(() => {
    const onKey = e => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
      if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return
      e.preventDefault(); setAdding(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Activity ─────────────────────────────────────────────────────────────────
  function recordActivity() {
    const d = todayStr()
    setActivity(a => ({ ...a, [d]: (a[d] || 0) + 1 }))
    api('/api/activity', { method: 'POST', body: { date: d } })
  }

  // ── Tasks ────────────────────────────────────────────────────────────────────
  // Optimistic local update + debounced PATCH (patches for one task are merged)
  function updateTask(id, patch, delay = 250) {
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)))
    const p = (pending.current[id] ||= { patch: {}, timer: null })
    Object.assign(p.patch, patch)
    clearTimeout(p.timer)
    p.timer = setTimeout(async () => {
      const body = p.patch; delete pending.current[id]
      const data = await api(`/api/tasks/${id}`, { method: 'PATCH', body })
      if (data?.id) setTasks(ts => ts.map(t => (t.id === id ? { ...t, completed_at: data.completed_at } : t)))
    }, delay)
  }

  function setProgress(id, v) {
    const t = tasks.find(x => x.id === id); if (!t) return
    const td = todayStr()
    const history = [...(t.history || []).filter(h => h.date !== td), { date: td, progress: v }].slice(-14)
    updateTask(id, { progress: v, history })
    recordActivity()
  }

  async function addTask(q) {
    const name = q.name.trim(); if (!name) return
    const data = await api('/api/tasks', { method: 'POST', body: { name, due: q.due || null, due_time: q.time || null, tags: q.tag ? [q.tag] : [] } })
    if (data?.id) { setTasks(ts => [data, ...ts]); recordActivity() }
  }

  async function deleteTask(id) {
    setTasks(ts => ts.filter(t => t.id !== id))
    await api(`/api/tasks/${id}`, { method: 'DELETE' })
  }

  // ── Focus ────────────────────────────────────────────────────────────────────
  async function recordFocus(mins, completed, manual = false) {
    const task = focusTaskId ? tasks.find(t => t.id === focusTaskId) : null
    const body = { date: todayStr(), minutes: mins, completed, manual, task_name: task ? task.name : null,
      time_of_day: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
    const data = await api('/api/focus', { method: 'POST', body })
    if (data?.id) { setSessions(ss => [data, ...ss]); recordActivity() }
  }
  const timer = useTimer((m, c) => recordFocus(m, c))
  const manualLog = mins => { if (mins >= 1) recordFocus(mins, false, true) }
  async function deleteSession(id) {
    setSessions(ss => ss.filter(s => s.id !== id))
    await api('/api/focus', { method: 'DELETE', body: { id } })
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), tasks, tags, focus_sessions: sessions, activity }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `daily-brief-${todayStr()}.json`; a.click()
    URL.revokeObjectURL(a.href)
  }

  if (authLoading) return <div className="center-screen">Loading…</div>

  // ── Derived ──────────────────────────────────────────────────────────────────
  const live = tasks.filter(t => t.progress < 100)
  const nProg = live.filter(t => t.progress > 0).length
  const nDueToday = live.filter(t => t.due === today).length
  const nOverdue = live.filter(t => { const u = urgencyInfo(t.due); return u && u.diff < 0 }).length
  const overall = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0
  const todayMins = sessions.filter(s => s.date === today).reduce((a, s) => a + s.minutes, 0)

  const filtered = tasks.filter(t => {
    if (filter === 'todo') return statusOf(t) === 'todo'
    if (filter === 'inprog') return statusOf(t) === 'inprog'
    if (filter === 'overdue') { const u = urgencyInfo(t.due); return u && u.diff < 0 && t.progress < 100 }
    if (filter === 'today') return t.due === today && t.progress < 100
    return true
  })
  const sortFn = (a, b) => {
    if (sort === 'due') { if (!a.due && !b.due) return 0; if (!a.due) return 1; if (!b.due) return -1; return a.due < b.due ? -1 : a.due > b.due ? 1 : 0 }
    if (sort === 'priority') return PRIORITY_SORT[a.priority || 'null'] - PRIORITY_SORT[b.priority || 'null']
    if (sort === 'progress') return b.progress - a.progress
    return (b.created_at || '').localeCompare(a.created_at || '')
  }
  const active = filtered.filter(t => t.progress < 100).sort(sortFn)
  const done = tasks.filter(t => t.progress === 100).sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))

  // group into category stacks
  const byCat = {}
  active.forEach(t => (byCat[categoryOf(t)] ||= []).push(t))
  const catNames = [...CATEGORY_ORDER, ...tags.map(g => g.name).filter(n => !CATEGORY_ORDER.includes(n)), 'Unsorted']
  const groups = catNames.filter(n => byCat[n]).map(n => ({ name: n, color: (tags.find(g => g.name === n) || {}).color || 'var(--m-soft)', tasks: byCat[n] }))
  const toggleExpand = name => setExpanded(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n })
  const detailTask = detailId && tasks.find(t => t.id === detailId)

  const h = new Date().getHours()
  // greet by the part before any '@' so an email-style username still reads like a name
  const handle = (user?.username || '').split('@')[0]
  const name = handle ? handle[0].toUpperCase() + handle.slice(1) : ''
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

  const FILTERS = [['all', 'All', live.length], ['today', 'Due today', nDueToday], ['overdue', 'Overdue', nOverdue], ['inprog', 'In progress', nProg], ['todo', 'Not started', live.length - nProg]]
  const attention = nOverdue + nDueToday
  const HOTBAR = [
    ['tasks', 'Tasks', <PixelIcon name="quest" />, attention],
    ['focus', 'Focus', <PixelTomato animate={timer.running} />],
    ['calendar', 'Calendar', <PixelIcon name="calendar" />],
    ['analytics', 'Stats', <PixelIcon name="stats" />],
  ]

  return (
    <div className="shell">
      <section className="hello">
        <div className="dateline">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <h1>{h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}{name && `, ${name}`}</h1>
        <p className="summary">
          {nDueToday ? <><b>{plural(nDueToday, 'task')}</b> due today</> : 'Nothing due today'}
          {nOverdue > 0 && <>, <b className="warn">{nOverdue} overdue</b></>}.{' '}
          <b>{nProg}</b> in progress, <b>{todayMins} min</b> focused, <b>{overall}%</b> through the list.
        </p>
      </section>

      <main className="board">
        {tab === 'tasks' && (
          <>
            <div className="board-head">
              <h2 className="board-title">Tasks</h2>
              <div className="chips">
                <label className="chip">
                  <span className="sr-only">Show</span>
                  <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter tasks">
                    {FILTERS.map(([v, l, n]) => <option key={v} value={v}>{l} ({n})</option>)}
                  </select>
                </label>
                <label className="chip">
                  <span className="chip-k">Sort</span>
                  <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort tasks">
                    <option value="due">Due date</option><option value="priority">Priority</option>
                    <option value="progress">Progress</option><option value="created">Newest</option>
                  </select>
                </label>
              </div>
            </div>

            {!groups.length && (
              <p className="empty">{filter === 'all' ? <>No open tasks. Press <kbd>N</kbd> or the <b>+</b> below to add one.</> : 'Nothing matches this filter.'}</p>
            )}
            <CategoryStacks groups={groups} expanded={expanded} onToggleExpand={toggleExpand} onOpen={setDetailId} onProgress={setProgress} />

            {done.length > 0 && (
              <section className="done-section">
                <button className="done-toggle" aria-expanded={doneOpen} onClick={() => setDoneOpen(!doneOpen)}>
                  {doneOpen ? '▾' : '▸'} Done <span className="filter-n">{done.length}</span>
                </button>
                {doneOpen && (
                  <ul className="done-list">
                    {done.map(t => (
                      <li key={t.id}>
                        <button className="card-check done" aria-label="Mark incomplete" onClick={() => setProgress(t.id, 0)} />
                        <button className="done-name" onClick={() => setDetailId(t.id)}>{t.name}</button>
                        <span className="done-when">{t.completed_at}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}

        {tab !== 'tasks' && (
          <section className={`tabview tab-${tab}`} aria-label={tab === 'analytics' ? 'Stats' : tab[0].toUpperCase() + tab.slice(1)}>
            {tab === 'focus' && (
              <FocusTab timer={timer} tasks={tasks} sessions={sessions} focusTaskId={focusTaskId} setFocusTaskId={setFocusTaskId}
                onDeleteSession={deleteSession} onManualLog={manualLog} />
            )}
            {tab === 'calendar' && <CalendarTab tasks={tasks} tags={tags} />}
            {tab === 'analytics' && <AnalyticsTab tasks={tasks} sessions={sessions} activity={activity} />}
          </section>
        )}
      </main>

      {/* the hotbar: every control, always in the same place */}
      <nav className="hotbar" aria-label="Main">
        <button className="hb-add" onClick={() => setAdding(true)} aria-label="Add task (N)" title="Add task (N)">
          <PixelIcon name="plus" size={20} />
        </button>
        <div className="hb-group" role="tablist">
          {HOTBAR.map(([k, l, icon, badge]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`hb-btn${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
              <span className="hb-icon">{icon}{badge > 0 && <span className="hb-badge" aria-label={`${badge} need attention`}>{badge}</span>}</span>
              <span className="hb-label">{k === 'focus' && timer.running && tab !== 'focus' ? mmss(timer.secs) : l}</span>
            </button>
          ))}
        </div>
        <div className="hb-group hb-small">
          <button className="hb-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'day' : 'night'}`} title={theme === 'dark' ? 'Day' : 'Night'}>
            <span className="hb-icon"><PixelIcon name={theme === 'dark' ? 'sun' : 'moon'} /></span><span className="hb-label">{theme === 'dark' ? 'Day' : 'Night'}</span>
          </button>
          <button className="hb-btn" onClick={() => setShowTags(true)} title="Tags"><span className="hb-icon"><PixelIcon name="tag" /></span><span className="hb-label">Tags</span></button>
          <button className="hb-btn" onClick={() => setShowAccount(true)} title="Account"><span className="hb-icon"><PixelIcon name="person" /></span><span className="hb-label">Me</span></button>
        </div>
      </nav>

      {adding && <AddTaskSheet tags={tags} onAdd={addTask} onClose={() => setAdding(false)} />}
      {detailTask && <TaskDetail key={detailTask.id} task={detailTask} tags={tags} onClose={() => setDetailId(null)}
        onProgress={setProgress} onUpdate={updateTask} onDelete={deleteTask} />}
      {showAccount && <AccountModal user={user} onSaved={u => setUser(x => ({ ...x, ...u }))} onClose={() => setShowAccount(false)}
        onExport={exportData} onSignOut={logout} />}
      {showTags && <TagModal tags={tags} setTags={setTags} onClose={() => setShowTags(false)} />}
    </div>
  )
}
