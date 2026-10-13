import TaskCard from './TaskCard'

// Tasks grouped by category, each shown as a pile of cards (see sketch):
// the next-up task sits on top, the rest peek out underneath, and the arrow below fans them out.
export default function CategoryStacks({ groups, expanded, onToggleExpand, onOpen, onProgress }) {
  return (
    <div className="stacks">
      {groups.map(g => {
        const open = expanded.has(g.name)
        const [top, ...rest] = g.tasks
        const avg = Math.round(g.tasks.reduce((a, t) => a + t.progress, 0) / g.tasks.length)
        const depth = open ? 0 : Math.min(rest.length, 2)
        const card = (t, i) => <TaskCard key={t.id} task={t} idx={i} onOpen={() => onOpen(t.id)} onProgress={onProgress} />
        return (
          <section key={g.name} className={`stack${open ? ' open' : ''}`} style={{ '--cat': g.color }} aria-label={g.name}>
            <header className="stack-head">
              <span className="stack-dot" />
              <h3>{g.name}</h3>
              <span className="stack-count">{g.tasks.length}</span>
              <span className="stack-avg" title="Average progress">{avg}%</span>
            </header>

            <div className="stack-pile" style={{ '--depth': depth }}>
              {Array.from({ length: depth }, (_, i) => (
                <div key={i} className="stack-peek" style={{ '--d': i + 1 }} aria-hidden="true" onClick={() => onToggleExpand(g.name)} />
              ))}
              {card(top, 0)}
            </div>

            {open && <div className="stack-rest">{rest.map((t, i) => card(t, i + 1))}</div>}

            {rest.length > 0 && (
              <button className="stack-toggle" aria-expanded={open} onClick={() => onToggleExpand(g.name)}>
                <span className="stack-arrow" aria-hidden="true">{open ? '↑' : '↓'}</span>
                {open ? 'Stack' : `${rest.length} more`}
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}
