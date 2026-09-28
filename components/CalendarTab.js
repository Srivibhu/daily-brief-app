import { useState } from 'react'
import { todayStr, statusOf, urgencyInfo } from '../lib/util'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarTab({ tasks, tags }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [sel, setSel] = useState(null)

  const move = dir => {
    let m = month + dir, y = year
    if (m > 11) { m = 0; y++ } if (m < 0) { m = 11; y-- }
    setMonth(m); setYear(y); setSel(null)
  }
  const first = new Date(year, month, 1).getDay(), dim = new Date(year, month + 1, 0).getDate(), today = todayStr()
  const byDay = {}
  tasks.forEach(t => {
    if (t.due && +t.due.slice(0, 4) === year && +t.due.slice(5, 7) - 1 === month) (byDay[+t.due.slice(8, 10)] ||= []).push(t)
  })
  const selTasks = sel ? byDay[sel] || [] : []
  const chip = n => { const g = tags.find(x => x.name === n); return g && <span key={n} className="tag" style={{ background: g.color + '18', color: g.color }}>{g.name}</span> }

  return (
    <div>
      <div className="cal-header">
        <button className="cal-nav" onClick={() => move(-1)}>‹</button>
        <span className="cal-title">{MONTHS[month]} {year}</span>
        <button className="cal-nav" onClick={() => move(1)}>›</button>
      </div>
      <div className="cal-grid">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="cal-dow">{d}</div>)}
        {Array.from({ length: first }, (_, i) => <div key={'e' + i} className="cal-cell empty" />)}
        {Array.from({ length: dim }, (_, i) => {
          const day = i + 1, ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          return (
            <div key={day} className={`cal-cell${ds === today ? ' today' : ''}${sel === day ? ' selected' : ''}`} onClick={() => setSel(sel === day ? null : day)}>
              <div className="cal-day">{day}</div>
              <div className="cal-dots">
                {(byDay[day] || []).slice(0, 5).map(t => <div key={t.id} className="cal-dot" style={{ background: (urgencyInfo(t.due) || {}).color || '#3b82f6' }} />)}
              </div>
            </div>
          )
        })}
      </div>
      {sel && (
        <div className="cal-selected-tasks">
          <div className="cal-selected-date">{new Date(year, month, sel).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          {!selTasks.length && <div className="empty" style={{ padding: '7px 0', fontSize: 12 }}>No tasks due</div>}
          {selTasks.map(t => {
            const u = urgencyInfo(t.due), s = statusOf(t)
            return (
              <div className="cal-task-row" key={t.id}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: s === 'done' ? '#22c55e' : s === 'inprog' ? '#f59e0b' : '#333' }} />
                <span className="cal-task-name">{t.name}</span>
                {u && <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, color: u.color }}>{u.label}</span>}
                {(t.tags || []).map(chip)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
