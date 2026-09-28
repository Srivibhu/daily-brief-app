import { useEffect, useRef } from 'react'

// Builds a Chart.js chart on a canvas; rebuilt whenever `deps` change.
// chart.js is imported lazily so nothing touches the DOM during SSR.
function useChart(makeConfig, deps) {
  const ref = useRef(null)
  useEffect(() => {
    let chart, dead = false
    import('chart.js/auto').then(({ default: Chart }) => {
      if (dead || !ref.current) return
      chart = new Chart(ref.current, makeConfig())
    })
    return () => { dead = true; if (chart) chart.destroy() }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return ref
}

const TOOLTIP = { backgroundColor: '#161616', titleColor: '#555', bodyColor: '#e8e8e8', borderColor: '#2a2a2a', borderWidth: 1 }
const TICK = { font: { size: 9, family: 'Arial' }, color: '#444' }

export function Donut({ done, inprog, todo }) {
  const ref = useChart(() => ({
    type: 'doughnut',
    data: {
      labels: ['Done', 'In Progress', 'To Do'],
      datasets: [{ data: [done, inprog, todo || (!done && !inprog ? 1 : 0)], backgroundColor: ['#22c55e', '#f59e0b', '#1e1e1e'], borderWidth: 0, hoverOffset: 3 }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '74%', animation: false,
      plugins: { legend: { display: false }, tooltip: { ...TOOLTIP, callbacks: { label: c => `${c.label}: ${c.raw}` } } } },
  }), [done, inprog, todo])
  return <canvas ref={ref} />
}

export function WeekBars({ labels, data }) {
  const ref = useChart(() => ({
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: 'rgba(167,139,250,0.65)', borderColor: '#a78bfa', borderWidth: 1, borderRadius: 2, hoverBackgroundColor: '#a78bfa' }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { ...TOOLTIP, callbacks: { label: c => `${c.raw} min` } } },
      scales: {
        y: { ticks: { ...TICK, callback: v => v + 'm' }, grid: { color: '#161616' }, border: { color: '#161616' }, beginAtZero: true },
        x: { ticks: TICK, grid: { display: false }, border: { color: '#161616' } },
      } },
  }), [labels.join('|'), data.join('|')])
  return <canvas ref={ref} />
}

export function MiniLine({ labels, data }) {
  const ref = useChart(() => ({
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.06)', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: '#3b82f6', fill: true, tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { ...TOOLTIP, callbacks: { label: c => `${c.parsed.y}%` } } },
      scales: {
        y: { min: 0, max: 100, ticks: { ...TICK, stepSize: 50, callback: v => v + '%' }, grid: { color: '#161616' }, border: { color: '#161616' } },
        x: { ticks: TICK, grid: { display: false }, border: { color: '#161616' } },
      } },
  }), [labels.join('|'), data.join('|')])
  return <canvas ref={ref} />
}
