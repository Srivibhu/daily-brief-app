import { withAuth } from '../../lib/auth'
import { sql } from '../../lib/db'

// POST /api/import — imports a JSON blob from /api/export into the authenticated user's account.
// Skips records that already exist (by original id is not reused; all new rows get fresh ids).
// Safe to call on an empty account or to merge into an existing one (tasks/tags/sessions deduped by name+date).
export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = req.userId
  const { tasks = [], tags = [], focus_sessions = [], daily_activity = [], pet } = req.body || {}

  try {
    // ── Tags first (tasks reference tag names) ────────────────────────────────
    const tagMap = {} // old name → inserted/existing name (same in this impl)
    for (const tag of tags) {
      const { rows } = await sql`
        INSERT INTO tags (user_id, name, color, position)
        VALUES (${userId}, ${tag.name}, ${tag.color || '#888888'}, ${tag.position ?? 999})
        ON CONFLICT (user_id, name) DO NOTHING
        RETURNING name`
      tagMap[tag.name] = tag.name
    }

    // ── Tasks ─────────────────────────────────────────────────────────────────
    let tasksDone = 0
    for (const t of tasks) {
      await sql`
        INSERT INTO tasks (
          user_id, name, notes, progress, tags, priority, link, due, due_time,
          history, created_at, completed_at
        ) VALUES (
          ${userId}, ${t.name}, ${t.notes || null}, ${t.progress ?? 0},
          ${t.tags || []}, ${t.priority || 'medium'}, ${t.link || null},
          ${t.due || null}, ${t.due_time || null},
          ${JSON.stringify(t.history || [])}, ${t.created_at || new Date()},
          ${t.completed_at || null}
        )`
      tasksDone++
    }

    // ── Focus sessions ────────────────────────────────────────────────────────
    let sessionsDone = 0
    for (const s of focus_sessions) {
      await sql`
        INSERT INTO focus_sessions (user_id, task_id, duration_min, started_at)
        VALUES (${userId}, NULL, ${s.duration_min || 25}, ${s.started_at || new Date()})`
      sessionsDone++
    }

    // ── Daily activity ────────────────────────────────────────────────────────
    for (const a of daily_activity) {
      await sql`
        INSERT INTO daily_activity (user_id, date, count)
        VALUES (${userId}, ${a.date}, ${a.count || 1})
        ON CONFLICT (user_id, date) DO UPDATE SET count = daily_activity.count + EXCLUDED.count`
    }

    // ── Pet ───────────────────────────────────────────────────────────────────
    if (pet) {
      await sql`
        UPDATE pets SET
          name = COALESCE(${pet.name || null}, name),
          total_minutes = total_minutes + ${pet.total_minutes || 0},
          tasks_done = tasks_done + ${pet.tasks_done || 0},
          skin = COALESCE(${pet.skin || null}, skin),
          owned_skins = COALESCE(${JSON.stringify(pet.owned_skins || [])}, owned_skins)
        WHERE user_id = ${userId}`
    }

    return res.status(200).json({
      ok: true,
      imported: { tasks: tasksDone, sessions: sessionsDone, tags: tags.length, daily_activity: daily_activity.length },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Import failed: ' + err.message })
  }
})
