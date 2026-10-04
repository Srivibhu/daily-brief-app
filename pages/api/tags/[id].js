import { withAuth } from '../../../lib/auth'
import { sql } from '../../../lib/db'

export default withAuth(async function handler(req, res) {
  const { id } = req.query
  const userId = req.userId

  const { rows: found } = await sql`
    SELECT id, user_id FROM tags WHERE id = ${id} AND user_id = ${userId} LIMIT 1`
  if (!found.length) return res.status(404).json({ error: 'Tag not found' })

  if (req.method === 'PUT') {
    const { name, color } = req.body
    try {
      const { rows } = await sql`
        UPDATE tags
        SET name = COALESCE(${name?.trim() ?? null}, name),
            color = COALESCE(${color ?? null}, color)
        WHERE id = ${id}
        RETURNING *`
      return res.status(200).json(rows[0])
    } catch (error) {
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM tags WHERE id = ${id}`
    return res.status(204).end()
  }

  return res.status(405).end()
})
