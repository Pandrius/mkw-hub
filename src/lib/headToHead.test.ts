import { describe, expect, it } from 'vitest'
import type { TimedResult } from './form'
import { headToHead } from './headToHead'

const r = (eventId: string, raceNo: number, position: number): TimedResult => ({ eventId, kind: 'war', trackId: 't', position, raceNo, date: '2026-10-01T10:00:00Z', racers: 12, verified: true })

describe('headToHead', () => {
  it('null si nunca coincidieron', () => {
    expect(headToHead([r('a', 1, 1)], [r('b', 1, 2)])).toBeNull()
  })

  it('cuenta eventos ganados, carreras por delante y puntos en las carreras comunes', () => {
    const a = [r('e1', 1, 1), r('e1', 2, 5), r('e2', 1, 4), r('e3', 1, 3), r('solo', 1, 1)]
    const b = [r('e1', 1, 2), r('e1', 2, 6), r('e2', 1, 2), r('e3', 1, 3)]
    const h = headToHead(a, b)!
    expect(h).toMatchObject({ events: 3, aWins: 1, bWins: 1, ties: 1, races: 4, aAhead: 2, bAhead: 1 })
    expect(h.aPoints).toBe(10.5) // (15+8+9+10) / 4
    expect(h.bPoints).toBe(10.25) // (12+7+12+10) / 4
  })

  it('ignora las carreras que solo corrió uno de los dos', () => {
    const h = headToHead([r('e', 1, 1), r('e', 2, 1)], [r('e', 2, 12)])!
    expect(h.races).toBe(1)
    expect(h.aWins).toBe(1)
  })
})
