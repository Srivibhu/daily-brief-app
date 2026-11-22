import { useState } from 'react'
import { WeekBars } from './charts'
import PetTimer from './PetTimer'
import { todayStr, dateStr } from '../lib/util'

const LABEL = { focus: 'Focus', short: 'Short Break', long: 'Long Break' }
const GOAL = 100

export function weekData(sessions) {
  const labels = [], data = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const k = dateStr(d)
    labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }))
    data.push(sessions.filter(s => s.date === k).reduce((a, s) => a + s.minutes, 0))
  }
  return { labels, data }
}

// Inline minute editor shown when a mode button is long-pressed / double-clicked
function ModeBtn({ m, timer }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const active = timer.mode === m
  const mins = timer.durations[m]

  function startEdit(e) {
    e.stopPropagation()
    if (timer.running) return
    setDraft(String(mins))
    setEditing(true)
  }

  function commit() {
    const v = parseInt(draft)
    const max = m === 'short' ? 60 : 120
    if (v >= 1 && v <= max) {
      timer.setDurations({ ...timer.durations, [m]: v })
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="tmode-edit" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <input
          autoFocus
          type="number"
          min="1"
          max={m === 'short' ? 60 : 120}
          value={draft}
          style={{ width: '3rem', fontSize: '0.85em', padding: '2px 4px', borderRadius: 4,
                   background: 'var(--s3)', border: '1px solid var(--dim)', color: 'var(--text)', textAlign: 'center' }}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          onClick={e => e.stopPropagation()}
        />
        <span style={{ fontSize: '0.75em', color: 'var(--sub)' }}>m</span>
      </span>
    )
  }

  return (
    <button
      className={`tmode${active ? ' active' : ''}`}
      onClick={() => timer.setMode(m)}
      onDoubleClick={startEdit}
      title={`${m === 'focus' ? 'Focus' : m === 'short' ? 'Short' : 'Long'} · ${mins}m — double-click to change`}
    >
      {m === 'focus' ? 'Focus' : m === 'short' ? 'Short' : 'Long'}
      <span style={{ marginLeft: 4, fontSize: '0.72em', opacity: 0.6 }}>{mins}m</span>
    </button>
  )
}

export default function FocusTab({ timer, tasks, sessions, focusTaskId, setFocusTaskId, onDeleteSession, onManualLog, petStage = 'egg', skin = 'bluebird' }) {
  const [manual, setManual] = useState('')
  const today = sessions.filter(s => s.date === todayStr())
  const mins = today.reduce((a, s) => a + s.minutes, 0)
  const full = today.filter(s => s.completed).length
  const { labels, data } = weekData(sessions)
  const dots = timer.count % 4 || (timer.count > 0 ? 4 : 0)

  return (
    <div className="focus-layout">
      <div className="timer-panel">
        <div className="timer-modes">
          {['focus', 'short', 'long'].map(m => <ModeBtn key={m} m={m} timer={timer} />)}
        </div>
        <div className={`timer-stage${timer.running ? ' running' : ''}`}>
          <PetTimer stage={petStage} skin={skin} mode={timer.mode} running={timer.running} secs={timer.secs} total={timer.total} count={timer.count} />
          <div className="timer-display">{String(Math.floor(timer.secs / 60)).padStart(2, '0')}:{String(timer.secs % 60).padStart(2, '0')}</div>
          <div className="timer-mode-label">{LABEL[timer.mode]}</div>
          <div className="timer-session-dots">
            {[0, 1, 2, 3].map(i => <div key={i} className={`session-dot${i < dots ? ' done' : ''}`} />)}
          </div>
        </div>
        <div className="timer-controls">
          <button className="tbtn" onClick={timer.reset} title="Reset" aria-label="Reset">↺</button>
          <button className={`tbtn primary${timer.running ? ' running' : ''}`} onClick={timer.toggle}>
            {timer.running ? 'Pause' : timer.secs < timer.total ? 'Resume' : 'Start'}
          </button>
          <button className="tbtn" onClick={timer.skip} title="Skip" aria-label="Skip">⏭</button>
        </div>
        <div style={{ fontSize: '0.72em', color: 'var(--sub)', textAlign: 'center', marginTop: 2 }}>
          Double-click a mode to change its duration
        </div>
        <label className="task-link-row chip">
          <select value={focusTaskId || ''} onChange={e => setFocusTaskId(e.target.value || null)}>
            <option value="">Link to a task…</option>
            {tasks.filter(t => t.progress < 100).map(t => <option key={t.id} value={t.id}>{t.name.slice(0, 40)}</option>)}
          </select>
        </label>
      </div>

      <div className="panel-col">
        <section className="panel">
          <div className="panel-label">Today's focus</div>
          <div className="today-focus">
            <div className="focus-steps"><div className="big-mins">{mins}</div><div className="unit">min</div></div>
            <div className="focus-bar-track"><div className="focus-bar-fill" style={{ width: Math.min(100, Math.round(mins / GOAL * 100)) + '%' }} /></div>
            <div className="focus-subtext">{full} session{full !== 1 ? 's' : ''} done · goal {GOAL} min a day</div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-label">This week</div>
          <div className="week-chart-wrap"><WeekBars labels={labels} data={data} /></div>
        </section>
        <section className="panel">
          <div className="panel-label">Today's sessions</div>
          <div className="session-log">
            {!today.length && <div className="empty" style={{ padding: '8px 0', fontSize: 13 }}>No sessions yet. Start the timer!</div>}
            {[...today].reverse().map(s => (
              <div className="slog-item" key={s.id}>
                <div className="slog-dot" style={s.completed ? undefined : { background: 'var(--dim)' }} />
                <div className="slog-text">
                  {s.task_name && <><span style={{ color: 'var(--text)' }}>{s.task_name}</span> · </>}
                  {s.manual ? 'Manual entry' : s.completed ? 'Full session' : 'Partial'}
                </div>
                <div className="slog-dur">{s.time_of_day ? s.time_of_day + ' · ' : ''}{s.minutes}m</div>
                <button className="slog-del" title="Remove" onClick={() => onDeleteSession(s.id)}>×</button>
              </div>
            ))}
          </div>
          <div className="manual-log-row">
            <input type="number" className="due-input" min="1" placeholder="Minutes" value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onManualLog(+manual); setManual('') } }} />
            <button className="link-btn" onClick={() => { onManualLog(+manual); setManual('') }}>+ Log minutes</button>
          </div>
        </section>
      </div>
    </div>
  )
}
