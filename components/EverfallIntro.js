import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PANELS } from '../lib/intro'
import { critterSprite, onDogPose, setDogState } from '../lib/critters'
import { dogScreenBox, setSceneHighlight } from './SceneBackdrop'

// The dog's speech scroll. It lives in the DOM rather than on the scene canvas: pixel lettering on a
// 3-art-pixel grid is unreadable at this size and invisible to a screen reader.
//
// Two anchors. 'porch' pins the scroll above the porch rail using the same scene placement the
// layout already reads, so it looks like it unrolled where he is sitting. On a phone — and whenever
// the measured dog box is mostly off screen — it drops to a fixed strip above the hotbar with his
// portrait in the corner. That is the storyboard's phone answer: the Tasks pan centres art x 300 and
// he lives at 141, so a porch scroll would either clip him or cover the task list. The portrait is
// what keeps the narrator on screen once a later beat pans the cliff away from the porch.

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const SIT_POSE = /^(dogSit|dogWag)/

// Portrait in the corner of the bottom strip. It follows the pose the scene loop already chose,
// so there is no second clock. Sleeping and head-up frames stay on the porch; the corner holds a
// sitting face so the box still reads as him while he is waking.
function DogFace({ dark }) {
  const ref = useRef(null)
  const pose = useRef('dogSit')
  const draw = useCallback(() => {
    const cv = ref.current
    if (!cv) return
    const src = critterSprite(pose.current, dark, 2)
    cv.width = src.width; cv.height = src.height
    cv.getContext('2d').drawImage(src, 0, 0)
  }, [dark])
  useEffect(() => onDogPose(name => {
    const next = SIT_POSE.test(name) ? name : name.startsWith('dogWake') ? 'dogWake' : 'dogSit'
    if (next === pose.current && ref.current?.width) return
    pose.current = next
    draw()
  }), [draw])
  return <canvas ref={ref} className="is-face" width={48} height={48} aria-hidden="true" />
}

// Is the dog far enough on screen, and clear of the hotbar, to speak from the porch?
function usePorchAnchor(phone) {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (phone) { setOk(false); return }
    const check = () => {
      const b = dogScreenBox()
      // Most of him on screen, with room above the hotbar. A few pixels of clip on the left
      // still counts: the scroll clamps to the viewport edge and points down at the porch.
      setOk(b.seen >= 0.7 && b.y > 140 && b.y + b.h < b.vh - 110)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('db-place', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('db-place', check)
    }
  }, [phone])
  return ok
}

// Tap target over the porch dog. Hidden when the pan has carried him off screen, so a keyboard
// user is never dropped on an invisible control. Phones that can't reach him get the same action
// in the account sheet.
export function DogSpot({ onClick }) {
  const [onScreen, setOnScreen] = useState(false)
  useEffect(() => {
    const check = () => {
      const b = dogScreenBox()
      setOnScreen(b.seen >= 0.5 && b.y > 0 && b.y < b.vh - 90)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('db-place', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('db-place', check)
    }
  }, [])
  if (!onScreen) return null
  return (
    <button type="button" className="dog-spot" onClick={onClick}
      aria-label="The dog on the porch. Show the tour again." title="Show the tour again" />
  )
}

export default function EverfallIntro({
  step, onStep, onEnd, tasks, timerRunning, phone, dark,
  onTab, onSheet, onPreview, onGateMet,
}) {
  const panel = PANELS[step] || PANELS[0]
  const porchOk = usePorchAnchor(phone)
  const where = panel.where === 'porch' && porchOk ? 'porch' : 'bar'
  const reduced = reducedMotion()
  const [bye, setBye] = useState(false)
  const nextBtn = useRef(null)

  // ── the gates ───────────────────────────────────────────────────────────────
  // Read straight off app state. Sticky for this beat once met, so someone who already has a
  // task, or who starts the timer and then pauses it, is never held. `held` is the step index,
  // not a boolean, so arriving at the next gate does not inherit a pass.
  const satisfiedNow = panel.gate === 'task' ? tasks.length > 0 : panel.gate === 'timer' ? !!timerRunning : true
  const [held, setHeld] = useState(-1)
  const ready = !panel.gate || satisfiedNow || held === step
  const was = useRef(false)
  useEffect(() => { was.current = false }, [step])
  useEffect(() => {
    if (!panel.gate || !satisfiedNow || was.current) return
    was.current = true
    setHeld(step)
    onGateMet?.(panel.gate)
  }, [satisfiedNow, step]) // eslint-disable-line
  const lines = useMemo(() => [...panel.lines, ...(ready && panel.gateLines ? panel.gateLines : [])], [panel, ready])

  // ── awake for the whole tour; the scene loop moves his mouth and tail ─────────────────────────
  useEffect(() => {
    setDogState({ awake: true, talking: !reducedMotion() })
    return () => setDogState({ awake: false, talking: false })
  }, [])
  useEffect(() => {
    if (!bye) return
    setDogState({ awake: false, talking: false })
    const id = setTimeout(onEnd, reduced ? 0 : 900)
    return () => clearTimeout(id)
  }, [bye, onEnd, reduced])

  // land the keyboard on Next once a gate opens, and when a beat arrives already satisfied
  useEffect(() => {
    if (panel.gate && ready) nextBtn.current?.focus()
  }, [ready, step]) // eslint-disable-line

  // ── staging: the page he points at, the sheet he opens, the ring on the egg ───────────────────
  useEffect(() => {
    setSceneHighlight(panel.highlight || null)
    if (panel.tab) onTab(panel.tab)
    onSheet(panel.sheet || false)
    return () => setSceneHighlight(null)
  }, [step]) // eslint-disable-line

  // panel 07: run the existing stage preview once through all five, then back to the real stage.
  // Local-only and already labelled "preview". Reduced motion leaves the egg alone — the stage
  // list in the sheet already shows all five without moving.
  useEffect(() => {
    if (!panel.preview || reduced) return
    let i = 0
    onPreview(0)
    const id = setInterval(() => {
      i += 1
      if (i > 4) { clearInterval(id); onPreview(null) } else onPreview(i)
    }, 900)
    return () => { clearInterval(id); onPreview(null) }
  }, [step]) // eslint-disable-line

  // ── what he is pointing at, published for the CSS to pulse ────────────────────────────────────
  useEffect(() => {
    const seq = ready ? null : panel.hintRun
    const set = v => { if (v) document.documentElement.dataset.introHint = v; else delete document.documentElement.dataset.introHint }
    if (!seq) { set(ready ? null : panel.hint || null); return () => set(null) }
    let i = 0
    set(reduced ? seq[seq.length - 1] : seq[0])
    if (reduced) return () => set(null)
    const id = setInterval(() => {
      i += 1
      set(seq[Math.min(i, seq.length - 1)])
      if (i >= seq.length - 1) clearInterval(id)
    }, 1800)
    return () => { clearInterval(id); set(null) }
  }, [step, ready, reduced]) // eslint-disable-line

  const next = useCallback(() => {
    if (!ready || bye) return
    if (step >= PANELS.length - 1) setBye(true)
    else onStep(step + 1)
  }, [ready, bye, step, onStep])

  const waitId = `intro-wait-${panel.id}`
  return (
    <div className={`intro-scroll at-${where}${bye ? ' leaving' : ''}`} role="region" aria-label={`Everfall tour, beat ${step + 1} of ${PANELS.length}`}>
      {where === 'bar' && <DogFace dark={dark} />}
      <div className="is-body">
        <p className="is-who">The dog on the porch<span className="is-count">{step + 1} of {PANELS.length}</span></p>
        <div className="is-lines" aria-live="polite" aria-atomic="true">
          {lines.map(l => <p className="is-line" key={l}>{l}</p>)}
        </div>
        <div className="is-foot">
          {!ready && <span className="is-wait" id={waitId} role="status">{panel.gateWait}</span>}
          <button ref={nextBtn} type="button" className="btn is-next" onClick={next} disabled={!ready}
            aria-describedby={ready ? undefined : waitId}>
            {panel.cta}
          </button>
        </div>
      </div>
    </div>
  )
}
