import { useState } from 'react'
import { SKINS, LILIES_PER_HOUR, TASKS_PER_PEARL } from '../lib/shop'
import { PetPortrait } from './PetCard'
import { LilyIcon, PearlIcon } from './Wallet'

// The shop: spend water lilies (focus time) and pearls (finished tasks) on colours for the bird.
// Lives as a tab of the pet panel.
export default function ShopBody({ pet, petData, onBuy, onWear }) {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const d = petData || { lilies: 0, pearls: 0, owned: ['bluebird'], skin: 'bluebird', totalMinutes: 0, tasksDone: 0 }
  // show the bird as it looks now; before it hatches, show the grown-up colours so you know what you're buying
  const stage = pet.idx >= 2 ? pet.stage.key : 'adult'
  const minsToLily = 6 - (d.totalMinutes % 6)
  const tasksToPearl = TASKS_PER_PEARL - (d.tasksDone % TASKS_PER_PEARL)

  async function act(fn, id) {
    setBusy(id); setMsg(null)
    const r = await fn(id)
    setBusy(null)
    if (r?.error) setMsg({ ok: false, text: r.error })
    else if (r?.bought) setMsg({ ok: true, text: `${r.bought} is yours. Wearing it now.` })
  }

  return (
      <div className="shop-body">
        <div className="shop-wallet">
          <p><b>{LILIES_PER_HOUR} lilies</b> for every hour of focus (next in {minsToLily} min). <b>1 bag of pearls</b> for every {TASKS_PER_PEARL} tasks you finish (next in {tasksToPearl}).</p>
        </div>
        {msg && <p className={`acct-msg${msg.ok ? ' ok' : ''}`} role="status">{msg.text}</p>}
        <ul className="shop-grid">
          {SKINS.map(sk => {
            const owned = d.owned.includes(sk.id), wearing = d.skin === sk.id
            const afford = d.lilies >= sk.price.lilies && d.pearls >= sk.price.pearls
            return (
              <li key={sk.id} className={`shop-item${wearing ? ' wearing' : ''}`}>
                <div className="shop-art"><PetPortrait stage={stage} mood="content" skin={sk.id} scale={4} /></div>
                <div className="shop-name">{sk.name}</div>
                <div className="shop-price">
                  {owned ? <span>Owned</span> : !sk.price.lilies && !sk.price.pearls ? <span>Free</span> : <>
                    {sk.price.lilies > 0 && <span className="w-item"><LilyIcon />{sk.price.lilies}</span>}
                    {sk.price.pearls > 0 && <span className="w-item"><PearlIcon />{sk.price.pearls}</span>}
                  </>}
                </div>
                {wearing ? <button className="btn shop-btn" disabled>Wearing</button>
                  : owned ? <button className="btn shop-btn ghost" disabled={busy === sk.id} onClick={() => act(onWear, sk.id)}>Wear</button>
                  : <button className="btn shop-btn" disabled={!afford || busy === sk.id} onClick={() => act(onBuy, sk.id)} title={afford ? '' : 'Not enough yet'}>{busy === sk.id ? '…' : 'Buy'}</button>}
              </li>
            )
          })}
        </ul>
      </div>
  )
}
