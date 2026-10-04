import { useState } from 'react'
import { api, PRESET_COLORS } from '../lib/util'

function Colors({ value, onChange }) {
  return (
    <div className="color-dots">
      {PRESET_COLORS.map(c => <button key={c} className={`color-dot${value === c ? ' sel' : ''}`} style={{ background: c }} onClick={() => onChange(c)} />)}
    </div>
  )
}

export default function TagModal({ tags, setTags, onClose }) {
  const [name, setName] = useState(''), [color, setColor] = useState('#6f8db3')
  const [editId, setEditId] = useState(null), [eName, setEName] = useState(''), [eColor, setEColor] = useState('')

  async function create() {
    if (!name.trim()) return
    const d = await api('/api/tags', { method: 'POST', body: { name: name.trim(), color } })
    if (d?.id) { setTags(t => [...t, d].sort((a, b) => a.name.localeCompare(b.name))); setName('') } else alert(d?.error || 'Could not add tag')
  }
  async function save(id) {
    const d = await api(`/api/tags/${id}`, { method: 'PUT', body: { name: eName.trim(), color: eColor } })
    if (d?.id) { setTags(t => t.map(g => (g.id === id ? d : g))); setEditId(null) }
  }
  async function remove(id) {
    await api(`/api/tags/${id}`, { method: 'DELETE' })
    setTags(t => t.filter(g => g.id !== id))
  }

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Tag editor</h2>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="tag-add-row">
          <input className="due-input" style={{ flex: 1 }} placeholder="Tag name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
          <Colors value={color} onChange={setColor} />
          <button className="btn" onClick={create}>Add</button>
        </div>
        {!tags.length && <div className="empty">No tags yet</div>}
        {tags.map(g => (
          <div className="tag-row" key={g.id}>
            {editId === g.id ? (
              <>
                <input className="due-input" style={{ flex: 1 }} value={eName} onChange={e => setEName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save(g.id)} />
                <Colors value={eColor} onChange={setEColor} />
                <button className="btn sm" onClick={() => save(g.id)}>Save</button>
                <button className="btn ghost sm" onClick={() => setEditId(null)}>✕</button>
              </>
            ) : (
              <>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: g.color }}>{g.name}</span>
                <button className="btn ghost sm" onClick={() => { setEditId(g.id); setEName(g.name); setEColor(g.color) }}>Edit</button>
                <button className="btn danger sm" onClick={() => remove(g.id)}>✕</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
