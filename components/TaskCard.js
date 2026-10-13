import { useState } from 'react'
import { statusOf, urgencyInfo, stripHtml, PRIORITY_LABELS, safeHref } from '../lib/util'

// One task tile: check · due, title, a line of context, progress bar along the bottom.
// Everything else (notes, link, tags, history) lives in the detail sheet (TaskDetail).
export default function TaskCard({ task: t, idx = 0, onOpen, onProgress, spark = false }) {
  const s = statusOf(t), u = urgencyInfo(t.due)
  const notes = stripHtml(t.notes)
  const [editPct, setEditPct] = useState(null)
  const stop = e => e.stopPropagation()
  const commitPct = () => { onProgress(t.id, Math.max(0, Math.min(100, parseInt(editPct) || 0))); setEditPct(null) }
  const dueLabel = s === 'done' ? 'Done' : u ? u.label : ''

  return (
    <article className={`task-card is-${s}${spark ? ' intro-spark' : ''}`} style={{ '--i': Math.min(idx, 10) }} tabIndex={0}
      onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen() }}
      aria-label={`${t.name}, ${t.progress}% done${dueLabel ? ', ' + dueLabel : ''}`}>
      <div className="card-top">
        <button className={`card-check ${s}`} aria-label={s === 'done' ? 'Mark incomplete' : 'Mark complete'}
          onClick={e => { stop(e); onProgress(t.id, s === 'done' ? 0 : 100) }} />
        {dueLabel && (
          <span className={`card-due ${s === 'done' ? 'u-done' : u.cls}`}>
            {dueLabel}{u && u.diff === 0 && t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ''}
          </span>
        )}
      </div>

      <h4 className="card-title">{t.name}</h4>
      {notes && <p className="card-notes">{notes}</p>}
      {(t.priority || t.link) && (
        <div className="card-meta">
          {t.priority && <span className={`prio prio-${t.priority}`}>{PRIORITY_LABELS[t.priority]}</span>}
          {safeHref(t.link) && <a href={safeHref(t.link)} target="_blank" rel="noopener noreferrer" onClick={stop}>Link ↗</a>}
        </div>
      )}

      <div className="card-prog">
        <div className="card-prog-track"><div className="card-prog-fill" style={{ width: t.progress + '%' }} /></div>
        {editPct === null
          ? <button className="card-prog-pct" title="Set progress" onClick={e => { stop(e); setEditPct(String(t.progress)) }}>{t.progress}%</button>
          : <input className="card-pct-input" type="number" min="0" max="100" autoFocus value={editPct} aria-label="Progress percent"
              onClick={stop} onChange={e => setEditPct(e.target.value)} onBlur={commitPct}
              onKeyDown={e => { stop(e); if (e.key === 'Enter') commitPct(); if (e.key === 'Escape') setEditPct(null) }} />}
      </div>
    </article>
  )
}
