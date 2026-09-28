import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import TaskCard from '../components/TaskCard'
import FocusTab from '../components/FocusTab'
import CalendarTab from '../components/CalendarTab'
import AnalyticsTab from '../components/AnalyticsTab'
import Sidebar from '../components/Sidebar'
import TagModal from '../components/TagModal'
import ThemeToggle from '../components/ThemeToggle'
import { useTimer } from '../lib/useTimer'
import { useReminders } from '../lib/useReminders'
import { api, todayStr, dateStr, statusOf, urgencyInfo, PRIORITY_CYCLE, PRIORITY_SORT } from '../lib/util'

const TABS = [['tasks', 'Tasks'], ['focus', '🍅 Focus'], ['calendar', 'Calendar'], ['analytics', 'Analytics']]

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [tags, setTags] = useState([])
  const [sessions, setSessions] = useState([])
  const [activity, setActivity] = useState({})
  const [tab, setTab] = useState('tasks')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('due')
  const [openIds, setOpenIds] = useState(new Set())
  const [doneOpen, setDoneOpen] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [focusTaskId, setFocusTaskId] = useState(null)
  const [today, setToday] = useState(todayStr())
  const [nq, setNq] = useState({ name: '', due: todayStr(), time: '', tag: '' })
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
    const check = () => { const d = todayStr(); if (d !== today) { setToday(d); setNq(q => ({ ...q, due: d })); loadData() } }
    const id = setInterval(check, 60000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [today])

  useReminders(tasks)

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

  function cyclePriority(id) {
    const t = tasks.find(x => x.id === id); if (!t) return
    updateTask(id, { priority: PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(t.priority || null) + 1) % PRIORITY_CYCLE.length] })
  }

  async function addTask() {
    const name = nq.name.trim(); if (!name) return
    const data = await api('/api/tasks', { method: 'POST', body: { name, due: nq.due || null, due_time: nq.time || null, tags: nq.tag ? [nq.tag] : [] } })
    if (data?.id) { setTasks(ts => [data, ...ts]); recordActivity() }
    setNq({ name: '', due: todayStr(), time: '', tag: '' })
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
  const total = tasks.length
  const nDone = tasks.filter(t => t.progress === 100).length
  const nProg = tasks.filter(t => t.progress > 0 && t.progress < 100).length
  const nTodo = tasks.filter(t => t.progress === 0).length
  const todayMins = sessions.filter(s => s.date === today).reduce((a, s) => a + s.minutes, 0)

  const filtered = tasks.filter(t => {
    if (filter === 'all') return true
    if (filter === 'todo') return statusOf(t) === 'todo'
    if (filter === 'inprog') return statusOf(t) === 'inprog'
    if (filter === 'overdue') { const u = urgencyInfo(t.due); return u && u.diff < 0 && t.progress < 100 }
    if (filter === 'today') return t.due === today && t.progress < 100
    if (filter.startsWith('tag:')) return (t.tags || []).includes(filter.slice(4))
    return true
  })
  const sortFn = (a, b) => {
    if (sort === 'due') { if (!a.due && !b.due) return 0; if (!a.due) return 1; if (!b.due) return -1; return a.due < b.due ? -1 : a.due > b.due ? 1 : 0 }
    if (sort === 'priority') return PRIORITY_SORT[a.priority || 'null'] - PRIORITY_SORT[b.priority || 'null']
    if (sort === 'progress') return a.progress - b.progress
    return (b.created_at || '').localeCompare(a.created_at || '')
  }
  const active = filtered.filter(t => t.progress < 100).sort(sortFn)
  const done = filtered.filter(t => t.progress === 100).sort(sortFn)
  const inprog = active.filter(t => t.progress > 0), todo = active.filter(t => t.progress === 0)

  const toggleOpen = id => setOpenIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const card = t => (
    <TaskCard key={t.id} task={t} tags={tags} open={openIds.has(t.id)} onToggle={() => toggleOpen(t.id)}
      onProgress={setProgress} onUpdate={updateTask} onDelete={deleteTask} onCyclePriority={cyclePriority} />
  )
  const group = (label, color, n, extra) => (
    <div className="card-group-header" onClick={extra?.onClick} style={extra?.style}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', background: color }} />
      {label}<span className="group-count">{n}</span>
      {extra?.toggle && <span className="group-toggle">{extra.toggle}</span>}
    </div>
  )

  const pills = [{ v: 'all', l: 'All' }, { v: 'todo', l: 'To Do' }, { v: 'inprog', l: 'In Progress' }, { v: 'overdue', l: 'Overdue' }, { v: 'today', l: 'Due Today' },
    ...tags.map(t => ({ v: 'tag:' + t.name, l: t.name, color: t.color }))]
  const pillStyle = (o, a) => o.color
    ? (a ? { background: o.color, borderColor: o.color, color: '#fff' } : { borderColor: o.color + '40', color: o.color })
    : o.v === 'overdue' ? (a ? { background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' } : { borderColor: 'var(--red)', color: 'var(--red)' })
    : o.v === 'today' ? (a ? { background: 'var(--amber)', borderColor: 'var(--amber)', color: '#fff' } : { borderColor: 'var(--amber)', color: 'var(--amber)' }) : undefined

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div className="top-bar">
        <div>
          <h1>Daily Brief</h1>
          <div className="sub">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div className="top-actions">
          <span className="user-chip">@{user?.username}</span>
          <ThemeToggle />
          <button className="btn ghost sm" onClick={() => setShowTags(true)}>🏷 Tags</button>
          <button className="btn ghost sm" onClick={exportData}>Export</button>
          <button className="btn ghost sm" onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="stats">
        {[[total, 'Total', 'n-all'], [nDone, 'Done', 'n-done'], [nProg, 'In Progress', 'n-prog'], [nTodo, 'To Do', 'n-todo'], [todayMins + 'm', 'Focus Today', 'n-focus']].map(([n, l, c]) => (
          <div className="stat" key={l}><div className={`n ${c}`}>{n}</div><div className="l">{l}</div></div>
        ))}
      </div>

      <div className="page">
        <div>
          <div className="panel">
            <div className="tabs">
              {TABS.map(([k, l]) => <div key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</div>)}
            </div>

            {tab === 'tasks' && (
              <div>
                <div className="quick-add">
                  <span className="quick-add-icon">+</span>
                  <input className="quick-add-input" placeholder="Add a task — press Enter" value={nq.name}
                    onChange={e => setNq({ ...nq, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && addTask()} />
                  <input type="date" className="quick-add-due" title="Due date" value={nq.due} onChange={e => setNq({ ...nq, due: e.target.value })} />
                  <input type="time" className="quick-add-time" title="Due time" value={nq.time} onChange={e => setNq({ ...nq, time: e.target.value })} />
                  <select className="quick-add-tag" value={nq.tag} onChange={e => setNq({ ...nq, tag: e.target.value })}>
                    <option value="">Tag</option>
                    {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                  <button className="quick-add-submit" onClick={addTask}>Add ↵</button>
                </div>
                <div className="task-toolbar">
                  <div className="filter-pills">
                    {pills.map(o => <button key={o.v} className={`pill${filter === o.v ? ' active' : ''}`} style={pillStyle(o, filter === o.v)} onClick={() => setFilter(o.v)}>{o.l}</button>)}
                  </div>
                  <select value={sort} onChange={e => setSort(e.target.value)} style={{ background: 'transparent', border: '1px solid var(--b2)', borderRadius: 20, color: 'var(--sub)', fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 10px', cursor: 'pointer', outline: 'none', width: 'auto' }}>
                    <option value="due">Sort: Due</option><option value="created">Sort: Created</option>
                    <option value="priority">Sort: Priority</option><option value="progress">Sort: Progress</option>
                  </select>
                </div>

                {!filtered.length && <div className="empty">No tasks here — add one above</div>}
                {filter === 'all' ? (
                  <>
                    {inprog.length > 0 && <>{group('In Progress', 'var(--amber)', inprog.length)}{inprog.map(card)}</>}
                    {todo.length > 0 && <>{group('To Do', 'var(--dim)', todo.length, { style: { marginTop: inprog.length ? 4 : 0 } })}{todo.map(card)}</>}
                  </>
                ) : active.map(card)}
                {done.length > 0 && (
                  <>
                    {group('Done', 'var(--green)', done.length, { onClick: () => setDoneOpen(!doneOpen), toggle: doneOpen ? '▾' : '▸', style: { marginTop: 8 } })}
                    {doneOpen && done.map(card)}
                  </>
                )}
              </div>
            )}

            {tab === 'focus' && (
              <FocusTab timer={timer} tasks={tasks} sessions={sessions} focusTaskId={focusTaskId} setFocusTaskId={setFocusTaskId}
                onDeleteSession={deleteSession} onManualLog={manualLog} />
            )}
            {tab === 'calendar' && <CalendarTab tasks={tasks} tags={tags} />}
            {tab === 'analytics' && <AnalyticsTab tasks={tasks} sessions={sessions} />}
          </div>
        </div>
        <Sidebar tasks={tasks} sessions={sessions} activity={activity} />
      </div>

      {showTags && <TagModal tags={tags} setTags={setTags} onClose={() => setShowTags(false)} />}
    </div>
  )
}
