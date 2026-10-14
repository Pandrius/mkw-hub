import { describe, expect, it } from 'vitest'
import type { TimedResult } from './form'
import { computePlayerAnalytics } from './playerAnalytics'
import { comparePlayers } from './playerCompare'

/** Un jugador que corre una pista las veces indicadas con las posiciones dadas */
function runs(player: string, tracks: Record<string, number[]>): TimedResult[] {
  let n = 0
  return Object.entries(tracks).flatMap(([trackId, positions]) =>
    positions.map((position) => ({
      eventId: `${player}-${n}`,
      kind: 'war' as const,
      trackId,
      position,
      raceNo: (n++ % 12) + 1,
      date: `2026-10-${String(10 + Math.floor(n / 12)).padStart(2, '0')}T10:00:00Z`,
      racers: 12,

      verified: true,
    })),
  )
}

const analytics = (rows: TimedResult[]) => computePlayerAnalytics(rows, 'all')!

describe('comparePlayers', () => {
  it('separa las pistas donde cada uno es mejor, de mayor a menor ventaja', () => {
    const rep = (pos: number) => Array(20).fill(pos)
    const a = analytics(runs('a', { LC: rep(1), RR: rep(8), DS: rep(5) }))
    const b = analytics(runs('b', { LC: rep(6), RR: rep(2), DS: rep(5) }))
    const c = comparePlayers(a, b)
    expect(c.aBetter.map((d) => d.trackId)).toEqual(['LC'])
    expect(c.bBetter.map((d) => d.trackId)).toEqual(['RR'])
    expect(c.duels.map((d) => d.trackId)).toEqual(['LC', 'DS', 'RR'])
    expect(c.duels.find((d) => d.trackId === 'DS')!.diff).toBe(0)
  })

  it('con pocas carreras la ventaja pesa mucho menos que con muchas', () => {
    // En LC, a saca 1.º y 1.º (15 pts) frente a 6.º (7 pts) de b en 30 carreras: en bruto son 8 puntos de ventaja
    const a = analytics(runs('a', { LC: [1, 1], RR: Array(30).fill(6) }))
    const b = analytics(runs('b', { LC: Array(30).fill(6), RR: Array(30).fill(6) }))
    const lc = comparePlayers(a, b).duels.find((d) => d.trackId === 'LC')!
    expect(lc.aPoints - lc.bPoints).toBe(8)
    expect(lc.diff).toBeGreaterThan(0)
    expect(lc.diff).toBeLessThan(2)
  })

  it('ignora pistas sin carreras suficientes de alguno de los dos', () => {
    const a = analytics(runs('a', { LC: [1, 1], RR: [1] }))
    const b = analytics(runs('b', { LC: [3, 3], RR: [12, 12], DS: [1, 1] }))
    const c = comparePlayers(a, b)
    expect(c.duels.map((d) => d.trackId)).toEqual(['LC'])
  })

  it('una diferencia pequeña cuenta como empate', () => {
    const a = analytics(runs('a', { LC: [5, 5] }))
    const b = analytics(runs('b', { LC: [5, 5] }))
    const c = comparePlayers(a, b)
    expect(c.duels).toHaveLength(1)
    expect(c.aBetter).toHaveLength(0)
    expect(c.bBetter).toHaveLength(0)
  })

  it('sin pistas en común no hay duelos', () => {
    const a = analytics(runs('a', { LC: [1, 1] }))
    const b = analytics(runs('b', { RR: [1, 1] }))
    expect(comparePlayers(a, b).duels).toEqual([])
  })
})
