import { withAuth } from '../../../lib/auth'
import { sql } from '../../../lib/db'

export default withAuth(async function handler(req, res) {
  const userId = req.userId

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT * FROM tags WHERE user_id = ${userId} ORDER BY name`
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const { name, color } = req.body
    if (!name || !color) return res.status(400).json({ error: 'Name and color required' })
    try {
      const { rows } = await sql`
        INSERT INTO tags (user_id, name, color)
        VALUES (${userId}, ${name.trim()}, ${color})
        RETURNING *`
      return res.status(201).json(rows[0])
    } catch {
      return res.status(409).json({ error: 'Tag name already exists' })
    }
  }

  return res.status(405).end()
})
