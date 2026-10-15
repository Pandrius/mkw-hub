import { describe, expect, it } from 'vitest'
import { achievementTotals, computeAchievements, isMaxed, type AchievementId } from './achievements'
import type { TimedResult } from './form'

/** Un evento de 12 carreras (o las que se indiquen) con las posiciones dadas */
function event(id: string, positions: number[], track = (i: number) => `t${i}`, date = '2026-10-01T10:00:00Z'): TimedResult[] {
  return positions.map((position, i) => ({ eventId: id, kind: 'war', trackId: track(i), position, raceNo: i + 1, date, racers: 12, verified: true }))
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

  it('evento perfecto: 12 victorias seguidas, 180 puntos', () => {
    const perfect = event('p', Array(12).fill(1))
    const almost = event('q', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]) // 177 puntos
    const rows = [...perfect, ...almost]
    expect(get(rows, 'perfectEvent').count).toBe(1)
    expect(get(rows, 'perfectEvent').epic).toBe(true)
    expect(get(rows, 'legendEvent').count).toBe(2)
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

  it('ya no existe el logro «Dueño de la pista»', () => {
    expect(computeAchievements([], 40).some((a) => (a.id as string) === 'domination')).toBe(false)
  })

  it('podio y victoria en pistas distintas', () => {
    const rows = event('a', [1, 2, 3, 4], (i) => `t${i}`)
    expect(get(rows, 'podiumEverywhere').count).toBe(3)
    expect(get(rows, 'winEverywhere').count).toBe(1)
    // el último nivel pide todas las pistas del juego
    expect(get(rows, 'podiumEverywhere', 40).thresholds.at(-1)).toBe(40)
  })
})

describe('logros de una sola vez y logro supremo', () => {
  it('el evento perfecto no tiene niveles: al lograrlo es platino y el contador sigue subiendo', () => {
    const one = get(event('a', Array(12).fill(1)), 'perfectEvent')
    expect(one).toMatchObject({ single: true, count: 1, tier: 4, next: null })
    const three = get([...event('a', Array(12).fill(1)), ...event('b', Array(12).fill(1)), ...event('c', Array(12).fill(1))], 'perfectEvent')
    expect(three).toMatchObject({ count: 3, tier: 4 })
    expect(get(event('a', Array(12).fill(2)), 'perfectEvent')).toMatchObject({ count: 0, tier: 0, next: 1 })
  })

  it('el logro supremo cuenta los logros al máximo (aquí: evento perfecto, evento legendario y racha de 8 victorias) y no se consigue hasta tenerlos todos', () => {
    const rows = event('a', Array(12).fill(1))
    const grand = get(rows, 'allAchievements')
    expect(grand).toMatchObject({ single: true, epic: true, tier: 0, count: 3 })
    expect(grand.thresholds).toEqual([computeAchievements(rows, 40).length - 1])
    expect(achievementTotals(computeAchievements(rows, 40))).toMatchObject({ maxed: 3 })
  })

  it('el supremo se logra cuando todos los demás están al máximo', () => {
    const all = computeAchievements([], 40).filter((a) => a.id !== 'allAchievements')
    // Simulamos con los umbrales: un logro supremo con todos al máximo se calcula igual que isMaxed
    expect(all.every((a) => !isMaxed(a))).toBe(true)
    expect(isMaxed({ single: true, tier: 4, thresholds: [1] })).toBe(true)
    expect(isMaxed({ single: false, tier: 3, thresholds: [1, 2, 3, 4] })).toBe(false)
    expect(isMaxed({ single: false, tier: 4, thresholds: [1, 2, 3, 4] })).toBe(true)
    // Con cinco niveles el platino ya no es el máximo
    expect(isMaxed({ single: false, tier: 4, thresholds: [1, 2, 3, 4, 5] })).toBe(false)
    expect(isMaxed({ single: false, tier: 5, thresholds: [1, 2, 3, 4, 5] })).toBe(true)
  })
})

describe('niveles ajustados y esmeralda', () => {
  const all = computeAchievements([], 40)
  const thresholds = (id: AchievementId) => all.find((a) => a.id === id)!.thresholds

  it('umbrales de cada logro', () => {
    expect(thresholds('podiums')).toEqual([50, 300, 750, 1250, 2000])
    expect(thresholds('top6')).toEqual([50, 250, 750, 1500, 2500])
    expect(thresholds('cleanEvent')).toEqual([1, 3, 5, 7, 10])
    expect(thresholds('bigEvent')).toEqual([1, 5, 10, 20, 30])
    expect(thresholds('redemption')).toEqual([3, 10, 30, 60, 100])
  })

  it('el evento legendario es de una sola vez y sale directamente en esmeralda', () => {
    const a = get(event('a', Array(12).fill(2)), 'legendEvent') // 12 × 12 = 144 < 150
    expect(a).toMatchObject({ single: true, tier: 0 })
    const b = get(event('a', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5]), 'legendEvent') // 165 puntos
    expect(b).toMatchObject({ single: true, tier: 5, count: 1 })
  })

  it('con cinco niveles el último es esmeralda', () => {
    const rows = Array.from({ length: 2000 }, (_, i) => event(`e${i}`, [1])).flat()
    expect(get(rows, 'podiums')).toMatchObject({ count: 2000, tier: 5, next: null })
    expect(get(rows.slice(0, 1250), 'podiums').tier).toBe(4)
  })
})
