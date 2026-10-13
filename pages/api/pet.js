import { withAuth } from '../../lib/auth'
import { sql } from '../../lib/db'
import { SKINS, skinById, balances } from '../../lib/shop'

// The pet's identity and the shop. Growth and earnings are computed from focus_sessions and tasks;
// only the name, the equipped skin, owned skins and what's been spent are stored.
//   GET                 -> pet + balances
//   PATCH { name }      -> rename        PATCH { skin } -> wear an owned skin
//   POST  { buy: id }   -> buy a skin (and wear it)

let ready = false
async function ensureTable() {
  if (ready) return
  await sql`CREATE TABLE IF NOT EXISTS pets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    skin TEXT NOT NULL DEFAULT 'bluebird',
    owned TEXT[] NOT NULL DEFAULT '{bluebird}',
    spent_lilies INT NOT NULL DEFAULT 0,
    spent_pearls INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`
  ready = true
}

async function load(userId) {
  await sql`INSERT INTO pets (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`
  const [{ rows: [pet] }, { rows: [f] }, { rows: [t] }] = await Promise.all([
    sql`SELECT * FROM pets WHERE user_id = ${userId}`,
    sql`SELECT COALESCE(SUM(minutes), 0)::int AS minutes FROM focus_sessions WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int AS done FROM tasks WHERE user_id = ${userId} AND progress = 100`,
  ])
  const b = balances({ totalMinutes: f.minutes, tasksDone: t.done, spentLilies: pet.spent_lilies, spentPearls: pet.spent_pearls })
  return { pet, out: { name: pet.name, skin: pet.skin, owned: pet.owned, totalMinutes: f.minutes, tasksDone: t.done, ...b } }
}

export default withAuth(async function handler(req, res) {
  try {
    await ensureTable()
    const userId = req.userId
    const { pet, out } = await load(userId)

    if (req.method === 'GET') return res.status(200).json(out)

    if (req.method === 'PATCH') {
      const { name, skin } = req.body || {}
      if (name !== undefined) {
        const n = String(name).trim().slice(0, 24)
        await sql`UPDATE pets SET name = ${n} WHERE user_id = ${userId}`
        out.name = n
      }
      if (skin !== undefined) {
        if (!pet.owned.includes(skin)) return res.status(400).json({ error: "You don't own that colour yet" })
        await sql`UPDATE pets SET skin = ${skin} WHERE user_id = ${userId}`
        out.skin = skin
      }
      return res.status(200).json(out)
    }

    if (req.method === 'POST') {
      const id = req.body?.buy
      const item = SKINS.find(s => s.id === id)
      if (!item) return res.status(400).json({ error: 'Unknown item' })
      if (pet.owned.includes(id)) return res.status(400).json({ error: 'Already yours' })
      const { lilies, pearls } = item.price
      if (out.lilies < lilies || out.pearls < pearls) return res.status(400).json({ error: 'Not enough lilies or pearls yet' })
      // only applies if nothing was spent in between (no double-spend from two tabs)
      const { rowCount } = await sql`
        UPDATE pets SET spent_lilies = spent_lilies + ${lilies}, spent_pearls = spent_pearls + ${pearls},
               owned = array_append(owned, ${id}), skin = ${id}
        WHERE user_id = ${userId} AND spent_lilies = ${pet.spent_lilies} AND spent_pearls = ${pet.spent_pearls} AND NOT (${id} = ANY(owned))`
      if (!rowCount) return res.status(409).json({ error: 'Something changed, try again' })
      const { out: next } = await load(userId)
      return res.status(200).json({ ...next, bought: skinById(id).name })
    }

    return res.status(405).end()
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})
