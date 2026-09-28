import { sql } from '@vercel/postgres'

export { sql }

// The driver returns DATE columns as JS Dates (serialized as full ISO timestamps);
// the UI expects plain 'YYYY-MM-DD' strings.
const DATE_FIELDS = ['due', 'created_at', 'completed_at', 'date']

export function dateOnly(row) {
  if (!row) return row
  const out = { ...row }
  for (const k of DATE_FIELDS) {
    const v = out[k]
    if (v instanceof Date) {
      out[k] = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
    }
  }
  return out
}
