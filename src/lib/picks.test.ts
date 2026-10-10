import { describe, expect, it } from 'vitest'
import { buildPickPlan, shrunk } from './picks'
import type { TeamTrackStats } from './teamStats'

const t = (trackId: string, diff: number, races: number): TeamTrackStats => ({
  trackId,
  races,
  diff,
  pointsHome: 0,
  pointsAway: 0,
  avgHome: 0,
  avgAway: 0,
  avgPosHome: 0,
  avgPosAway: 0,
  raceWins: 0,
  raceWinRate: 0,
  rating: 0,
})

describe('shrunk', () => {
  it('acerca a 0 las medias con pocas carreras', () => {
    expect(shrunk(null)).toBe(0)
    expect(shrunk({ diff: 12, races: 1 })).toBe(3)
    expect(shrunk({ diff: 12, races: 9 })).toBe(9)
  })
})

describe('buildPickPlan', () => {
  it('ordena por nuestro rendimiento cuando no hay datos del rival', () => {
    const plan = buildPickPlan([t('rr', 10, 6), t('cc', 6, 6), t('dkp', -8, 6), t('mbc', 2, 6)], null, null)
    expect(plan.pick.map((p) => p.trackId)).toEqual(['rr', 'cc'])
    expect(plan.avoid.map((p) => p.trackId)).toEqual(['dkp'])
    expect(plan.rest.map((p) => p.trackId)).toEqual(['mbc'])
  })

  it('una sola carrera buena no supera a una pista fuerte con muchas carreras', () => {
    const plan = buildPickPlan([t('once', 30, 1), t('solid', 12, 12)], null, null)
    expect(plan.pick[0].trackId).toBe('solid')
  })

  it('resta donde el rival es fuerte y pesa el doble lo jugado contra él', () => {
    const ours = [t('rr', 6, 6), t('cc', 6, 6)]
    const theirs = [t('rr', 10, 9)] // el rival domina rr
    const h2h = [t('cc', 8, 3)] // contra este rival, en cc fuimos muy bien
    const plan = buildPickPlan(ours, theirs, h2h)
    expect(plan.pick.map((p) => p.trackId)).toEqual(['cc'])
    expect(plan.avoid.map((p) => p.trackId)).toEqual(['rr'])
    expect(plan.pick[0]).toMatchObject({ ours: { diff: 6, races: 6 }, theirs: null, h2h: { diff: 8, races: 3 } })
  })

  it('pistas solo con datos del rival también cuentan', () => {
    const plan = buildPickPlan([], [t('ws', -12, 9)], null)
    expect(plan.pick.map((p) => p.trackId)).toEqual(['ws'])
  })

  it('limita el número de recomendaciones', () => {
    const ours = Array.from({ length: 10 }, (_, i) => t(`p${i}`, 10 + i, 6))
    expect(buildPickPlan(ours, null, null, 3).pick).toHaveLength(3)
  })
})
