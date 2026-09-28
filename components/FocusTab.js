import { useState } from 'react'
import { WeekBars } from './charts'
import { todayStr, dateStr } from '../lib/util'

const CIRC = 2 * Math.PI * 85
const RING = { focus: 'var(--blue)', short: 'var(--green)', long: 'var(--purple)' }
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

export default function FocusTab({ timer, tasks, sessions, focusTaskId, setFocusTaskId, onDeleteSession, onManualLog }) {
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
          {['focus', 'short', 'long'].map(m => (
            <button key={m} className={`tmode${timer.mode === m ? ' active' : ''}`} onClick={() => timer.setMode(m)}>
              {m === 'focus' ? 'Focus' : m === 'short' ? 'Short' : 'Long'}
            </button>
          ))}
        </div>
        <div className="timer-ring-wrap">
          <svg className="timer-svg" width="180" height="180" viewBox="0 0 180 180">
            <circle className="timer-ring-bg" cx="90" cy="90" r="85" />
            <circle className="timer-ring-prog" cx="90" cy="90" r="85"
              style={{ strokeDashoffset: CIRC * (1 - timer.secs / timer.total), stroke: RING[timer.mode] }} />
          </svg>
          <div className="timer-center">
            <div className="timer-display">{String(Math.floor(timer.secs / 60)).padStart(2, '0')}:{String(timer.secs % 60).padStart(2, '0')}</div>
            <div className="timer-mode-label">{LABEL[timer.mode]}</div>
            <div className="timer-session-dots">
              {[0, 1, 2, 3].map(i => <div key={i} className={`session-dot${i < dots ? ' done' : ''}`} />)}
            </div>
          </div>
        </div>
        <div className="timer-controls">
          <button className="tbtn" onClick={timer.reset} title="Reset">↺</button>
          <button className={`tbtn primary${timer.running ? ' running' : ''}`} onClick={timer.toggle}>
            {timer.running ? 'Pause' : timer.secs < timer.total ? 'Resume' : 'Start'}
          </button>
          <button className="tbtn" onClick={timer.skip} title="Skip">⏭</button>
        </div>
        <div className="task-link-row">
          <select value={focusTaskId || ''} onChange={e => setFocusTaskId(e.target.value || null)}>
            <option value="">— Link to a task —</option>
            {tasks.filter(t => t.progress < 100).map(t => <option key={t.id} value={t.id}>{t.name.slice(0, 40)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="field-label" style={{ marginTop: 0 }}>Today's Focus</div>
        <div className="today-focus">
          <div className="focus-steps"><div className="big-mins">{mins}</div><div className="unit">min</div></div>
          <div className="focus-subtext">{full} session{full !== 1 ? 's' : ''} completed today</div>
          <div className="focus-bar-track"><div className="focus-bar-fill" style={{ width: Math.min(100, Math.round(mins / GOAL * 100)) + '%' }} /></div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--sub)' }}>Goal: {GOAL} min / day</div>
        </div>
        <div className="field-label">This Week</div>
        <div className="week-chart-wrap"><WeekBars labels={labels} data={data} /></div>
        <div className="field-label">Today's Sessions</div>
        <div className="session-log">
          {!today.length && <div className="empty" style={{ padding: '8px 0', fontSize: 12 }}>No sessions yet — start the timer!</div>}
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
          <button className="btn ghost sm" onClick={() => { onManualLog(+manual); setManual('') }}>+ Log session</button>
        </div>
      </div>
    </div>
  )
}
