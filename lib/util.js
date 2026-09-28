// ── Dates ─────────────────────────────────────────────────────────────────────
export function dateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
export const todayStr = () => dateStr(new Date())

export function isoWeekYear(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const jan1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return { week: Math.ceil((((date - jan1) / 86400000) + 1) / 7), year: date.getUTCFullYear() }
}

export function fmtMins(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── Task helpers ──────────────────────────────────────────────────────────────
export const statusOf = t => (t.progress === 100 ? 'done' : t.progress > 0 ? 'inprog' : 'todo')
export const progColor = p => (p === 100 ? '#22c55e' : p >= 50 ? '#3b82f6' : p > 0 ? '#f59e0b' : '#333')

export const PRIORITY_CYCLE = [null, 'p1', 'p2', 'p3']
export const PRIORITY_LABELS = { p1: 'P1 High', p2: 'P2 Med', p3: 'P3 Low' }
export const PRIORITY_SORT = { p1: 0, p2: 1, p3: 2, null: 3 }

export function urgencyInfo(due) {
  if (!due) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(due + 'T00:00:00') - today) / 864e5)
  if (diff < 0) return { cls: 'u-overdue', num: Math.abs(diff), label: diff === -1 ? 'Yesterday' : `${Math.abs(diff)}d over`, color: '#ef4444', diff }
  if (diff === 0) return { cls: 'u-today', num: null, label: 'Today', color: '#f59e0b', diff }
  if (diff <= 3) return { cls: 'u-soon', num: diff, label: diff === 1 ? 'Tomorrow' : `${diff}d left`, color: '#f97316', diff }
  if (diff <= 7) return { cls: 'u-upcoming', num: diff, label: `${diff}d left`, color: '#3b82f6', diff }
  return { cls: 'u-later', num: diff, label: `${diff}d left`, color: '#444', diff }
}

export function accentColor(t) {
  if (t.priority === 'p1') return '#ef4444'
  if (t.priority === 'p2') return '#f59e0b'
  if (t.priority === 'p3') return '#3b82f6'
  const u = urgencyInfo(t.due)
  return u ? u.color : 'transparent'
}

// ── Notes (rich text stored as HTML) ──────────────────────────────────────────
export function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

// Remove scripts / event handlers / javascript: URLs from stored note HTML
export function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta,form').forEach(n => n.remove())
  doc.body.querySelectorAll('*').forEach(el => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase()
      if (n.startsWith('on') || ((n === 'href' || n === 'src') && v.startsWith('javascript:'))) el.removeAttribute(a.name)
    }
  })
  return doc.body.firstChild.innerHTML
}

export const TIPS = [
  'Start with your hardest task while energy is highest.',
  'Break big tasks into 25-minute focused sprints.',
  'Done is better than perfect — ship and iterate.',
  'Single-task focus beats multitasking every time.',
  'A 5-min walk resets focus better than coffee.',
  'Review what you finished today — wins compound.',
  'Set a clear finish line before you start a task.',
]
export const PRESET_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#64748b']

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (res.status === 204) return null
  return res.json()
}
