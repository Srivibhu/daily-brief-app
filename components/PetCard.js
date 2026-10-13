import { useEffect, useRef, useState } from 'react'
import { STAGES, MOODS, petPortrait } from '../lib/pet'

// Pixel portrait of the pet at a given stage
export function PetPortrait({ stage, mood, scale = 6, skin = 'bluebird', pose = '', className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const src = petPortrait(stage, mood, scale, skin, pose), cv = ref.current
    cv.width = src.width; cv.height = src.height
    cv.getContext('2d').drawImage(src, 0, 0)
  }, [stage, mood, scale, skin, pose])
  return <canvas ref={ref} className={`pet-portrait ${className}`} aria-hidden="true" />
}

const fmtH = h => h < 10 ? h.toFixed(1) : Math.round(h)

// The pet card: name, stage, progress to the next stage, mood. Opened from the hotbar.
export default function PetCard({ pet, name, skin = 'bluebird', onName, onShop, hatched, preview, onPreview, onClose }) {
  const [draft, setDraft] = useState(name || '')
  const input = useRef(null)
  useEffect(() => {
    if (hatched) input.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, hatched])

  const { stage, next, mood } = pet
  const canName = pet.idx >= 2
  const title = hatched ? 'It hatched!' : name && canName ? name : stage.key === 'egg' || stage.key === 'cracking' ? 'Your egg' : `Your ${stage.name.toLowerCase()}`

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal pet-sheet" role="dialog" aria-modal="true" aria-label="Your pet">
        <div className="detail-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="pet-hero">
          <div className="pet-stage-art"><PetPortrait stage={stage.key} mood={mood} skin={skin} /></div>
          <div className="pet-facts">
            <div className="pet-stage-name">{stage.name}{pet.preview && <span className="pet-preview-tag">preview</span>}</div>
            <p>{stage.look}</p>
            <div className={`pet-mood mood-${mood}`}><b>{MOODS[mood].name}.</b> {MOODS[mood].note}</div>
          </div>
        </div>

        {next ? (
          <div className="pet-grow">
            <div className="pet-grow-label">
              <span>Next: <b>{next.name}</b></span>
              <span>{fmtH(pet.hours)} of {next.at} focus hours{next.orTasks ? ` (or ${next.orTasks} tasks done: ${pet.done})` : ''}</span>
            </div>
            <div className="card-prog-track"><div className="card-prog-fill" style={{ width: Math.round(pet.progress * 100) + '%', '--cat': 'var(--leaf)' }} /></div>
          </div>
        ) : <p className="pet-grow-label">Fully grown. {fmtH(pet.hours)} focus hours together.</p>}

        <form className="pet-name-row" onSubmit={e => { e.preventDefault(); onName(draft.trim()); if (hatched) onClose() }}>
          {canName ? (
            <>
              <input ref={input} className="field-input" value={draft} maxLength={24} placeholder="Give it a name" aria-label="Pet name" onChange={e => setDraft(e.target.value)} />
              <button type="submit" className="btn" disabled={!draft.trim() || draft.trim() === name}>{hatched ? 'Name it' : 'Save'}</button>
            </>
          ) : <span className="detail-meta-sm">You'll name it when it hatches.</span>}
        </form>

        {onShop && <button type="button" className="btn pet-shop-btn" onClick={onShop}>Open the shop</button>}

        <div className="pet-preview">
          <span className="pet-preview-k">Preview a stage</span>
          <div className="pet-preview-btns" role="group" aria-label="Preview a stage">
            {STAGES.map((st, i) => (
              <button key={st.key} type="button" className={`seg-btn${pet.idx === i ? ' active' : ''}`} aria-pressed={pet.idx === i}
                onClick={() => onPreview(i === pet.real ? null : i)}>{st.name}</button>
            ))}
          </div>
          <small>Only changes what you see on this device. {preview !== null && <button type="button" className="link-btn" onClick={() => onPreview(null)}>Back to real stage</button>}</small>
        </div>
      </div>
    </div>
  )
}
