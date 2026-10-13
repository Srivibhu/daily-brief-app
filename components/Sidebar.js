import { urgencyInfo, dateStr, TIPS } from '../lib/util'

// Right-hand column: what's coming up, and how the last four weeks went.
// Plain sections on the page — no panels. (The old Progress list and Completion donut
// repeated the task cards and the header summary, so they're gone.)
export default function Sidebar({ tasks, activity, onOpen }) {
  const now = new Date()
  const soon = tasks.filter(t => t.due && t.progress < 100).map(t => ({ ...t, u: urgencyInfo(t.due) }))
    .filter(t => t.u.diff <= 7).sort((a, b) => a.u.diff - b.u.diff)
  const cells = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (27 - i))
    const k = dateStr(d), c = activity[k] || 0
    return { k, c, l: c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : 3 }
  })
  const activeDays = cells.filter(c => c.c > 0).length

  return (
    <aside className="sidebar">
      <section>
        <h2 className="aside-label">Next 7 days</h2>
        {!soon.length && <p className="aside-empty">Nothing due this week.</p>}
        <ol className="due-list">
          {soon.slice(0, 8).map(t => (
            <li key={t.id}>
              <button className="due-item" onClick={() => onOpen(t.id)}>
                <span className="due-name">{t.name}</span>
                <span className={`due-when ${t.u.cls}`}>{t.u.label}</span>
              </button>
            </li>
          ))}
        </ol>
        {soon.length > 8 && <p className="aside-empty">+{soon.length - 8} more</p>}
      </section>

      <section>
        <h2 className="aside-label">Last 4 weeks <span className="aside-note">{activeDays} active days</span></h2>
        <div className="activity-grid">{cells.map(c => <div key={c.k} className={`act-cell act-${c.l}`} title={`${c.k}: ${c.c}`} />)}</div>
      </section>

      <p className="tip-line">{TIPS[now.getDay() % TIPS.length]}</p>
    </aside>
  )
}
