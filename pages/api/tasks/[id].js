import { withAuth } from '../../../lib/auth'
import { sql, dateOnly } from '../../../lib/db'
import { cleanLink } from '../../../lib/security'

// Advance a date string by N days
function advanceDays(dateStr, days) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default withAuth(async function handler(req, res) {
  const { id } = req.query
  const userId = req.userId

  // Ownership check
  const { rows } = await sql`
    SELECT * FROM tasks WHERE id = ${id} AND user_id = ${userId} LIMIT 1`
  const existing = dateOnly(rows[0])
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  if (req.method === 'GET') {
    return res.status(200).json(existing)
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const allowed = ['name','notes','progress','tags','priority','link','due','due_time','history',
                     'completed_at','repeat_type','repeat_interval']
    const update = {}
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k]
    if (update.link !== undefined) update.link = cleanLink(update.link)
    if (typeof update.name === 'string' && (!update.name.trim() || update.name.length > 500)) return res.status(400).json({ error: 'Name must be 1 to 500 characters' })
    if (typeof update.notes === 'string' && update.notes.length > 100000) return res.status(400).json({ error: 'Notes are too long' })
    if (update.repeat_type !== undefined && !['none','daily','weekly'].includes(update.repeat_type)) update.repeat_type = 'none'
    if (update.repeat_interval !== undefined) {
      const v = Number(update.repeat_interval)
      update.repeat_interval = (Number.isInteger(v) && v >= 1 && v <= 365) ? v : 1
    }

    // Auto-set completed_at when progress hits 100
    const wasComplete = existing.progress === 100
    if (update.progress === 100 && !existing.completed_at) {
      update.completed_at = new Date().toISOString().slice(0, 10)
    }
    if (update.progress !== undefined && update.progress < 100) {
      update.completed_at = null
    }

    // Merge onto the existing row so omitted fields are kept and explicit nulls are honored
    const m = { ...existing, ...update }
    try {
      const { rows: out } = await sql`
        UPDATE tasks SET
          name = ${m.name}, notes = ${m.notes}, progress = ${m.progress},
          tags = ${m.tags || []}::text[], priority = ${m.priority}, link = ${m.link},
          due = ${m.due}, due_time = ${m.due_time},
          history = ${JSON.stringify(m.history ?? [])}::jsonb,
          completed_at = ${m.completed_at},
          repeat_type = ${m.repeat_type || 'none'},
          repeat_interval = ${m.repeat_interval ?? 1}
        WHERE id = ${id}
        RETURNING *`
      const saved = dateOnly(out[0])

      // Auto-spawn the next occurrence when task just became complete and has a repeat
      let next = null
      if (!wasComplete && saved.progress === 100 && saved.repeat_type !== 'none') {
        const daysToAdd = saved.repeat_type === 'daily'
          ? saved.repeat_interval
          : saved.repeat_interval * 7
        const nextDue = advanceDays(saved.due, daysToAdd)
        const { rows: spawned } = await sql`
          INSERT INTO tasks (user_id, name, notes, tags, priority, link, due, due_time,
                             repeat_type, repeat_interval)
          VALUES (${userId}, ${saved.name}, ${saved.notes || ''}, ${saved.tags || []}::text[],
                  ${saved.priority}, ${saved.link || ''}, ${nextDue}, ${saved.due_time || null},
                  ${saved.repeat_type}, ${saved.repeat_interval})
          RETURNING *`
        next = dateOnly(spawned[0])
      }

      return res.status(200).json(next ? { ...saved, _next: next } : saved)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'Something went wrong' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${userId}`
      return res.status(204).end()
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'Could not delete the task' })
    }
  }

  return res.status(405).end()
})
