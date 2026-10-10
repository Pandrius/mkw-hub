import { describe, expect, it } from 'vitest'
import type { TimedResult } from './form'
import { computePlayerAnalytics, trendOf } from './playerAnalytics'

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

describe('computePlayerAnalytics', () => {
  it('sin carreras devuelve null', () => {
    expect(computePlayerAnalytics([], 'all')).toBeNull()
  })

  it('resumen: medias, puntos por war, porcentajes y distribución', () => {
    // 1.º, 2.º, 3.º y 7.º: 15 + 12 + 10 + 6 = 43 puntos en 4 carreras
    const a = computePlayerAnalytics(event('a', '2026-10-01T10:00:00Z', [1, 2, 3, 7]), 'all')!
    expect(a.avgPos).toBe(3.25)
    expect(a.medianPos).toBe(2.5)
    expect(a.avgPoints).toBe(10.75)
    expect(a.perWar).toBe(129)
    expect(a.winRate).toBe(25)
    expect(a.podiumRate).toBe(75)
    expect(a.top6Rate).toBe(75)
    expect(a.distribution).toEqual([1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0])
  })

  it('por fases: apertura 1-4, tramo central 5-8 y cierre 9-12', () => {
    const a = computePlayerAnalytics(event('a', '2026-10-01T10:00:00Z', [10, 10, 10, 10, 6, 6, 6, 6, 2, 2, 2, 2]), 'all')!
    expect(a.phases.open).toEqual({ races: 4, avgPos: 10, avgPoints: 3 })
    expect(a.phases.mid?.avgPos).toBe(6)
    expect(a.phases.close).toEqual({ races: 4, avgPos: 2, avgPoints: 12 })
  })

  it('forma: últimas 12 carreras frente a las anteriores, en puntos', () => {
    const rows = [...event('a', '2026-10-01T10:00:00Z', Array(12).fill(8)), ...event('b', '2026-10-02T10:00:00Z', Array(12).fill(2))]
    const a = computePlayerAnalytics(rows, 'all')!
    expect(a.form).toEqual({
      recent: { races: 12, avgPos: 2, avgPoints: 12 },
      baseline: { races: 12, avgPos: 8, avgPoints: 5 },
      delta: 7,
      trend: 'up',
    })
    expect(a.events.map((e) => e.perWar)).toEqual([60, 144])
    // Media móvil: de 5 (solo el evento a) a 12 (solo el b)
    expect(a.rolling[0].value).toBe(5)
    expect(a.rolling.at(-1)!.value).toBe(12)
    expect(a.rolling).toHaveLength(13)
  })

  it('sin carreras anteriores suficientes no hay forma', () => {
    expect(computePlayerAnalytics(event('a', '2026-10-01T10:00:00Z', Array(12).fill(3)), 'all')!.form).toBeNull()
  })

  it('rachas de top 6, podio, victorias y fuera del top 6', () => {
    const a = computePlayerAnalytics(event('a', '2026-10-01T10:00:00Z', [1, 1, 1, 10, 9, 11, 12, 8, 1, 3]), 'all')!
    expect(a.streaks.win).toEqual({ current: 0, best: 3 })
    expect(a.streaks.podium).toEqual({ current: 2, best: 3 })
    expect(a.streaks.top6).toEqual({ current: 2, best: 3 })
    expect(a.streaks.outsideTop6).toEqual({ current: 0, best: 5 })
  })

  it('pistas: diferencia con la media propia y ajuste por muestra', () => {
    // rr: 1.º y 1.º; ok: 9.º y 9.º; one: 1.º una sola vez (no entra en mejores / peores)
    const a = computePlayerAnalytics(
      event('a', '2026-10-01T10:00:00Z', [1, 9, 1, 9, 1], 'war', (i) => (i === 4 ? 'one' : i % 2 ? 'ok' : 'rr')),
      'all',
    )!
    const rr = a.tracks.find((t) => t.trackId === 'rr')!
    expect(rr.avgPoints).toBe(15)
    expect(rr.delta).toBe(4.4) // media del jugador: (15·3 + 4·2) / 5 = 10.6
    expect(rr.rating).toBe(1.76) // 2 carreras · 4.4 / (2 + 3)
    expect(a.strongest.map((t) => t.trackId)).toEqual(['rr'])
    expect(a.weakest.map((t) => t.trackId)).toEqual(['ok'])
  })

  it('respeta el filtro war / lounge y separa ambos con "todo"', () => {
    const rows = [...event('a', '2026-10-01T10:00:00Z', Array(6).fill(1)), ...event('b', '2026-10-02T10:00:00Z', Array(6).fill(12), 'lounge')]
    expect(computePlayerAnalytics(rows, 'war')!.avgPos).toBe(1)
    expect(computePlayerAnalytics(rows, 'lounge')!.avgPos).toBe(12)
    const all = computePlayerAnalytics(rows, 'all')!
    expect(all.split.war?.avgPos).toBe(1)
    expect(all.split.lounge?.avgPoints).toBe(1)
  })
})

describe('trendOf', () => {
  it('sube o baja a partir de 0,75 puntos por carrera', () => {
    expect(trendOf(0.75)).toBe('up')
    expect(trendOf(0.5)).toBe('steady')
    expect(trendOf(-1)).toBe('down')
  })
})
