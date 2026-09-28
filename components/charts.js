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

// Palette comes from the CSS variables so charts follow the page theme
const v = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const tooltip = () => ({ backgroundColor: v('--s1'), titleColor: v('--sub'), bodyColor: v('--text'), borderColor: v('--b1'), borderWidth: 1 })
const tick = () => ({ font: { size: 9, family: 'Arial' }, color: v('--sub') })

export function Donut({ done, inprog, todo }) {
  const ref = useChart(() => ({
    type: 'doughnut',
    data: {
      labels: ['Done', 'In Progress', 'To Do'],
      datasets: [{ data: [done, inprog, todo || (!done && !inprog ? 1 : 0)], backgroundColor: [v('--green'), v('--amber'), v('--s4')], borderWidth: 0, hoverOffset: 3 }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '74%', animation: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: c => `${c.label}: ${c.raw}` } } } },
  }), [done, inprog, todo])
  return <canvas ref={ref} />
}

export function WeekBars({ labels, data }) {
  const ref = useChart(() => ({
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: v('--purple') + 'a6', borderColor: v('--purple'), borderWidth: 1, borderRadius: 2, hoverBackgroundColor: v('--purple') }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: c => `${c.raw} min` } } },
      scales: {
        y: { ticks: { ...tick(), callback: v => v + 'm' }, grid: { color: v('--b2') }, border: { color: v('--b2') }, beginAtZero: true },
        x: { ticks: tick(), grid: { display: false }, border: { color: v('--b2') } },
      } },
  }), [labels.join('|'), data.join('|')])
  return <canvas ref={ref} />
}

export function MiniLine({ labels, data }) {
  const ref = useChart(() => ({
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: v('--blue'), backgroundColor: v('--blue') + '14', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: v('--blue'), fill: true, tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: c => `${c.parsed.y}%` } } },
      scales: {
        y: { min: 0, max: 100, ticks: { ...tick(), stepSize: 50, callback: v => v + '%' }, grid: { color: v('--b2') }, border: { color: v('--b2') } },
        x: { ticks: tick(), grid: { display: false }, border: { color: v('--b2') } },
      } },
  }), [labels.join('|'), data.join('|')])
  return <canvas ref={ref} />
}
