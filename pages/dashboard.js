import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
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
import PetPanel, { PetPortrait } from '../components/PetCard'
import { FocusHud } from '../components/Hud'
import { computePet, setPetState, petReact, MOODS } from '../lib/pet'
import { useTheme, setTheme } from '../lib/theme'
import { setScenePan } from '../components/SceneBackdrop'
import { useTimer } from '../lib/useTimer'
import { useReminders } from '../lib/useReminders'
import { api, todayStr, statusOf, urgencyInfo, PRIORITY_SORT } from '../lib/util'

// categoryOf: first tag wins; falls back to 'Unsorted'
const categoryOf = t => (t.tags || [])[0] || 'Unsorted'
const PAGES = ['tasks', 'focus', 'calendar', 'analytics']
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

// phone layout = the swipeable pager (kept in step with the CSS breakpoint)
const PHONE_Q = '(max-width: 699px)'
function useMedia(q) {
  return useSyncExternalStore(cb => { const m = window.matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(q).matches, () => false)
}
const usePhone = () => useMedia(PHONE_Q)
// wide screens: the layout sits around the scene's landmarks instead of a centred column
const useWide = () => useMedia('(min-width: 1100px)')

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
  const [showPet, setShowPet] = useState(false)     // false | true | 'hatched'
  const [petPreview, setPetPreview] = useState(null)
  const [petData, setPetData] = useState(null)    // /api/pet: name, skin, owned, balances, all-time totals
  const pending = useRef({})
  const pager = useRef(null)
  const deleted = useRef(new Set())
  const [toast, setToast] = useState(null)
  const alertBar = text => { setToast(text); setTimeout(() => setToast(null), 4000) }
  const phone = usePhone()
  const wide = useWide()

  // ── Boot ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    api('/api/auth/me').then(data => {
      const u = data?.user || data
      if (u?.id) { setUser(u); loadData() } else router.replace('/login')
    }).catch(() => router.replace('/login')).finally(() => setAuthLoading(false))
  }, []) // eslint-disable-line

  async function loadData() {
    refreshPet()
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

  // ── Phone pager: the scroll position drives the scene and the hotbar ───────────
  useEffect(() => {
    if (!phone) { setScenePan(null); return }
    const el = pager.current
    if (el) el.scrollLeft = PAGES.indexOf(tab) * el.clientWidth
    setScenePan(PAGES.indexOf(tab))
    const keep = () => { const el = pager.current; if (el) { el.scrollLeft = PAGES.indexOf(tabRef.current) * el.clientWidth; setScenePan(PAGES.indexOf(tabRef.current)) } }
    window.addEventListener('resize', keep)
    return () => { window.removeEventListener('resize', keep); setScenePan(null) }
  }, [phone, authLoading]) // eslint-disable-line
  const tabRef = useRef(tab)
  tabRef.current = tab
  function onPagerScroll(e) {
    const el = e.currentTarget, p = el.scrollLeft / el.clientWidth
    setScenePan(p)
    const k = PAGES[Math.round(p)]
    if (k && k !== tabRef.current) { tabRef.current = k; setTab(k) }
  }
  function goTab(k) {
    if (!phone || !pager.current) return setTab(k)
    const el = pager.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: PAGES.indexOf(k) * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  // ── The pet: grows with focus time, mood from the last 3 days ─────────────────
  const pet = computePet({ sessions, tasks, totals: petData }, petPreview)
  const petName = petData?.name || ''
  const skin = petData?.skin || 'bluebird'
  async function refreshPet() {
    const d = await api('/api/pet').catch(() => null)
    if (d && !d.error) {
      setPetData(d)
      // carry over a name given before the pets table existed
      try { const old = localStorage.getItem('db-pet-name'); if (old && !d.name) { namePet(old) } localStorage.removeItem('db-pet-name') } catch {}
    }
  }
  const petTimer = useRef(null)
  const refreshPetSoon = () => { clearTimeout(petTimer.current); petTimer.current = setTimeout(refreshPet, 1200) }
  useEffect(() => { setPetState({ stage: pet.stage.key, mood: pet.mood, skin }) }, [pet.stage.key, pet.mood, skin])
  useEffect(() => {
    if (authLoading || !tasks.length || pet.real < 2) return
    try { if (!localStorage.getItem('db-pet-hatched')) { localStorage.setItem('db-pet-hatched', '1'); setShowPet('hatched') } } catch {}
  }, [pet.real, authLoading, tasks.length])
  async function namePet(n) {
    setPetData(d => d && { ...d, name: n })
    const d = await api('/api/pet', { method: 'PATCH', body: { name: n } })
    if (d && !d.error) setPetData(d)
  }
  async function buySkin(id) {
    const d = await api('/api/pet', { method: 'POST', body: { buy: id } })
    if (d && !d.error) { setPetData(d); petReact('focus') }
    return d
  }
  async function wearSkin(id) {
    setPetData(d => d && { ...d, skin: id })
    const d = await api('/api/pet', { method: 'PATCH', body: { skin: id } })
    if (d && !d.error) setPetData(d)
    return d
  }

  // ── Activity ─────────────────────────────────────────────────────────────────
  function recordActivity() {
    const d = todayStr()
    setActivity(a => ({ ...a, [d]: (a[d] || 0) + 1 }))
    api('/api/activity', { method: 'POST', body: { date: d } })
  }

  // ── Tasks ────────────────────────────────────────────────────────────────────
  // Optimistic local update + debounced PATCH (patches for one task are merged)
  function updateTask(id, patch, delay = 250) {
    if (deleted.current.has(id)) return
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
    if (v === 100 && t.progress < 100) petReact('task')
    if ((v === 100) !== (t.progress === 100)) refreshPetSoon()
  }

  async function addTask(q) {
    const name = q.name.trim(); if (!name) return
    const data = await api('/api/tasks', { method: 'POST', body: { name, due: q.due || null, due_time: q.time || null, tags: q.tag ? [q.tag] : [] } })
    if (data?.id) { setTasks(ts => [data, ...ts]); recordActivity() }
  }

  async function deleteTask(id) {
    // drop any edit still waiting to be saved, so it can't land after the delete
    const p = pending.current[id]; if (p) { clearTimeout(p.timer); delete pending.current[id] }
    const gone = tasks.find(t => t.id === id)
    deleted.current.add(id)
    setTasks(ts => ts.filter(t => t.id !== id))
    const r = await api(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => ({ error: 'offline' }))
    if (r?.error && gone) { deleted.current.delete(id); setTasks(ts => [gone, ...ts]); alertBar('Could not delete that task. Try again.') }
    else refreshPetSoon()
  }

  // ── Focus ────────────────────────────────────────────────────────────────────
  async function recordFocus(mins, completed, manual = false) {
    const task = focusTaskId ? tasks.find(t => t.id === focusTaskId) : null
    const body = { date: todayStr(), minutes: mins, completed, manual, task_name: task ? task.name : null,
      time_of_day: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
    const data = await api('/api/focus', { method: 'POST', body })
    if (data?.id) { setSessions(ss => [data, ...ss]); recordActivity() }
    if (completed) petReact('focus')
    refreshPetSoon()
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

  // group into category stacks — ordered by the tag list (user's own order), then Unsorted
  const byCat = {}
  active.forEach(t => (byCat[categoryOf(t)] ||= []).push(t))
  const tagOrder = tags.map(g => g.name)
  const catNames = [...tagOrder, ...Object.keys(byCat).filter(n => !tagOrder.includes(n))]
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
    ['focus', 'Focus', <PetPortrait stage={pet.stage.key} mood="content" skin={skin} scale={2} pose={timer.running ? 'Flap' : ''} className="hb-pet-mini" />],
    ['calendar', 'Calendar', <PixelIcon name="calendar" />],
    ['analytics', 'Stats', <PixelIcon name="stats" />],
  ]

  const hello = (
    <section className="hello">
      <div className="dateline">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <h1>{h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}{name && `, ${name}`}</h1>
      <p className="summary">
        {nDueToday ? <><b>{plural(nDueToday, 'task')}</b> due today</> : 'Nothing due today'}
        {nOverdue > 0 && <>, <b className="warn">{nOverdue} overdue</b></>}.{' '}
        <b>{nProg}</b> in progress, <b>{todayMins} min</b> focused, <b>{overall}%</b> through the list.
      </p>
    </section>
  )

  // wide: the first category gets the strip between the egg house and the falls, the rest go right of the falls
  const nLeft = groups.length > 1 ? Math.max(1, Math.round(groups.length / 3)) : 0
  const stacks = gs => <CategoryStacks groups={gs} expanded={expanded} onToggleExpand={toggleExpand} onOpen={setDetailId} onProgress={setProgress} />
  const doneBlock = done.length > 0 && (
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
  )
  const boardHead = (
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
  )
  const emptyNote = !groups.length && (
    <p className="empty">{filter === 'all' ? <>No open tasks. Press <kbd>N</kbd> or the <b>+</b> below to add one.</> : 'Nothing matches this filter.'}</p>
  )
  const tasksView = wide && !phone ? (
    <>
      <div className="zone-l">{stacks(groups.slice(0, nLeft))}{doneBlock}</div>
      <div className="zone-r">{boardHead}{emptyNote}{stacks(groups.slice(nLeft))}</div>
    </>
  ) : (
    <>
      {boardHead}
      {emptyNote}
      {stacks(groups)}
      {doneBlock}
    </>
  )
  const TITLES = { focus: 'Focus', calendar: 'Calendar', analytics: 'Stats' }
  const view = k => k === 'tasks' ? tasksView : (
    <section className={`tabview tab-${k}`} aria-label={TITLES[k]}>
      {phone && k !== 'calendar' && <h2 className="board-title page-title">{TITLES[k]}</h2>}
      {k === 'focus' && (
        <FocusTab timer={timer} tasks={tasks} sessions={sessions} focusTaskId={focusTaskId} setFocusTaskId={setFocusTaskId}
          onDeleteSession={deleteSession} onManualLog={manualLog} petStage={pet.stage.key} skin={skin} />
      )}
      {k === 'calendar' && <CalendarTab tasks={tasks} tags={tags} />}
      {k === 'analytics' && <AnalyticsTab tasks={tasks} sessions={sessions} activity={activity} />}
    </section>
  )

  return (
    <div className={`shell${phone ? ' paged' : wide ? ' zoned' : ''}`}>
      {phone ? (
        // phones: the four pages sit side by side; swipe (or tap the hotbar) and the scene walks with you
        <div className="pager" ref={pager} onScroll={onPagerScroll}>
          {PAGES.map(k => (
            <div className="page" key={k} data-page={k} aria-hidden={tab !== k} inert={tab !== k ? '' : undefined}>
              {k === 'tasks' && hello}
              <main className="board">{view(k)}</main>
            </div>
          ))}
        </div>
      ) : (
        <>
          {hello}
          {wide && <button type="button" className={`pet-spot stage-${pet.stage.key}`} onClick={() => setShowPet(true)}
            aria-label={`${(pet.idx >= 2 && petName) || pet.stage.name}: open the pet panel`} title={(pet.idx >= 2 && petName) || pet.stage.name} />}
          {wide && tab !== 'focus' && <FocusHud timer={timer} todayMins={todayMins} onOpen={() => setTab('focus')} />}
          <main className="board">{view(tab)}</main>
        </>
      )}

      {/* the hotbar: every control, always in the same place */}
      <nav className="hotbar" aria-label="Main">
        <button className={`hb-pet mood-${pet.mood}`} onClick={() => setShowPet(true)}
          aria-label={`${(pet.idx >= 2 && petName) || pet.stage.name}, ${MOODS[pet.mood].name.toLowerCase()}`} title={`${(pet.idx >= 2 && petName) || pet.stage.name} · ${MOODS[pet.mood].name}`}>
          <PetPortrait stage={pet.stage.key} mood={pet.mood} scale={2} skin={skin} />
          <span className="hb-mood" aria-hidden="true">{[0, 1, 2].map(i => <i key={i} className={i < { happy: 3, content: 2, sleepy: 1 }[pet.mood] ? 'on' : ''} />)}</span>
        </button>
        <button className="hb-add" onClick={() => setAdding(true)} aria-label="Add task (N)" title="Add task (N)">
          <PixelIcon name="plus" size={20} />
        </button>
        <div className="hb-group" role="tablist">
          {HOTBAR.map(([k, l, icon, badge]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`hb-btn${tab === k ? ' on' : ''}`} onClick={() => goTab(k)}>
              <span className="hb-icon">{icon}{badge > 0 && <span className="hb-badge" aria-label={`${badge} need attention`}>{badge}</span>}</span>
              <span className="hb-label">{k === 'focus' && timer.running && tab !== 'focus' ? mmss(timer.secs) : l}</span>
            </button>
          ))}
        </div>
        <div className="hb-group hb-small">
          <button className="hb-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'day' : 'night'}`} title={theme === 'dark' ? 'Day' : 'Night'}>
            <span className="hb-icon"><PixelIcon name={theme === 'dark' ? 'sun' : 'moon'} /></span><span className="hb-label">{theme === 'dark' ? 'Day' : 'Night'}</span>
          </button>
          <button className="hb-btn" onClick={() => setShowPet('shop')} title="Shop"><span className="hb-icon"><PixelIcon name="bag" /></span><span className="hb-label">Shop</span></button>
          <button className="hb-btn" onClick={() => setShowTags(true)} title="Tags"><span className="hb-icon"><PixelIcon name="tag" /></span><span className="hb-label">Tags</span></button>
          <button className="hb-btn" onClick={() => setShowAccount(true)} title="Account"><span className="hb-icon"><PixelIcon name="person" /></span><span className="hb-label">Me</span></button>
        </div>
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
      {adding && <AddTaskSheet tags={tags} onAdd={addTask} onClose={() => setAdding(false)} />}
      {detailTask && <TaskDetail key={detailTask.id} task={detailTask} tags={tags} onClose={() => setDetailId(null)}
        onProgress={setProgress} onUpdate={updateTask} onDelete={deleteTask} />}
      {showAccount && <AccountModal user={user} onSaved={u => setUser(x => ({ ...x, ...u }))} onClose={() => setShowAccount(false)}
        onExport={exportData} onSignOut={logout} />}
      {showPet && <PetPanel pet={pet} petData={petData} name={petName} skin={skin} onName={namePet} onBuy={buySkin} onWear={wearSkin}
        hatched={showPet === 'hatched'} initialTab={showPet === 'shop' ? 'shop' : 'bird'} preview={petPreview} onPreview={setPetPreview} onClose={() => setShowPet(false)} />}
      {showTags && <TagModal tags={tags} setTags={updater => {
        // Intercept tag updates: when a tag is renamed, also update task tag name strings
        setTags(prev => {
          const next = typeof updater === 'function' ? updater(prev) : updater
          const renamed = {}
          prev.forEach(old => {
            const updated = next.find(n => n.id === old.id)
            if (updated && updated.name !== old.name) renamed[old.name] = updated.name
          })
          if (Object.keys(renamed).length > 0) {
            setTasks(ts => ts.map(t => ({ ...t, tags: (t.tags || []).map(tag => renamed[tag] ?? tag) })))
          }
          return next
        })
      }} onClose={() => setShowTags(false)} />}
    </div>
  )
}
