import { describe, expect, it } from 'vitest'
import { computeTeamOverview, summarizeWar } from './teamAnalytics'
import type { TeamWar, TeamWarRace } from './teamStats'

const GOOD = [1, 2, 3, 4, 5, 6] // 61 - 21: +40
const BAD = [7, 8, 9, 10, 11, 12] // 21 - 61: -40
const EVEN = [1, 5, 6, 7, 9, 12] // 41 - 41: 0

function war(id: string, day: number, races: number[][], opp = 'ABC', penalties: TeamWar['penalties'] = []): TeamWar {
  return {
    id,
    team_id: 1,
    team_tag: 'MKH',
    team_name: 'MKW Hub',
    opponent_team_id: null,
    opponent_tag: opp,
    opponent_name: null,
    created_at: `2026-09-${String(day).padStart(2, '0')}T20:00:00Z`,
    finished_at: null,
    penalties,
    races: races.map((positions, i): TeamWarRace => ({ track_id: `t${i}`, race_no: i + 1, missing_home: 0, missing_away: 0, positions })),
  }
}

describe('summarizeWar', () => {
  it('suma carreras, aplica penalties al final y guarda la diferencia acumulada', () => {
    const s = summarizeWar(war('a', 1, [GOOD, BAD, GOOD], 'XYZ', [{ side: 'home', label: 'Late', points: -50 }]))
    expect(s.home).toBe(61 + 21 + 61 - 50)
    expect(s.away).toBe(21 + 61 + 21)
    expect(s.running).toEqual([40, 0, -10])
    expect(s.result).toBe('L')
    expect(s.opponent).toBe('XYZ')
    expect(s.races.map((r) => r.diff)).toEqual([40, -40, 40])
  })
})

describe('computeTeamOverview', () => {
  it('sin wars devuelve null', () => {
    expect(computeTeamOverview([])).toBeNull()
  })

  it('balance de wars y de carreras, medias y diferencia por carrera', () => {
    const o = computeTeamOverview([war('a', 1, [GOOD, GOOD, BAD]), war('b', 2, [BAD, EVEN])])!
    expect(o.record).toEqual({ w: 1, l: 1, t: 0 })
    expect(o.winRate).toBe(50)
    expect(o.avgFor).toBe((143 + 62) / 2)
    expect(o.avgDiff).toBe((40 - 40) / 2)
    expect(o.raceRecord).toEqual({ w: 2, l: 2, t: 1 })
    expect(o.raceWinRate).toBe(40)
    expect(o.diffPerRace).toBe(0)
    expect(o.biggestWin?.eventId).toBe('a')
    expect(o.biggestLoss?.eventId).toBe('b')
  })

  it('remontadas y ventajas mantenidas tras la carrera 6', () => {
    const comeback = [BAD, BAD, EVEN, EVEN, EVEN, EVEN, GOOD, GOOD, GOOD, EVEN, EVEN, EVEN]
    const collapse = [GOOD, GOOD, EVEN, EVEN, EVEN, EVEN, BAD, BAD, BAD, EVEN, EVEN, EVEN]
    const held = [GOOD, EVEN, EVEN, EVEN, EVEN, EVEN, EVEN, EVEN, EVEN, EVEN, EVEN, EVEN]
    const o = computeTeamOverview([war('a', 1, comeback), war('b', 2, collapse), war('c', 3, held)])!
    expect(o.comebacks).toEqual({ won: 1, of: 1 })
    expect(o.leadsHeld).toEqual({ won: 1, of: 2 })
    // +40, -40 y +40: ninguna ajustada
    expect(o.close).toEqual({ w: 0, l: 0, t: 0 })
  })

  it('wars ajustadas (20 puntos o menos) y fases de la war', () => {
    const races = [EVEN, EVEN, EVEN, EVEN, EVEN, EVEN, EVEN, EVEN, GOOD, BAD, EVEN, EVEN]
    const o = computeTeamOverview([war('a', 1, races, 'ABC', [{ side: 'away', label: 'P', points: -10 }])])!
    expect(o.close).toEqual({ w: 1, l: 0, t: 0 })
    expect(o.phases.open).toEqual({ races: 4, diffPerRace: 0, raceWinRate: 0 })
    expect(o.phases.close).toEqual({ races: 4, diffPerRace: 0, raceWinRate: 25 })
  })

  it('forma reciente: diferencia media de las 5 últimas wars', () => {
    const wars = [1, 2, 3, 4, 5, 6].map((d) => war(`w${d}`, d, [d === 1 ? BAD : GOOD]))
    const o = computeTeamOverview(wars)!
    expect(o.recent).toEqual({ wars: 5, avgDiff: 40 })
    expect(o.avgDiff).toBe(26.7)
    expect(computeTeamOverview(wars.slice(0, 3))!.recent).toBeNull()
  })
})
