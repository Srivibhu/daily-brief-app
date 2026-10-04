import { useEffect, useRef } from 'react'
import { useTheme } from '../lib/theme'

// Builds a Chart.js chart on a canvas; rebuilt whenever `deps` or the theme change.
// Colours are read from the canvas's own computed CSS variables, so a chart inside a
// moss-green panel picks up that panel's palette. chart.js loads lazily (no SSR DOM access).
function useChart(makeConfig, deps) {
  const ref = useRef(null)
  const theme = useTheme()
  useEffect(() => {
    let chart, dead = false
    import('chart.js/auto').then(({ default: Chart }) => {
      if (dead || !ref.current) return
      const cs = getComputedStyle(ref.current)
      chart = new Chart(ref.current, makeConfig(name => cs.getPropertyValue(name).trim()))
    })
    return () => { dead = true; if (chart) chart.destroy() }
  }, [...deps, theme]) // eslint-disable-line react-hooks/exhaustive-deps
  return ref
}

const tooltip = v => ({ backgroundColor: v('--tip-bg'), titleColor: v('--tip-sub'), bodyColor: v('--tip-text'), borderColor: v('--tip-line'), borderWidth: 1 })
const tick = v => ({ font: { size: 9, family: 'Arial' }, color: v('--sub') })

export function Donut({ done, inprog, todo }) {
  const ref = useChart(v => ({
    type: 'doughnut',
    data: {
      labels: ['Done', 'In Progress', 'To Do'],
      datasets: [{ data: [done, inprog, todo || (!done && !inprog ? 1 : 0)], backgroundColor: [v('--m-main'), v('--m-soft'), v('--s4')], borderWidth: 0, hoverOffset: 3 }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '74%', animation: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltip(v), callbacks: { label: c => `${c.label}: ${c.raw}` } } } },
  }), [done, inprog, todo])
  return <canvas ref={ref} />
}

export function WeekBars({ labels, data }) {
  const ref = useChart(v => ({
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: v('--m-soft') + 'cc', borderColor: v('--m-main'), borderWidth: 1, borderRadius: 3, hoverBackgroundColor: v('--m-main') }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltip(v), callbacks: { label: c => `${c.raw} min` } } },
      scales: {
        y: { ticks: { ...tick(v), callback: val => val + 'm' }, grid: { color: v('--b2') }, border: { color: v('--b2') }, beginAtZero: true },
        x: { ticks: tick(v), grid: { display: false }, border: { color: v('--b2') } },
      } },
  }), [labels.join('|'), data.join('|')])
  return <canvas ref={ref} />
}

export function MiniLine({ labels, data }) {
  const ref = useChart(v => ({
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: v('--blue'), backgroundColor: v('--blue') + '22', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: v('--blue'), fill: true, tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltip(v), callbacks: { label: c => `${c.parsed.y}%` } } },
      scales: {
        y: { min: 0, max: 100, ticks: { ...tick(v), stepSize: 50, callback: val => val + '%' }, grid: { color: v('--b2') }, border: { color: v('--b2') } },
        x: { ticks: tick(v), grid: { display: false }, border: { color: v('--b2') } },
      } },
  }), [labels.join('|'), data.join('|')])
  return <canvas ref={ref} />
}
