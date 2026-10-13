import { useEffect, useRef } from 'react'
import { MiniLine } from './charts'
import { statusOf, sanitizeHtml, dateStr, PRIORITY_LABELS, safeHref } from '../lib/util'

// Rich-text notes (contenteditable) — content is initialised once, then owned by the DOM
function NoteEditor({ html, onSave }) {
  const ref = useRef(null)
  const timer = useRef(null)
  useEffect(() => { if (ref.current) ref.current.innerHTML = sanitizeHtml(html) }, []) // eslint-disable-line
  const flush = () => { clearTimeout(timer.current); timer.current = setTimeout(() => onSave(ref.current.innerHTML), 600) }
  function fmt(cmd) {
    ref.current.focus()
    if (cmd === 'bold') document.execCommand('bold')
    if (cmd === 'bullet') document.execCommand('insertUnorderedList')
    if (cmd === 'number') document.execCommand('insertOrderedList')
    if (cmd === 'checklist') document.execCommand('insertHTML', false, '<div class="check-item"><input type="checkbox"> <span>Item</span></div>')
    if (cmd === 'code') document.execCommand('insertHTML', false, '<code style="background:var(--s3);padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px"> </code>')
    flush()
  }
  return (
    <div className="notes-editor">
      <div className="notes-toolbar">
        <button className="ntool" onClick={() => fmt('bold')}><b>B</b></button>
        <button className="ntool" onClick={() => fmt('bullet')}>• List</button>
        <button className="ntool" onClick={() => fmt('number')}>1. List</button>
        <button className="ntool" onClick={() => fmt('checklist')}>☐ Check</button>
        <button className="ntool" onClick={() => fmt('code')}>Code</button>
      </div>
      <div ref={ref} className="notes-content" contentEditable suppressContentEditableWarning
        data-placeholder="Notes, links, context…" onInput={flush}
        onClick={e => {
          if (e.target.type === 'checkbox') {
            e.target.checked ? e.target.setAttribute('checked', '') : e.target.removeAttribute('checked')
            flush()
          }
        }} />
    </div>
  )
}

export default function TaskDetail({ task: t, tags, onClose, onProgress, onUpdate, onDelete }) {
  const s = statusOf(t)
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const labels = [], data = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const k = dateStr(d)
    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    const h = [...(t.history || [])].reverse().find(x => x.date <= k)
    data.push(h ? h.progress : 0)
  }

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal detail-sheet" role="dialog" aria-modal="true" aria-label={t.name}>
        <div className="detail-head">
          <button className={`card-check ${s}`} aria-label={s === 'done' ? 'Mark incomplete' : 'Mark complete'}
            onClick={() => onProgress(t.id, s === 'done' ? 0 : 100)} />
          <input className="detail-title" defaultValue={t.name} aria-label="Task name"
            onChange={e => e.target.value.trim() && onUpdate(t.id, { name: e.target.value.trim() }, 700)} />
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="detail-slider-row">
          <input type="range" min="0" max="100" step="5" value={t.progress} aria-label="Progress" onChange={e => onProgress(t.id, +e.target.value)} />
          <span className="detail-pct">{t.progress}%</span>
        </div>
        <div className="prog-nudges">
          {[-25, 25, 50].map(d => (
            <button key={d} className="prog-nudge" onClick={() => onProgress(t.id, Math.max(0, Math.min(100, t.progress + d)))}>
              {d > 0 ? '+' : '−'}{Math.abs(d)}%
            </button>
          ))}
        </div>

        <dl className="detail-fields">
          <dt>Due</dt>
          <dd>
            <input type="date" className="field-input" value={t.due || ''} aria-label="Due date" onChange={e => onUpdate(t.id, { due: e.target.value || null })} />
            <input type="time" className="field-input" value={(t.due_time || '').slice(0, 5)} aria-label="Due time" onChange={e => onUpdate(t.id, { due_time: e.target.value || null })} />
            {t.due && <button className="link-btn" onClick={() => onUpdate(t.id, { due: null, due_time: null })}>Clear</button>}
          </dd>
          <dt>Priority</dt>
          <dd className="seg">
            {[null, 'p1', 'p2', 'p3'].map(p => (
              <button key={p || 'none'} className={`seg-btn${(t.priority || null) === p ? ' on' : ''}${p ? ' prio-' + p : ''}`}
                onClick={() => onUpdate(t.id, { priority: p })}>{p ? PRIORITY_LABELS[p] : 'None'}</button>
            ))}
          </dd>
          <dt>Category</dt>
          <dd className="seg">
            {tags.map(g => {
              const on = (t.tags || []).includes(g.name)
              return (
                <button key={g.id} className={`tag-toggle${on ? ' selected' : ''}`} style={{ '--tag': g.color }}
                  onClick={() => onUpdate(t.id, { tags: on ? t.tags.filter(x => x !== g.name) : [...(t.tags || []), g.name] })}>
                  {g.name}
                </button>
              )
            })}
          </dd>
          <dt>Link</dt>
          <dd>
            <input className="field-input grow" type="url" placeholder="https://…" defaultValue={t.link || ''} aria-label="Link"
              onChange={e => onUpdate(t.id, { link: e.target.value }, 700)} />
            {safeHref(t.link) && <a className="link-btn" href={safeHref(t.link)} target="_blank" rel="noopener noreferrer">Open ↗</a>}
          </dd>
        </dl>

        <NoteEditor html={t.notes} onSave={html => onUpdate(t.id, { notes: html })} />

        <div className="field-label">Last 7 days</div>
        <div className="mini-chart-wrap"><MiniLine labels={labels} data={data} /></div>

        <div className="detail-footer">
          <span className="detail-meta-sm">Added {t.created_at || 'today'}</span>
          <button className="link-btn danger" onClick={() => { if (confirm('Delete this task?')) { onDelete(t.id); onClose() } }}>Delete task</button>
        </div>
      </div>
    </div>
  )
}
