import { withAuth } from '../../lib/auth'
import { sql, dateOnly } from '../../lib/db'

export default withAuth(async function handler(req, res) {
  const userId = req.userId

  if (req.method === 'GET') {
    const since = new Date()
    since.setDate(since.getDate() - 60)
    const { rows } = await sql`
      SELECT date, count FROM activity
      WHERE user_id = ${userId} AND date >= ${since.toISOString().slice(0, 10)}`
    return res.status(200).json(rows.map(dateOnly))
  }

  if (req.method === 'POST') {
    // Increment today's activity counter (client supplies its local date)
    const { date } = req.body || {}
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'date required' })
    const { rows } = await sql`
      INSERT INTO activity (user_id, date, count) VALUES (${userId}, ${date}, 1)
      ON CONFLICT (user_id, date) DO UPDATE SET count = activity.count + 1
      RETURNING date, count`
    return res.status(200).json(dateOnly(rows[0]))
  }

  return res.status(405).end()
})
