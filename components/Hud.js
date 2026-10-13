import { PetPortrait } from './PetCard'
import Wallet from './Wallet'
import { MOODS } from '../lib/pet'

const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

// Under the egg house: who lives there, how it's doing, and what you've earned
export function PetHud({ pet, name, skin, lilies, pearls, onOpen, onShop }) {
  const pips = { happy: 3, content: 2, sleepy: 1 }[pet.mood]
  return (
    <section className="pet-hud panel" aria-label="Your pet">
      <button type="button" className="ph-main" onClick={onOpen}>
        <span className="ph-art"><PetPortrait stage={pet.stage.key} mood={pet.mood} skin={skin} scale={3} /></span>
        <span className="ph-text">
          <b>{(pet.idx >= 2 && name) || pet.stage.name}</b>
          <span className={`ph-mood mood-${pet.mood}`}>{[0, 1, 2].map(i => <i key={i} className={i < pips ? 'on' : ''} />)} {MOODS[pet.mood].name}</span>
        </span>
      </button>
      {pet.next && <div className="ph-grow" title={`${pet.hours.toFixed(1)} of ${pet.next.at} focus hours to ${pet.next.name}`}><div className="card-prog-track"><div className="card-prog-fill" style={{ width: Math.round(pet.progress * 100) + '%', '--cat': 'var(--leaf)' }} /></div></div>}
      <div className="ph-foot">
        <Wallet lilies={lilies} pearls={pearls} />
        <button type="button" className="chip-btn" onClick={onShop}>Shop</button>
      </div>
    </section>
  )
}

// Top right: the timer, always one click away
export function FocusHud({ timer, todayMins, goal = 100, onOpen }) {
  const label = { focus: 'Focus', short: 'Short break', long: 'Long break' }[timer.mode]
  return (
    <section className="focus-hud panel" aria-label="Focus timer">
      <button type="button" className="fh-head" onClick={onOpen}>{label}<span aria-hidden="true"> ›</span></button>
      <div className="fh-row">
        <span className="fh-time">{mmss(timer.secs)}</span>
        <button type="button" className={`btn fh-go${timer.running ? ' running' : ''}`} onClick={timer.toggle}>{timer.running ? 'Pause' : timer.secs < timer.total ? 'Resume' : 'Start'}</button>
      </div>
      <div className="fh-today">{todayMins} / {goal} min today</div>
    </section>
  )
}
