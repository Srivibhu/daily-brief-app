import { useSyncExternalStore } from 'react'

// Theme lives on <html data-theme="light|dark"> (set before paint by pages/_document.js)
const subs = new Set()
const read = () => document.documentElement.getAttribute('data-theme') || 'light'

export function useTheme() {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb) }, read, () => 'light')
}

export function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
  try { localStorage.setItem('db-theme', t) } catch {}
  subs.forEach(f => f())
}
