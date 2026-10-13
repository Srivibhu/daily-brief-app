import { useEffect, useRef, useState } from 'react'
import { PetPortrait } from './PetCard'

// The focus timer's mascot: your pet (egg, chick, fledgling or adult, in its current colours).
// While a focus session runs it bobs and flaps, on breaks it naps, and it sings when a session ends.
export default function PetTimer({ stage, skin, mode, running, secs, total, count, scale = 7 }) {
  const [f, setF] = useState(0)
  const [cheer, setCheer] = useState(0)
  const last = useRef(count)
  useEffect(() => { if (count > last.current) setCheer(12); last.current = count }, [count])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!running && !cheer) return
    const id = setInterval(() => { setF(x => x + 1); setCheer(c => Math.max(0, c - 1)) }, 250)
    return () => clearInterval(id)
  }, [running, cheer > 0]) // eslint-disable-line

  const chick = stage === 'hatchling', egg = stage === 'egg' || stage === 'cracking'
  const pose = cheer ? (chick ? 'Peep' : 'Sing') : mode !== 'focus' ? 'Sleep' : running ? (f % 4 < 2 ? (chick ? 'Peep' : 'Flap') : '') : ''
  const done = total ? 1 - secs / total : 0
  const SEG = 12, lit = Math.round(done * SEG)

  return (
    <div className={`pet-timer${running ? ' running' : ''}${egg ? ' egg' : ''}${cheer ? ' cheer' : ''}`} role="img"
      aria-label={`${running ? 'Running' : 'Paused'} timer, ${Math.round(done * 100)}% through`}>
      <div className="pt-stage">
        <div className="pt-pet" style={{ transform: running && f % 2 ? `translateY(-${scale}px)` : undefined }}>
          <PetPortrait stage={stage} mood={mode !== 'focus' ? 'sleepy' : 'content'} skin={skin} pose={pose} scale={scale} />
        </div>
        <div className="pt-perch" />
      </div>
      <div className="pt-bar" aria-hidden="true">{Array.from({ length: SEG }, (_, i) => <i key={i} className={i < lit ? 'on' : ''} />)}</div>
    </div>
  )
}
