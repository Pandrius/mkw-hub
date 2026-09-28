import { describe, expect, it } from 'vitest'
import type { PlayerResult } from './events'
import { bestAndWorst, computeStats } from './stats'

const r = (track_id: string, position: number, kind: 'war' | 'lounge' = 'war', event_id = 'e1'): PlayerResult => ({
  kind,
  event_id,
  track_id,
  position,
  racers: 12,
})

const results = [
  r('rr', 1), r('rr', 3), r('rr', 2),
  r('mbc', 8), r('mbc', 10), r('mbc', 12),
  r('dkp', 5), r('dkp', 5), r('dkp', 5),
  r('rr', 20, 'lounge', 'e2'),
  r('ws', 1),
]

describe('computeStats', () => {
  it('media general y por pista', () => {
    const s = computeStats(results, 'war')
    expect(s.races).toBe(10)
    expect(s.events).toBe(1)
    expect(s.average).toBe(5.2)
    expect(s.tracks[0]).toEqual({ trackId: 'ws', races: 1, average: 1, best: 1 })
    expect(s.tracks.find((t) => t.trackId === 'rr')).toEqual({ trackId: 'rr', races: 3, average: 2, best: 1 })
  })

  it('filtra por tipo o junta todo', () => {
    expect(computeStats(results, 'lounge').races).toBe(1)
    expect(computeStats(results, 'all').races).toBe(11)
    expect(computeStats(results, 'all').events).toBe(2)
  })

  it('sin datos', () => {
    expect(computeStats([], 'all')).toEqual({ races: 0, events: 0, average: null, tracks: [] })
  })
})

describe('bestAndWorst', () => {
  it('ignora pistas con pocas carreras', () => {
    const { best, worst } = bestAndWorst(computeStats(results, 'war'))
    expect(best.map((t) => t.trackId)).toEqual(['rr', 'dkp', 'mbc'])
    expect(worst.map((t) => t.trackId)).toEqual([])
  })

  it('no repite pistas entre mejores y peores', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].flatMap((t, i) => [r(t, i + 1), r(t, i + 1), r(t, i + 1)])
    const { best, worst } = bestAndWorst(computeStats(many, 'war'))
    expect(best.map((t) => t.trackId)).toEqual(['a', 'b', 'c'])
    expect(worst.map((t) => t.trackId)).toEqual(['g', 'f', 'e'])
  })
})
