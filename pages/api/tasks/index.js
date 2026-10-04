import { withAuth } from '../../../lib/auth'
import { sql, dateOnly } from '../../../lib/db'

export default withAuth(async function handler(req, res) {
  const userId = req.userId

  if (req.method === 'GET') {
    try {
      const { rows } = await sql`
        SELECT * FROM tasks WHERE user_id = ${userId} ORDER BY created_at DESC`
      return res.status(200).json(rows.map(dateOnly))
    } catch (error) {
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'POST') {
    const { name, notes, progress, tags, priority, link, due, due_time, history } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    try {
      const { rows } = await sql`
        INSERT INTO tasks (user_id, name, notes, progress, tags, priority, link, due, due_time, history)
        VALUES (${userId}, ${name}, ${notes || ''}, ${progress || 0},
                ${tags || []}::text[], ${priority || null}, ${link || ''},
                ${due || null}, ${due_time || null}, ${JSON.stringify(history || [])}::jsonb)
        RETURNING *`
      return res.status(201).json(dateOnly(rows[0]))
    } catch (error) {
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(405).end()
})
