import { describe, expect, it } from 'vitest'
import { computeBadges, progressOf, RACE_TIERS } from './badges'
import type { TimedResult } from './form'

const race = (eventId: string, trackId: string): TimedResult => ({
  eventId,
  kind: 'war',
  trackId,
  position: 12,
  raceNo: 1,
  date: '2026-10-01T10:00:00Z',
  racers: 12,

  verified: true,
})

describe('progressOf', () => {
  it('da el nivel alcanzado y lo que falta para el siguiente', () => {
    expect(progressOf(0, RACE_TIERS)).toEqual({ count: 0, tier: 0, next: 50 })
    expect(progressOf(49, RACE_TIERS)).toEqual({ count: 49, tier: 0, next: 50 })
    expect(progressOf(50, RACE_TIERS)).toEqual({ count: 50, tier: 1, next: 250 })
    expect(progressOf(1000, RACE_TIERS)).toEqual({ count: 1000, tier: 3, next: 2500 })
    expect(progressOf(9999, RACE_TIERS)).toEqual({ count: 9999, tier: 4, next: null })
  })
})

describe('computeBadges', () => {
  it('sin carreras no hay nada', () => {
    const b = computeBadges([], 40)
    expect(b.tracks).toEqual([])
    expect(b.mostPlayed).toBeNull()
    expect(b.races.tier).toBe(0)
  })

  it('cuenta carreras por pista, eventos y pistas distintas', () => {
    const rows = [
      ...Array.from({ length: 30 }, (_, i) => race(`e${i % 3}`, 'LC')),
      ...Array.from({ length: 10 }, () => race('e0', 'RR')),
    ]
    const b = computeBadges(rows, 40)
    expect(b.races.count).toBe(40)
    expect(b.events.count).toBe(3)
    expect(b.explorer).toEqual({ count: 2, tier: 0, next: 10 })
    // LC con 30 carreras ya es bronce (25); RR con 10 aún no
    expect(b.tracks).toEqual([{ trackId: 'LC', count: 30, tier: 1, next: 100 }])
    expect(b.mostPlayed).toEqual({ trackId: 'LC', races: 30 })
  })

  it('el explorador sube con el porcentaje de pistas jugadas', () => {
    const rows = Array.from({ length: 20 }, (_, i) => race('e', `t${i}`))
    expect(computeBadges(rows, 40).explorer).toEqual({ count: 20, tier: 2, next: 30 })
  })
})
