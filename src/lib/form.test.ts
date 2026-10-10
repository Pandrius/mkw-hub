import { describe, expect, it } from 'vitest'
import { sortTimeline, streakOf, type TimedResult } from './form'

/** Un evento de carreras seguidas con las posiciones dadas */
function event(id: string, date: string, positions: number[], kind: 'war' | 'lounge' = 'war', track = (i: number) => `t${i}`): TimedResult[] {
  return positions.map((position, i) => ({
    eventId: id,
    kind,
    trackId: track(i),
    position,
    raceNo: i + 1,
    date,
    racers: kind === 'war' ? 12 : null,
  }))
}

describe('streakOf', () => {
  it('cuenta la racha actual y la mejor', () => {
    expect(streakOf([1, 1, 0, 1, 1, 1, 0, 1], (x) => x === 1)).toEqual({ current: 1, best: 3 })
    expect(streakOf([], () => true)).toEqual({ current: 0, best: 0 })
  })
})

describe('sortTimeline', () => {
  it('ordena por fecha del evento y número de carrera', () => {
    const rows = [...event('b', '2026-10-02T10:00:00Z', [5, 6]), ...event('a', '2026-10-01T10:00:00Z', [1, 2])].reverse()
    expect(sortTimeline(rows).map((r) => r.position)).toEqual([1, 2, 5, 6])
  })
})
