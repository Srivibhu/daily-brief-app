import { withAuth } from '../../lib/auth'
import { sql, dateOnly } from '../../lib/db'

// GET /api/export — returns all data for the authenticated user as JSON.
// Used to back up and migrate account data.
export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const userId = req.userId

  try {
    const [tasks, tags, sessions, activity, pet] = await Promise.all([
      sql`SELECT * FROM tasks WHERE user_id = ${userId} ORDER BY created_at ASC`,
      sql`SELECT * FROM tags WHERE user_id = ${userId} ORDER BY position ASC`,
      sql`SELECT * FROM focus_sessions WHERE user_id = ${userId} ORDER BY started_at ASC`,
      sql`SELECT * FROM daily_activity WHERE user_id = ${userId} ORDER BY date ASC`,
      sql`SELECT * FROM pets WHERE user_id = ${userId} LIMIT 1`,
    ])

    return res.status(200).json({
      exported_at: new Date().toISOString(),
      tasks: tasks.rows.map(dateOnly),
      tags: tags.rows,
      focus_sessions: sessions.rows,
      daily_activity: activity.rows.map(dateOnly),
      pet: pet.rows[0] || null,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Export failed' })
  }
})
