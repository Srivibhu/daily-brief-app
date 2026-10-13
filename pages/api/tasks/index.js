import { withAuth } from '../../../lib/auth'
import { cleanLink } from '../../../lib/security'
import { sql, dateOnly } from '../../../lib/db'

export default withAuth(async function handler(req, res) {
  const userId = req.userId

  if (req.method === 'GET') {
    try {
      const { rows } = await sql`
        SELECT * FROM tasks WHERE user_id = ${userId} ORDER BY created_at DESC`
      return res.status(200).json(rows.map(dateOnly))
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'Something went wrong' })
    }
  }

  if (req.method === 'POST') {
    const { name, notes, progress, tags, priority, link, due, due_time, history } = req.body
    if (!name || typeof name !== 'string' || name.length > 500) return res.status(400).json({ error: 'Name must be 1 to 500 characters' })
    try {
      const { rows } = await sql`
        INSERT INTO tasks (user_id, name, notes, progress, tags, priority, link, due, due_time, history)
        VALUES (${userId}, ${name}, ${notes || ''}, ${progress || 0},
                ${tags || []}::text[], ${priority || null}, ${cleanLink(link)},
                ${due || null}, ${due_time || null}, ${JSON.stringify(history || [])}::jsonb)
        RETURNING *`
      return res.status(201).json(dateOnly(rows[0]))
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'Something went wrong' })
    }
  }

  return res.status(405).end()
})
