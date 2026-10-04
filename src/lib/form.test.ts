import { describe, expect, it } from 'vitest'
import { computePlayerForm, sortTimeline, streakOf, trendOf, type TimedResult } from './form'

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

const ids = (f: ReturnType<typeof computePlayerForm>) => f?.badges.map((b) => b.id) ?? []

describe('streakOf', () => {
  it('cuenta la racha actual y la mejor', () => {
    expect(streakOf([1, 1, 0, 1, 1, 1, 0, 1], (x) => x === 1)).toEqual({ current: 1, best: 3 })
    expect(streakOf([], () => true)).toEqual({ current: 0, best: 0 })
  })
})

describe('trendOf', () => {
  it('clasifica la diferencia con la media', () => {
    expect(trendOf(-2)).toBe('fire')
    expect(trendOf(-0.6)).toBe('up')
    expect(trendOf(0.2)).toBe('steady')
    expect(trendOf(0.9)).toBe('down')
    expect(trendOf(3)).toBe('ice')
  })
})

describe('sortTimeline', () => {
  it('ordena por fecha del evento y número de carrera', () => {
    const rows = [...event('b', '2026-10-02T10:00:00Z', [5, 6]), ...event('a', '2026-10-01T10:00:00Z', [1, 2])].reverse()
    expect(sortTimeline(rows).map((r) => r.position)).toEqual([1, 2, 5, 6])
  })
})

describe('computePlayerForm', () => {
  it('sin datos suficientes devuelve null', () => {
    expect(computePlayerForm(event('a', '2026-10-01T10:00:00Z', [1, 2, 3]), 'all')).toBeNull()
  })

  it('forma reciente: el último evento frente a la media de siempre', () => {
    const rows = [
      ...event('a', '2026-10-01T10:00:00Z', Array(12).fill(8)),
      ...event('b', '2026-10-02T10:00:00Z', Array(12).fill(2)),
    ]
    const f = computePlayerForm(rows, 'all')!
    expect(f.recentAverage).toBe(2)
    expect(f.overallAverage).toBe(5)
    expect(f.delta).toBe(-3)
    expect(f.trend).toBe('fire')
    expect(f.events.map((e) => e.average)).toEqual([8, 2])
    expect(f.lastPositions).toHaveLength(12)
  })

  it('rachas de top 6, podio, victorias y mitad de abajo', () => {
    const f = computePlayerForm(event('a', '2026-10-01T10:00:00Z', [1, 1, 1, 10, 9, 11, 12, 8, 1, 3]), 'all')!
    expect(f.streaks.win).toEqual({ current: 0, best: 3 })
    expect(f.streaks.podium).toEqual({ current: 2, best: 3 })
    expect(f.streaks.top6).toEqual({ current: 2, best: 3 })
    expect(f.streaks.bottom).toEqual({ current: 0, best: 5 })
    expect(ids(f)).toEqual(expect.arrayContaining(['winStreak', 'blueShell', 'rollercoaster']))
  })

  it('respeta el filtro war / lounge', () => {
    const rows = [...event('a', '2026-10-01T10:00:00Z', Array(6).fill(1)), ...event('b', '2026-10-02T10:00:00Z', Array(6).fill(12), 'lounge')]
    expect(computePlayerForm(rows, 'war')!.overallAverage).toBe(1)
    expect(computePlayerForm(rows, 'lounge')!.overallAverage).toBe(12)
  })

  it('pista maldita: 3 carreras o más y nunca en el top 6', () => {
    const f = computePlayerForm(event('a', '2026-10-01T10:00:00Z', [9, 2, 10, 3, 8, 1], 'war', (i) => (i % 2 ? 'ok' : 'rr')), 'all')!
    expect(f.badges.find((b) => b.id === 'cursedTrack')?.vars).toEqual({ track: 'rr', n: 3 })
  })

  it('diésel: mejora mucho al final de los eventos', () => {
    const pattern = [10, 10, 10, 10, 6, 6, 6, 6, 2, 2, 2, 2]
    const rows = [...event('a', '2026-10-01T10:00:00Z', pattern), ...event('b', '2026-10-02T10:00:00Z', pattern)]
    expect(ids(computePlayerForm(rows, 'all'))).toContain('diesel')
  })

  it('metrónomo: posiciones muy regulares', () => {
    const rows = event('a', '2026-10-01T10:00:00Z', [4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5])
    expect(ids(computePlayerForm(rows, 'all'))).toContain('metronome')
  })
})
