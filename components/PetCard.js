import { useEffect, useRef, useState } from 'react'
import { STAGES, MOODS, petPortrait } from '../lib/pet'
import ShopBody from './ShopSheet'
import Wallet from './Wallet'

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

// The pet panel, opened by clicking the bird (in the scene or the hotbar): the bird, its stages, the shop.
export default function PetPanel({ pet, petData, name, skin = 'bluebird', onName, onBuy, onWear, hatched, preview, onPreview, initialTab = 'bird', onClose }) {
  const [tab, setTab] = useState(initialTab)
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
  const TABS = [['bird', 'Bird'], ['stages', 'Stages'], ['shop', 'Shop']]

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal pet-sheet" role="dialog" aria-modal="true" aria-label="Your pet">
        <div className="detail-head">
          <h2>{title}</h2>
          <Wallet lilies={petData?.lilies || 0} pearls={petData?.pearls || 0} className="big" />
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="pet-tabs" role="tablist">
          {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`pet-tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        </div>

        {tab === 'bird' && <>
          <div className="pet-hero">
            <div className="pet-stage-art glow"><PetPortrait stage={stage.key} mood={mood} skin={skin} /></div>
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
        </>}

        {tab === 'stages' && <>
          <ol className="stage-list">
            {STAGES.map((st, i) => {
              const reached = i <= pet.real, current = i === pet.real
              const need = st.orTasks ? `${st.at} focus hours or ${st.orTasks} tasks` : st.at ? `${st.at} focus hours` : 'From the start'
              const left = !reached && st.at ? `${fmtH(Math.max(0, st.at - pet.hours))} h to go` : ''
              return (
                <li key={st.key}>
                  <button type="button" className={`stage-row${pet.idx === i ? ' viewing' : ''}${reached ? ' reached' : ' locked'}`} onClick={() => onPreview(i === pet.real ? null : i)} aria-pressed={pet.idx === i}>
                    <span className="stage-art"><PetPortrait stage={st.key} mood="content" skin={skin} scale={3} /></span>
                    <span className="stage-text"><b>{st.name}</b><small>{need}</small></span>
                    <span className="stage-state">{current ? 'Now' : reached ? 'Done' : left}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <small className="stage-note">Tap a stage to preview it in the scene (only on this device). {preview !== null && <button type="button" className="link-btn" onClick={() => onPreview(null)}>Back to real stage</button>}</small>
        </>}

        {tab === 'shop' && <ShopBody pet={pet} petData={petData} onBuy={onBuy} onWear={onWear} />}
      </div>
    </div>
  )
}
