import { useEffect, useRef } from 'react'

// Browser notifications for due dates: overdue, 1 day, 5 hours, 1 hour before
export function useReminders(tasks) {
  const fired = useRef(new Set())
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return
    if (Notification.permission === 'default') Notification.requestPermission()
    function check() {
      if (Notification.permission !== 'granted') return
      const now = Date.now()
      tasks.forEach(t => {
        if (!t.due || t.progress === 100) return
        const diff = new Date(`${t.due}T${(t.due_time || '23:59').slice(0, 5)}:00`).getTime() - now
        const min = diff / 60000
        ;[
          { key: `${t.id}-overdue`, lo: -Infinity, hi: 0, msg: `⚠️ OVERDUE: ${t.name}` },
          { key: `${t.id}-1d`, lo: 23 * 60, hi: 25 * 60, msg: `📅 Due tomorrow: ${t.name}` },
          { key: `${t.id}-5h`, lo: 270, hi: 330, msg: `⏰ Due in 5 hours: ${t.name}` },
          { key: `${t.id}-1h`, lo: 50, hi: 70, msg: `🔔 Due in 1 hour: ${t.name}` },
        ].forEach(({ key, lo, hi, msg }) => {
          if (min >= lo && min <= hi && !fired.current.has(key)) {
            fired.current.add(key); new Notification('Daily Brief', { body: msg })
          }
        })
      })
    }
    check()
    const id = setInterval(check, 60000)
    return () => clearInterval(id)
  }, [tasks])
}
