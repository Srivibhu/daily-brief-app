import { useEffect, useRef, useState } from 'react'
import { MiniLine } from './charts'
import { statusOf, urgencyInfo, accentColor, progColor, stripHtml, sanitizeHtml, dateStr, PRIORITY_LABELS } from '../lib/util'

function TagChip({ tag }) {
  return <span className="tag" style={{ background: tag.color + '18', color: tag.color }}>{tag.name}</span>
}

function DaysLeft({ u, done }) {
  if (done) return <div className="days-left"><div className="dl-num" style={{ fontSize: 12, color: 'var(--green)' }}>Done</div></div>
  if (!u) return <div className="days-left"><div className="dl-num" style={{ fontSize: 13, color: 'var(--sub)' }}>—</div></div>
  if (u.num !== null) {
    return (
      <div className="days-left">
        <div className={`dl-num ${u.cls}`}>{u.num}</div>
        <div className={`dl-label ${u.cls}`}>{u.diff < 0 ? 'overdue' : u.diff === 1 ? 'tomorrow' : 'days left'}</div>
      </div>
    )
  }
  return <div className="days-left"><div className={`dl-num ${u.cls}`} style={{ fontSize: 14 }}>{u.label}</div></div>
}

// Rich-text notes (contenteditable) — content is initialised once, then owned by the DOM
function NoteEditor({ html, onSave }) {
  const ref = useRef(null)
  const timer = useRef(null)
  useEffect(() => { if (ref.current) ref.current.innerHTML = sanitizeHtml(html) }, []) // eslint-disable-line
  const flush = () => { clearTimeout(timer.current); timer.current = setTimeout(() => onSave(ref.current.innerHTML), 600) }
  function fmt(cmd) {
    const el = ref.current; el.focus()
    if (cmd === 'bold') document.execCommand('bold')
    if (cmd === 'bullet') document.execCommand('insertUnorderedList')
    if (cmd === 'number') document.execCommand('insertOrderedList')
    if (cmd === 'checklist') document.execCommand('insertHTML', false, '<div class="check-item"><input type="checkbox"> <span>Item</span></div>')
    if (cmd === 'code') document.execCommand('insertHTML', false, '<code style="background:var(--s3);padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px;color:var(--blue)"> </code>')
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
          // persist checkbox state into the saved HTML
          if (e.target.type === 'checkbox') {
            e.target.checked ? e.target.setAttribute('checked', '') : e.target.removeAttribute('checked')
            flush()
          }
        }} />
    </div>
  )
}

export default function TaskCard({ task: t, idx = 0, tags, open, onToggle, onProgress, onUpdate, onDelete, onCyclePriority }) {
  const s = statusOf(t), u = urgencyInfo(t.due)
  const notesPreview = stripHtml(t.notes)
  const taskTags = (t.tags || []).map(n => tags.find(g => g.name === n)).filter(Boolean)
  const [editPct, setEditPct] = useState(null)

  const labels = [], data = []
  if (open) {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const k = dateStr(d)
      labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
      const h = [...(t.history || [])].reverse().find(x => x.date <= k)
      data.push(h ? h.progress : 0)
    }
  }
  const stop = e => e.stopPropagation()
  const commitPct = () => { onProgress(t.id, Math.max(0, Math.min(100, parseInt(editPct) || 0))); setEditPct(null) }

  return (
    <div className={`task-card${s === 'done' ? ' done-card' : ''}${s === 'inprog' ? ' prog-card' : ''}${open ? ' open' : ''}`}
      style={{ '--card-accent': accentColor(t), '--i': Math.min(idx, 12) }} onClick={onToggle}>
      <div className="card-body">
        <button className={`card-check ${s === 'done' ? 'done' : s === 'inprog' ? 'inprog' : ''}`}
          title={s === 'done' ? 'Mark incomplete' : 'Mark complete'}
          onClick={e => { stop(e); onProgress(t.id, s === 'done' ? 0 : 100) }} />
        <div className="card-center">
          <div className="card-title">{t.name}</div>
          {notesPreview && <div className="card-notes-preview">{notesPreview.slice(0, 80)}{notesPreview.length > 80 ? '…' : ''}</div>}
          <div className="card-chips">
            {taskTags.map(g => <TagChip key={g.id} tag={g} />)}
            <button className={`priority-flag ${t.priority ? 'pf-' + t.priority : 'pf-none'}`}
              onClick={e => { stop(e); onCyclePriority(t.id) }}>
              {t.priority ? PRIORITY_LABELS[t.priority] : 'Priority'}
            </button>
            {t.due && t.due_time && <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--sub)' }}>🕐 {t.due_time.slice(0, 5)}</span>}
          </div>
        </div>
        <div className="card-right">
          <DaysLeft u={u} done={s === 'done'} />
          <div className="card-hover-actions">
            <button className="icon-btn" title="+25%" onClick={e => { stop(e); onProgress(t.id, Math.min(100, t.progress + 25)) }}>+</button>
            <button className="icon-btn del" title="Delete" onClick={e => { stop(e); if (confirm('Delete this task?')) onDelete(t.id) }}>×</button>
          </div>
        </div>
      </div>

      <div className="card-prog-wrap">
        <div className="card-prog-row">
          <div className="card-prog-track"><div className={`card-prog-fill${t.progress > 0 && t.progress < 100 ? ' live' : ''}`} style={{ width: t.progress + '%', background: progColor(t.progress) }} /></div>
          {editPct === null
            ? <span className="card-prog-pct" onClick={e => { stop(e); setEditPct(String(t.progress)) }}>{t.progress}%</span>
            : <input className="card-pct-input" type="number" min="0" max="100" autoFocus value={editPct}
                onClick={stop} onChange={e => setEditPct(e.target.value)} onBlur={commitPct}
                onKeyDown={e => { if (e.key === 'Enter') commitPct(); if (e.key === 'Escape') setEditPct(null) }} />}
          {t.link && <a className="card-link-icon" href={t.link} target="_blank" rel="noopener noreferrer" onClick={stop} title="Open link">↗</a>}
        </div>
      </div>

      {open && (
        <div className="card-detail" onClick={stop}>
          <div className="detail-slider-row" style={{ marginBottom: 12 }}>
            <span className="detail-label">Progress</span>
            <input type="range" min="0" max="100" step="5" value={t.progress} onChange={e => onProgress(t.id, +e.target.value)} />
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--sub)', width: 30, textAlign: 'right' }}>{t.progress}%</span>
          </div>
          <div className="prog-nudges">
            {[-50, -25, 25, 50].map(d => (
              <button key={d} className="prog-nudge" onClick={() => onProgress(t.id, Math.max(0, Math.min(100, t.progress + d)))}>
                {d > 0 ? '+' : '−'}{Math.abs(d)}%
              </button>
            ))}
          </div>
          <div className="detail-row">
            <span className="detail-label">Due</span>
            <input type="date" className="due-input" style={{ fontSize: 11, padding: '4px 7px' }} value={t.due || ''}
              onChange={e => onUpdate(t.id, { due: e.target.value || null })} />
            <input type="time" className="due-input" style={{ fontSize: 11, padding: '4px 7px', width: 90 }} value={(t.due_time || '').slice(0, 5)}
              onChange={e => onUpdate(t.id, { due_time: e.target.value || null })} />
            {t.due && <button className="btn ghost sm" style={{ padding: '3px 6px', fontSize: 10 }} onClick={() => onUpdate(t.id, { due: null, due_time: null })}>Clear</button>}
          </div>
          <div className="detail-row">
            <span className="detail-label">Link</span>
            <input className="detail-link-input" type="url" placeholder="https://…" defaultValue={t.link || ''}
              onChange={e => onUpdate(t.id, { link: e.target.value }, 700)} />
            {t.link && <a className="detail-link-go" href={t.link} target="_blank" rel="noopener noreferrer">Open ↗</a>}
          </div>
          <NoteEditor html={t.notes} onSave={html => onUpdate(t.id, { notes: html })} />
          <div className="tag-toggle-row">
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--sub)', marginRight: 2 }}>Tags</span>
            {tags.map(g => {
              const on = (t.tags || []).includes(g.name)
              return (
                <button key={g.id} className={`tag-toggle${on ? ' selected' : ''}`}
                  style={{ background: g.color + '18', color: g.color, borderColor: g.color + '40' }}
                  onClick={() => onUpdate(t.id, { tags: on ? t.tags.filter(x => x !== g.name) : [...(t.tags || []), g.name] })}>
                  {g.name}
                </button>
              )
            })}
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '10px 0 4px' }}>7-Day History</div>
          <div className="mini-chart-wrap"><MiniLine labels={labels} data={data} /></div>
          <div className="detail-footer">
            <span className="detail-meta-sm">Added {t.created_at || 'today'}</span>
            <button className="btn danger sm" onClick={() => { if (confirm('Delete this task?')) onDelete(t.id) }}>Remove task</button>
          </div>
        </div>
      )}
    </div>
  )
}
