import { useEffect, useRef, useState } from 'react'
import { todayStr } from '../lib/util'

// "New quest" sheet, opened from the hotbar's + (or the N key).
export default function AddTaskSheet({ tags, onAdd, onClose }) {
  const [q, setQ] = useState({ name: '', due: todayStr(), time: '', tag: '' })
  const input = useRef(null)
  useEffect(() => {
    input.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    if (!q.name.trim()) return
    await onAdd(q)
    setQ({ name: '', due: todayStr(), time: '', tag: q.tag })
    input.current?.focus()
  }

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal quest-sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-label="New task">
        <div className="detail-head">
          <h2>New task</h2>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <input ref={input} className="quest-name" placeholder="What needs doing?" value={q.name} aria-label="Task name"
          onChange={e => setQ({ ...q, name: e.target.value })} />
        <div className="quest-cats" role="radiogroup" aria-label="Category">
          {[{ id: '', name: 'None', color: 'var(--sub)' }, ...tags].map(g => (
            <button type="button" key={g.id || 'none'} role="radio" aria-checked={q.tag === (g.id ? g.name : '')}
              className={`tag-toggle${q.tag === (g.id ? g.name : '') ? ' selected' : ''}`} style={{ '--tag': g.color }}
              onClick={() => setQ({ ...q, tag: g.id ? g.name : '' })}>{g.name}</button>
          ))}
        </div>
        <div className="quest-when">
          <label><span>Due</span><input type="date" className="field-input" value={q.due} onChange={e => setQ({ ...q, due: e.target.value })} /></label>
          <label><span>Time</span><input type="time" className="field-input" value={q.time} onChange={e => setQ({ ...q, time: e.target.value })} /></label>
        </div>
        <div className="detail-footer">
          <span className="detail-meta-sm">Enter adds it and keeps this open</span>
          <button type="submit" className="btn" disabled={!q.name.trim()}>Add task</button>
        </div>
      </form>
    </div>
  )
}
