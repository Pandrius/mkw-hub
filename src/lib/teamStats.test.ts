import { describe, expect, it } from 'vitest'
import { computeTeamStats, type TeamWar } from './teamStats'

describe('computeTeamStats', () => {
  const dummyWars: TeamWar[] = [
    {
      id: 'war-1',
      team_id: 10,
      team_tag: 'ηβ',
      team_name: 'Nebulosa',
      opponent_team_id: 20,
      opponent_tag: 'SS',
      opponent_name: 'Solar Storm',
      created_at: '2026-09-01T12:00:00Z',
      finished_at: '2026-09-01T13:00:00Z',
      races: [
        // Race 1 on Rainbow Road: Nebulosa takes positions 1, 2, 3, 4, 5, 6 (15+12+10+9+8+7 = 61 pts vs 21 pts)
        { track_id: 'rainbow-road', race_no: 1, missing_home: 0, missing_away: 0, positions: [1, 2, 3, 4, 5, 6] },
        // Race 2 on Bowser Castle: Nebulosa takes positions 7, 8, 9, 10, 11, 12 (6+5+4+3+2+1 = 21 pts vs 61 pts)
        { track_id: 'bowsers-castle', race_no: 2, missing_home: 0, missing_away: 0, positions: [7, 8, 9, 10, 11, 12] },
        // Race 3 on Rainbow Road: Nebulosa takes 1, 2, 4, 5, 7, 8 (15+12+9+8+6+5 = 55 pts vs 27 pts)
        { track_id: 'rainbow-road', race_no: 3, missing_home: 0, missing_away: 0, positions: [1, 2, 4, 5, 7, 8] },
      ],
    },
    {
      id: 'war-2',
      team_id: 10,
      team_tag: 'ηβ',
      team_name: 'Nebulosa',
      opponent_team_id: 30,
      opponent_tag: 'KC',
      opponent_name: 'Kart Club',
      created_at: '2026-09-02T12:00:00Z',
      finished_at: '2026-09-02T13:00:00Z',
      races: [
        // Race 1 on Rainbow Road: Nebulosa takes 1, 2, 3, 4, 5, 6 (61 vs 21)
        { track_id: 'rainbow-road', race_no: 1, missing_home: 0, missing_away: 0, positions: [1, 2, 3, 4, 5, 6] },
      ],
    },
  ]

  it('calcula las victorias, derrotas y winrate del equipo', () => {
    const stats = computeTeamStats(10, dummyWars)
    // war-1: 61+21+55 = 137 vs 21+61+27 = 109 (Win)
    // war-2: 61 vs 21 (Win)
    expect(stats.wars).toBe(2)
    expect(stats.wins).toBe(2)
    expect(stats.losses).toBe(0)
    expect(stats.ties).toBe(0)
    expect(stats.winRate).toBe(100)
    expect(stats.totalPointsHome).toBe(198)
    expect(stats.totalPointsAway).toBe(130)
  })

  it('calcula el histórico contra cada rival por separado', () => {
    const stats = computeTeamStats(10, dummyWars)
    expect(stats.rivals).toHaveLength(2)

    const ss = stats.rivals.find((r) => r.opponentTag === 'SS')
    expect(ss).toBeDefined()
    expect(ss?.wars).toBe(1)
    expect(ss?.wins).toBe(1)
    expect(ss?.pointsHome).toBe(137)
    expect(ss?.pointsAway).toBe(109)
    expect(ss?.diff).toBe(28)

    const kc = stats.rivals.find((r) => r.opponentTag === 'KC')
    expect(kc).toBeDefined()
    expect(kc?.wars).toBe(1)
    expect(kc?.diff).toBe(40)
  })

  it('calcula el rendimiento por pista con el +/- diferencial de puntos y posiciones', () => {
    const stats = computeTeamStats(10, dummyWars)
    // Rainbow Road se jugó 3 veces:
    // Puntos home: 61 + 55 + 61 = 177 / 3 = 59.00
    // Puntos away: 21 + 27 + 21 = 69 / 3 = 23.00
    // Diff: 59 - 23 = +36.00
    const rr = stats.tracks.find((t) => t.trackId === 'rainbow-road')
    expect(rr).toBeDefined()
    expect(rr?.races).toBe(3)
    expect(rr?.avgHome).toBe(59)
    expect(rr?.avgAway).toBe(23)
    expect(rr?.diff).toBe(36)

    // Bowser's Castle se jugó 1 vez:
    // Home: 21, Away: 61, Diff: -40.00
    const bc = stats.tracks.find((t) => t.trackId === 'bowsers-castle')
    expect(bc).toBeDefined()
    expect(bc?.diff).toBe(-40)

    // Best & Worst tracks
    expect(stats.bestTracks[0].trackId).toBe('rainbow-road')
    expect(stats.worstTracks[0].trackId).toBe('bowsers-castle')
  })

  it('devuelve estadísticas vacías para un equipo sin wars', () => {
    const stats = computeTeamStats(999, [])
    expect(stats.wars).toBe(0)
    expect(stats.wins).toBe(0)
    expect(stats.winRate).toBe(0)
    expect(stats.avgDiff).toBe(0)
    expect(stats.rivals).toEqual([])
    expect(stats.tracks).toEqual([])
  })
})
