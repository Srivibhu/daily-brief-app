// The shop: what focus and finished tasks earn, and the bird colours they buy.
// Shared by the API (prices, balances) and the UI (swatches, sprites). No DOM in here.

export const LILIES_PER_HOUR = 10   // 10 water lilies for every hour of focus
export const TASKS_PER_PEARL = 3    // 1 bag of pearls for every 3 tasks completed

export const earnedLilies = totalMinutes => Math.floor((totalMinutes || 0) * LILIES_PER_HOUR / 60)
export const earnedPearls = tasksDone => Math.floor((tasksDone || 0) / TASKS_PER_PEARL)

// colours: body / dark (wings, tail) / light (crest highlight) / belly / beak; chick colours follow the body
export const SKINS = [
  { id: 'bluebird', name: 'Bluebird', price: { lilies: 0, pearls: 0 }, c: { body: '#5f9bd1', dark: '#3b6f9f', light: '#9cc6ea', belly: '#f3c08c', beak: '#e8902e' }, chick: { body: '#f5d454', light: '#fdeb98', dark: '#d9a92c' } },
  { id: 'robin', name: 'Robin', price: { lilies: 30, pearls: 0 }, c: { body: '#7c6a58', dark: '#54473a', light: '#a8957f', belly: '#d8613a', beak: '#e8b02e' }, chick: { body: '#c9b08e', light: '#e6d4b8', dark: '#9c8466' } },
  { id: 'goldfinch', name: 'Goldfinch', price: { lilies: 45, pearls: 0 }, c: { body: '#f2cd36', dark: '#2f2c27', light: '#fae88a', belly: '#f6ecbd', beak: '#e89a3a' }, chick: { body: '#f8e06a', light: '#fdf2b4', dark: '#cfae2c' } },
  { id: 'jay', name: 'Blue Jay', price: { lilies: 60, pearls: 1 }, c: { body: '#3d6fd6', dark: '#1f3f8f', light: '#8fb4f2', belly: '#e7edf6', beak: '#2b2b33' }, chick: { body: '#a9c4f0', light: '#d9e6fa', dark: '#6d90cf' } },
  { id: 'cardinal', name: 'Cardinal', price: { lilies: 0, pearls: 2 }, c: { body: '#c8322b', dark: '#8a1f1a', light: '#ec6d62', belly: '#d9493d', beak: '#f2a63a' }, chick: { body: '#ee8d80', light: '#f8c4bc', dark: '#c35c50' } },
  { id: 'snowdrop', name: 'Snowdrop', price: { lilies: 0, pearls: 3 }, c: { body: '#eceff2', dark: '#b3bcc6', light: '#ffffff', belly: '#f7f2e6', beak: '#e8a33a' }, chick: { body: '#f4f4ee', light: '#ffffff', dark: '#c9cdd2' } },
  { id: 'midnight', name: 'Midnight', price: { lilies: 0, pearls: 5 }, c: { body: '#2c3150', dark: '#161a2c', light: '#6870a2', belly: '#a3abdc', beak: '#f2c442' }, chick: { body: '#6a71a0', light: '#a8aed6', dark: '#3c4270' } },
  { id: 'sunset', name: 'Sunset', price: { lilies: 120, pearls: 4 }, c: { body: '#ff8a3d', dark: '#c2502a', light: '#ffc46e', belly: '#ffe2a4', beak: '#8a3a20' }, chick: { body: '#ffb36e', light: '#ffd9a8', dark: '#d97a3c' } },
]
export const skinById = id => SKINS.find(s => s.id === id) || SKINS[0]

export function balances({ totalMinutes, tasksDone, spentLilies = 0, spentPearls = 0 }) {
  const el = earnedLilies(totalMinutes), ep = earnedPearls(tasksDone)
  return { earnedLilies: el, earnedPearls: ep, lilies: Math.max(0, el - spentLilies), pearls: Math.max(0, ep - spentPearls) }
}
