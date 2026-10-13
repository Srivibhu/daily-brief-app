// The Everfall intro: eight beats narrated by the dog on the porch. He wakes up, names the place,
// shows you the egg, gets one real quest out of you, starts one real pomodoro, explains what lilies
// and pearls are for, and goes back to sleep. Script and staging per the approved storyboard.
//
// Two of the beats are gates: panel 04 waits for a task to exist and panel 05 waits for the timer to
// actually be running, both read off real app state rather than a local flag. There is no Skip.
//
// Nothing here grants anything. Panel 06 opens a shop you cannot buy from yet and panel 07 runs the
// existing stage preview, so the 3/6/25/75 focus-hour curve and the derived balances are untouched.

export const PANELS = [
  {
    id: 'wake',
    where: 'porch',
    tab: 'tasks',
    lines: ["Oh — hello. Didn't hear you come up the path."],
    cta: 'Show me around',
  },
  {
    id: 'land',
    where: 'porch',
    tab: 'tasks',
    lines: [
      "Welcome to Everfall. People come here to get a bit better at things. Slowly — the waterfall's been at it a while.",
      "I'm the one on the porch. I'll show you around, then I'm going back to sleep.",
    ],
    cta: 'Next',
  },
  {
    id: 'egg',
    where: 'porch',
    tab: 'tasks',
    // the glass lantern-house next door, SCENE.egg's own coordinates
    highlight: { cx: 372, cy: 363, rx: 26, ry: 31 },
    lines: [
      'See the lantern-house next door? The egg in it is yours.',
      "It doesn't hatch for treats or taps. It hatches for focus time. Real hours.",
    ],
    cta: 'Next',
  },
  {
    id: 'quest',
    where: 'bar',
    tab: 'tasks',
    hint: 'plus',
    gate: 'task',
    gateWait: 'Waiting for your first quest. Press N, or the green plus.',
    lines: ['Start with one thing you actually have to do today. The green plus, down on the bar.'],
    gateLines: ["…there it is. A quest on parchment. Mark it off when it's done — you'll feel it."],
    cta: 'Next',
  },
  {
    id: 'clock',
    where: 'bar',
    tab: 'focus',
    hint: 'start',
    hintRun: ['modes', 'dots', 'link', 'start'],
    gate: 'timer',
    gateWait: 'Waiting for the timer to start.',
    lines: [
      'Now the clock by the falls. Twenty-five minutes, then a short break.',
      "Four of those and you earn a long one — that's what the little squares are counting.",
      'Link it to the quest you just wrote, so the time lands somewhere.',
      "Go on, press start. I'll wait. I'm good at waiting.",
    ],
    cta: 'Next',
  },
  {
    id: 'shop',
    where: 'bar',
    sheet: 'shop',
    lines: [
      'Every hour you focus, the pool gives up ten water lilies. Every three quests you finish, a bag of pearls.',
      "Spend them in the shop, on colours for your bird. That's all they're for. Nobody here sells you time.",
    ],
    cta: 'Next',
  },
  {
    id: 'grows',
    where: 'bar',
    sheet: 'stages',
    preview: true,
    lines: [
      "Three hours and the shell cracks. Six and you'll have a chick — that's when you get to name it.",
      "Seventy-five and it'll be singing off the glass roof at dawn. I'll sleep through that bit.",
    ],
    cta: 'Next',
  },
  {
    id: 'sleep',
    where: 'porch',
    tab: 'tasks',
    lines: ['That\u2019s the tour. Tap me if you forget any of it.'],
    cta: 'Thanks',
  },
]

// Replaying from the dog starts at the welcome rather than making him act surprised again.
export const REPLAY_FROM = 1

// ── "has seen it" ─────────────────────────────────────────────────────────────
// Storyboard decision 6 puts this timestamp on the pets table so it carries between devices. That
// needs a column on `pets` and a field on /api/pet, both of which are out of scope for this pass, so
// for now the marker is local and the "is this account brand new" test below does the work decision 6
// was really after: an existing user cannot be ambushed on a new device, because having any task,
// any session or any logged minute disqualifies them.
const KEY = 'db-everfall-intro'

export function introSeen() {
  try { return !!localStorage.getItem(KEY) } catch { return false }
}
export function markIntroSeen() {
  try { localStorage.setItem(KEY, new Date().toISOString()) } catch {}
}

// A new account: nothing written, nothing focused, nothing finished, ever.
export function accountIsNew({ tasks, sessions, petData }) {
  if (!petData) return false            // totals not in yet — don't guess
  return !tasks.length && !sessions.length && !petData.totalMinutes && !petData.tasksDone
}
