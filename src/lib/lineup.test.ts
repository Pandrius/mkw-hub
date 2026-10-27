import { describe, expect, it } from 'vitest'
import { buildPickPlan, lineupEdges } from './picks'
import { playerMovers, teamTrend, type WarSummary } from './teamAnalytics'
import type { TeamTrackStats, TeamWar, TeamWarRace } from './teamStats'

const track = (trackId: string): TeamTrackStats => ({
  trackId,
  races: 6,
  diff: 0,
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

const race = (track_id: string, results: { name: string; position: number }[]): TeamWarRace => ({
  track_id,
  race_no: 1,
  missing_home: 0,
  missing_away: 0,
  positions: results.map((r) => r.position),
  results: results.map((r) => ({ ...r, profileId: null })),
})

const war = (races: TeamWarRace[]): TeamWar => ({
  id: 'w',
  team_id: 1,
  team_tag: null,
  team_name: null,
  opponent_team_id: null,
  opponent_tag: null,
  opponent_name: null,
  created_at: '',
  finished_at: null,
  races,
})

describe('lineupEdges', () => {
  it('suma la ventaja de cada jugador de la alineación en la pista', () => {
    // Ana: 15 puntos en rr y 1 en cc (media 8); Beto: 9 en las dos
    const wars = [war([race('rr', [{ name: 'Ana', position: 1 }, { name: 'Beto', position: 4 }]), race('cc', [{ name: 'Ana', position: 12 }, { name: 'Beto', position: 4 }])])]
    const edges = lineupEdges(wars, ['name:ana', 'name:beto'])
    expect(edges.get('rr')).toBeCloseTo(2 * ((15 + 3 * 8) / 4 - 8), 2)
    expect(edges.get('cc')).toBeCloseTo(2 * ((1 + 3 * 8) / 4 - 8), 2)
  })

  it('ignora a quien no está en la alineación y a los tramos', () => {
    const section = { ...race('rr', [{ name: 'Ana', position: 1 }]), section: true }
    expect(lineupEdges([war([section])], ['name:ana']).size).toBe(0)
    expect(lineupEdges([war([race('rr', [{ name: 'Beto', position: 12 }])])], ['name:ana']).size).toBe(0)
  })

  it('la ventaja de la alineación mueve la puntuación de la pista', () => {
    const plan = buildPickPlan([track('rr'), track('cc')], null, null, 5, new Map([['rr', 5], ['cc', -5]]))
    expect(plan.pick.map((r) => r.trackId)).toEqual(['rr'])
    expect(plan.avoid.map((r) => r.trackId)).toEqual(['cc'])
    expect(plan.pick[0].lineup).toBe(5)
  })

  it('sin alineación no cambia nada', () => {
    expect(buildPickPlan([track('rr')], null, null).rest[0].lineup).toBeNull()
  })
})

const summary = (date: string, diff: number): WarSummary => ({
  eventId: date,
  date,
  opponent: 'X',
  opponentKey: 'tag:x',
  home: 0,
  away: 0,
  diff,
  result: diff > 0 ? 'W' : diff < 0 ? 'L' : 'T',
  running: [],
  races: [],
})

describe('teamTrend', () => {
  it('agrupa por mes natural, de más antiguo a más reciente', () => {
    const months = teamTrend([summary('2026-10-03T10:00:00Z', 10), summary('2026-09-20T10:00:00Z', -4), summary('2026-10-20T10:00:00Z', -2)])
    expect(months.map((m) => m.month)).toEqual(['2026-09', '2026-10'])
    expect(months[1]).toEqual({ month: '2026-10', wars: 2, wins: 1, winRate: 50, avgDiff: 4 })
  })
})

describe('playerMovers', () => {
  it('separa a los que mejoran de los que bajan', () => {
    const players = [{ n: 'a', formDelta: 1.5 }, { n: 'b', formDelta: -2 }, { n: 'c', formDelta: null }, { n: 'd', formDelta: 0.5 }, { n: 'e', formDelta: 0 }]
    const { up, down } = playerMovers(players)
    expect(up.map((p) => p.n)).toEqual(['a', 'd'])
    expect(down.map((p) => p.n)).toEqual(['b'])
  })
})
