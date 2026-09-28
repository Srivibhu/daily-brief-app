import { Donut, WeekBars } from './charts'
import { weekData } from './FocusTab'
import { urgencyInfo, dateStr, todayStr, TIPS } from '../lib/util'

export default function Sidebar({ tasks, sessions, activity }) {
  const now = new Date()
  const h = now.getHours()
  const done = tasks.filter(t => t.progress === 100).length
  const inprog = tasks.filter(t => t.progress > 0 && t.progress < 100).length
  const todo = tasks.filter(t => t.progress === 0).length
  const overall = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0
  const mins = sessions.filter(s => s.date === todayStr()).reduce((a, s) => a + s.minutes, 0)
  const { labels, data } = weekData(sessions)
  const soon = tasks.filter(t => t.due && t.progress < 100).map(t => ({ ...t, u: urgencyInfo(t.due) }))
    .filter(t => t.u.diff <= 7).sort((a, b) => a.u.diff - b.u.diff)
  const cells = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (27 - i))
    const k = dateStr(d), c = activity[k] || 0
    return { k, c, l: c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : 3 }
  })

  return (
    <div className="sidebar">
      <div className="panel">
        <div className="brief-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        <div className="greeting">{h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}</div>
        <div className="divider" />
        <div className="sec-label">Progress</div>
        {!tasks.length && <div className="empty" style={{ padding: '5px 0', fontSize: 12 }}>No tasks yet</div>}
        {tasks.map(t => (
          <div className="brief-task" key={t.id}>
            <span className="brief-name" title={t.name}>{t.name}</span>
            <div className="brief-mini"><div className={`brief-fill${t.progress === 100 ? ' done' : ''}`} style={{ width: t.progress + '%' }} /></div>
            <span className="brief-pct">{t.progress}%</span>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="sec-label">Focus Today</div>
        <div className="focus-today-mini"><div className="mins">{mins}</div><div className="label">minutes focused</div></div>
        <div className="focus-week-mini-wrap"><WeekBars labels={labels} data={data} /></div>
      </div>
      <div className="panel">
        <div className="sec-label">Due Soon</div>
        {!soon.length && <div className="empty" style={{ padding: '5px 0', fontSize: 12 }}>No upcoming deadlines</div>}
        {soon.map(t => (
          <div className="due-item" key={t.id}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.u.color, flexShrink: 0, display: 'inline-block' }} />
            <span className="due-name">{t.name}</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, color: t.u.color }}>{t.u.label}</span>
          </div>
        ))}
      </div>
      <div className="panel" style={{ paddingBottom: 9 }}>
        <div className="sec-label">Completion</div>
        <div className="donut-wrap">
          <Donut done={done} inprog={inprog} todo={todo} />
          <div className="donut-center"><div className="big">{overall}%</div><div className="sm">complete</div></div>
        </div>
      </div>
      <div className="panel">
        <div className="sec-label">28-Day Activity</div>
        <div className="activity-grid">{cells.map(c => <div key={c.k} className={`act-cell act-${c.l}`} title={`${c.k}: ${c.c}`} />)}</div>
      </div>
      <div className="tip-panel">
        <div className="tip-label">Focus</div>
        <div className="tip-text">{TIPS[now.getDay() % TIPS.length]}</div>
      </div>
    </div>
  )
}
