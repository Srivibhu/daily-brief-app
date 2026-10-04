import { withAuth } from '../../../lib/auth'
import { sql, dateOnly } from '../../../lib/db'

export default withAuth(async function handler(req, res) {
  const userId = req.userId

  if (req.method === 'GET') {
    // Return last 90 days of focus sessions grouped by date
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const { rows } = await sql`
      SELECT * FROM focus_sessions
      WHERE user_id = ${userId} AND date >= ${since.toISOString().slice(0, 10)}
      ORDER BY date DESC`
    return res.status(200).json(rows.map(dateOnly))
  }

  if (req.method === 'POST') {
    const { date, minutes, completed, task_name, time_of_day, manual } = req.body
    if (!date || !minutes) return res.status(400).json({ error: 'date and minutes required' })
    try {
      const { rows } = await sql`
        INSERT INTO focus_sessions (user_id, date, minutes, completed, task_name, time_of_day, manual)
        VALUES (${userId}, ${date}, ${minutes}, ${!!completed},
                ${task_name || null}, ${time_of_day || null}, ${!!manual})
        RETURNING *`
      return res.status(201).json(dateOnly(rows[0]))
    } catch (error) {
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'DELETE') {
    // Delete a specific session by id
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { rowCount } = await sql`
      DELETE FROM focus_sessions WHERE id = ${id} AND user_id = ${userId}`
    if (!rowCount) return res.status(404).json({ error: 'Session not found' })
    return res.status(204).end()
  }

  return res.status(405).end()
})
