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
    })),
  )
}

const analytics = (rows: TimedResult[]) => computePlayerAnalytics(rows, 'all')!

describe('comparePlayers', () => {
  it('separa las pistas donde cada uno es mejor, de mayor a menor ventaja', () => {
    const a = analytics(runs('a', { LC: [1, 1], RR: [8, 8], DS: [5, 5] }))
    const b = analytics(runs('b', { LC: [6, 6], RR: [2, 2], DS: [5, 5] }))
    const c = comparePlayers(a, b)
    expect(c.aBetter.map((d) => d.trackId)).toEqual(['LC'])
    expect(c.bBetter.map((d) => d.trackId)).toEqual(['RR'])
    expect(c.duels.map((d) => d.trackId)).toEqual(['LC', 'DS', 'RR'])
    // 1.º = 15 puntos y 6.º = 7 puntos
    expect(c.aBetter[0].diff).toBe(8)
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
