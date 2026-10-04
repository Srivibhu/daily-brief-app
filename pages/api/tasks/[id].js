import { withAuth } from '../../../lib/auth'
import { sql, dateOnly } from '../../../lib/db'

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
    const allowed = ['name','notes','progress','tags','priority','link','due','due_time','history','completed_at']
    const update = {}
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k]
    // Auto-set completed_at when progress hits 100
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
          completed_at = ${m.completed_at}
        WHERE id = ${id}
        RETURNING *`
      return res.status(200).json(dateOnly(out[0]))
    } catch (error) {
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM tasks WHERE id = ${id}`
    return res.status(204).end()
  }

  return res.status(405).end()
})
