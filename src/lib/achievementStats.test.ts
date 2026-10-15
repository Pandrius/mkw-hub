import { describe, expect, it } from 'vitest'
import type { Achievement } from './achievements'
import { buildAchievementStats, topPercentIn } from './achievementStats'

const list = (podiums: number): Achievement[] => [
  { id: 'podiums', glyph: 'podium', thresholds: [50], epic: false, single: false, count: podiums, tier: 0, next: 50 },
]

describe('achievementStats', () => {
  const stats = buildAchievementStats([list(500), list(100), list(100), list(10), list(0)])

  it('reúne los contadores de todos los jugadores, de mayor a menor', () => {
    expect(stats.players).toBe(5)
    expect(stats.counts.podiums).toEqual([500, 100, 100, 10, 0])
  })

  it('el porcentaje es tu puesto entre el total de jugadores (los empates comparten puesto)', () => {
    expect(topPercentIn(stats, 'podiums', 500)).toBe(20)
    expect(topPercentIn(stats, 'podiums', 100)).toBe(40)
    expect(topPercentIn(stats, 'podiums', 10)).toBe(80)
  })

  it('sin nada conseguido, sin estadísticas o con muy pocos jugadores no se enseña', () => {
    expect(topPercentIn(stats, 'podiums', 0)).toBeNull()
    expect(topPercentIn(null, 'podiums', 5)).toBeNull()
    expect(topPercentIn(buildAchievementStats([list(5), list(9)]), 'podiums', 9)).toBeNull()
  })
})
