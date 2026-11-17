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
    const nextName = typeof name === 'string' ? name.trim() : null
    try {
      const { rows: before } = await sql`SELECT name FROM tags WHERE id = ${id} AND user_id = ${userId}`
      const oldName = before[0]?.name
      const { rows } = await sql`
        UPDATE tags
        SET name = COALESCE(${nextName}, name),
            color = COALESCE(${color ?? null}, color)
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *`
      // Tasks keep the category as a copy of the name, not a link to the tag.
      // A rename has to rewrite that copy or the stack heading stays on the old name.
      if (oldName && nextName && nextName !== oldName) {
        await sql`
          UPDATE tasks
          SET tags = array_replace(tags, ${oldName}, ${nextName})
          WHERE user_id = ${userId} AND ${oldName} = ANY(tags)`
      }
      return res.status(200).json(rows[0])
    } catch (error) {
      console.error(error)
      const taken = error?.code === '23505'
      return res.status(taken ? 409 : 500).json({ error: taken ? 'Tag name already exists' : 'Something went wrong' })
    }
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM tags WHERE id = ${id}`
    return res.status(204).end()
  }

  return res.status(405).end()
})
