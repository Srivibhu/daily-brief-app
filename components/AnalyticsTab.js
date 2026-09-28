import { fmtMins, isoWeekYear } from '../lib/util'

function weeklyStats(tasks) {
  const weeks = {}
  const bump = (d, field) => {
    const { week, year } = isoWeekYear(new Date(d + 'T00:00:00'))
    const key = `${year}-W${String(week).padStart(2, '0')}`
    const w = (weeks[key] ||= { key, week, year, scheduled: 0, completed: 0 })
    w[field]++
  }
  tasks.forEach(t => { if (t.created_at) bump(t.created_at, 'scheduled'); if (t.progress === 100 && t.completed_at) bump(t.completed_at, 'completed') })
  return Object.values(weeks).sort((a, b) => b.key.localeCompare(a.key)).slice(0, 8)
}

export default function AnalyticsTab({ tasks, sessions }) {
  const weeks = weeklyStats(tasks)
  const cur = isoWeekYear(new Date()), lastD = new Date(); lastD.setDate(lastD.getDate() - 7)
  const last = isoWeekYear(lastD)
  const find = w => weeks.find(x => x.week === w.week && x.year === w.year) || { scheduled: 0, completed: 0 }
  const tw = find(cur), lw = find(last)
  const pct = lw.completed === 0 ? null : Math.round(((tw.completed - lw.completed) / lw.completed) * 100)
  const max = Math.max(...weeks.map(w => Math.max(w.scheduled, w.completed)), 1)
  const total = sessions.reduce((a, s) => a + s.minutes, 0)
  const days = new Set(sessions.map(s => s.date)).size
  const recent = tasks.filter(t => t.progress === 100).sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')).slice(0, 10)

  const stats = [
    ['Tasks this week', tw.scheduled], ['Completed this week', tw.completed, '#22c55e'],
    ['Completion rate', tw.scheduled ? Math.round(tw.completed / tw.scheduled * 100) + '%' : '—'],
    ['vs last week', pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`, pct === null ? undefined : pct >= 0 ? '#22c55e' : '#ef4444'],
    ['Total focus (90d)', fmtMins(total), '#a78bfa'], ['Focus days', days], ['Avg focus / day', days ? fmtMins(Math.round(total / days)) : '—'], ['All tasks', tasks.length],
  ]
  return (
    <div>
      <div className="stat-grid">
        {stats.map(([l, v, c]) => <div className="stat" key={l}><div className="n" style={{ color: c || 'var(--text)', fontSize: 20 }}>{v}</div><div className="l">{l}</div></div>)}
      </div>
      <div className="field-label" style={{ marginTop: 4 }}>Weekly tasks — scheduled vs completed</div>
      {!weeks.length && <div className="empty">No task history yet</div>}
      {[...weeks].reverse().map(w => (
        <div className="bar-row" key={w.key}>
          <div style={{ width: 62, textAlign: 'right' }}>W{w.week} '{String(w.year).slice(2)}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="bar-track"><div className="bar-fill" style={{ width: (w.scheduled / max * 100) + '%', background: '#333' }} /></div>
            <div className="bar-track"><div className="bar-fill" style={{ width: (w.completed / max * 100) + '%', background: 'var(--blue)' }} /></div>
          </div>
          <div style={{ width: 44 }}>{w.completed}/{w.scheduled}</div>
        </div>
      ))}
      <div className="field-label">Recently completed</div>
      {!recent.length && <div className="empty">No completed tasks yet</div>}
      {recent.map(t => (
        <div className="cal-task-row" key={t.id}>
          <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>
          <span className="cal-task-name" style={{ color: 'var(--sub)' }}>{t.name}</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--sub)' }}>{t.completed_at}</span>
        </div>
      ))}
    </div>
  )
}
