import { describe, expect, it } from 'vitest'
import { computeTeamForm } from './teamForm'
import type { TeamWar, TeamWarRace } from './teamStats'

const GOOD = [1, 2, 3, 4, 5, 6] // 61 - 21: +40
const BAD = [7, 8, 9, 10, 11, 12] // 21 - 61: -40
const EVEN = [1, 5, 6, 7, 9, 12] // 41 - 41: 0

function war(id: string, day: number, races: number[][], opp = 'ABC'): TeamWar {
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
    races: races.map((positions, i): TeamWarRace => ({ track_id: `t${i}`, race_no: i + 1, missing_home: 0, missing_away: 0, positions })),
  }
}

describe('computeTeamForm', () => {
  it('sin wars devuelve null', () => {
    expect(computeTeamForm([])).toBeNull()
  })

  it('rachas de wars y racha actual', () => {
    const f = computeTeamForm([
      war('a', 1, [GOOD]),
      war('b', 2, [GOOD]),
      war('c', 3, [GOOD]),
      war('d', 4, [BAD]),
      war('e', 5, [BAD]),
    ])!
    expect(f.winStreak).toEqual({ current: 0, best: 3 })
    expect(f.lossStreak).toEqual({ current: 2, best: 2 })
    expect(f.current).toEqual({ result: 'L', length: 2 })
    // La más reciente primero
    expect(f.last.map((w) => w.result).join('')).toBe('LLWWW')
    expect(f.last.map((w) => w.eventId)).toEqual(['e', 'd', 'c', 'b', 'a'])
  })

  it('ordena las wars por fecha aunque lleguen desordenadas', () => {
    const f = computeTeamForm([war('b', 2, [BAD]), war('a', 1, [GOOD])])!
    expect(f.wars.map((w) => w.eventId)).toEqual(['a', 'b'])
  })

  it('remontada: perdiendo tras la carrera 6 y ganada al final', () => {
    const races = [BAD, BAD, EVEN, EVEN, EVEN, EVEN, GOOD, GOOD, GOOD, EVEN, EVEN, EVEN]
    const f = computeTeamForm([war('a', 1, races, 'XYZ')])!
    expect(f.badges.find((b) => b.id === 'comeback')?.vars).toEqual({ n: 1, deficit: 80, opp: 'XYZ' })
  })

  it('desplome: ganando a mitad y perdida', () => {
    const races = [GOOD, GOOD, EVEN, EVEN, EVEN, EVEN, BAD, BAD, BAD, EVEN, EVEN, EVEN]
    expect(computeTeamForm([war('a', 1, races)])!.badges.map((b) => b.id)).toContain('collapse')
  })

  it('bestia negra: el rival contra el que más se pierde', () => {
    const f = computeTeamForm([war('a', 1, [BAD], 'NMS'), war('b', 2, [BAD], 'NMS'), war('c', 3, [GOOD], 'NMS')])!
    expect(f.badges.find((b) => b.id === 'nemesis')?.vars).toEqual({ opp: 'NMS', w: 1, l: 2 })
  })

  it('racha de carreras ganadas a través de varias wars', () => {
    const f = computeTeamForm([war('a', 1, [BAD, GOOD, GOOD]), war('b', 2, [GOOD, EVEN])])!
    expect(f.raceWinStreak).toEqual({ current: 0, best: 3 })
  })
})
