import { describe, expect, it } from 'vitest'
import { computeAchievements, type AchievementId } from './achievements'
import type { TimedResult } from './form'

/** Un evento de 12 carreras (o las que se indiquen) con las posiciones dadas */
function event(id: string, positions: number[], track = (i: number) => `t${i}`, date = '2026-10-01T10:00:00Z'): TimedResult[] {
  return positions.map((position, i) => ({ eventId: id, kind: 'war', trackId: track(i), position, raceNo: i + 1, date, racers: 12 }))
}

const get = (rows: TimedResult[], id: AchievementId, total = 40) => computeAchievements(rows, total).find((a) => a.id === id)!

describe('computeAchievements', () => {
  it('sin carreras todos están a cero', () => {
    for (const a of computeAchievements([], 40)) expect(a.count, a.id).toBe(0)
  })

  it('cuenta podios, victorias y top 6', () => {
    const rows = event('a', [1, 2, 3, 4, 6, 7, 12, 1])
    expect(get(rows, 'podiums').count).toBe(4)
    expect(get(rows, 'wins').count).toBe(2)
    expect(get(rows, 'top6').count).toBe(6)
  })

  it('rachas: la mejor, aunque cruce eventos', () => {
    const rows = [...event('a', [1, 1, 5], undefined, '2026-10-01T10:00:00Z'), ...event('b', [1, 1, 1, 9], undefined, '2026-10-02T10:00:00Z')]
    expect(get(rows, 'winStreak').count).toBe(3)
    expect(get(rows, 'winStreak').tier).toBe(2)
  })

  it('eventos completos: sin salir del top 6, grandes y legendarios', () => {
    const clean = event('clean', Array(12).fill(6)) // 12 × 7 = 84 pts
    const big = event('big', Array(12).fill(3)) // 12 × 10 = 120 pts
    const legend = event('legend', Array(12).fill(1)) // 180 pts
    const loose = event('loose', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 7]) // se sale del top 6
    const rows = [...clean, ...big, ...legend, ...loose]
    expect(get(rows, 'cleanEvent').count).toBe(3)
    expect(get(rows, 'bigEvent').count).toBe(3) // big, legend y loose (más de 150)
    expect(get(rows, 'legendEvent').count).toBe(2) // legend y loose (11 × 15 + 6 = 171)
  })

  it('un evento incompleto no cuenta para los logros de evento', () => {
    const rows = event('short', Array(10).fill(1))
    expect(get(rows, 'bigEvent').count).toBe(0)
    expect(get(rows, 'cleanEvent').count).toBe(0)
  })

  it('remontada: ganar justo después de acabar décimo o peor', () => {
    const rows = event('a', [10, 1, 12, 2, 11, 1])
    expect(get(rows, 'redemption').count).toBe(2)
  })

  it('carrera final: ganar la 12.ª de un evento', () => {
    const rows = [...event('a', [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1]), ...event('b', [1, 1])]
    expect(get(rows, 'finalRace').count).toBe(1)
  })

  it('pista dominada: media de 3 o mejor con 10 carreras o más', () => {
    const rows = event('a', [1, 2, 3, 4, 5, 3, 3, 3, 3, 3], () => 'LC') // media 3,0 en 10 carreras
    expect(get(rows, 'domination').count).toBe(1)
    const few = event('b', [1, 1, 1], () => 'RR')
    expect(get(few, 'domination').count).toBe(0)
  })

  it('podio y victoria en pistas distintas', () => {
    const rows = event('a', [1, 2, 3, 4], (i) => `t${i}`)
    expect(get(rows, 'podiumEverywhere').count).toBe(3)
    expect(get(rows, 'winEverywhere').count).toBe(1)
    // el último nivel pide todas las pistas del juego
    expect(get(rows, 'podiumEverywhere', 40).thresholds.at(-1)).toBe(40)
  })
})
