import { describe, expect, it } from 'vitest'
import type { EventPlayer, EventRace } from './events'
import { computeWarAnalytics } from './warAnalytics'
import { buildWarTable } from './warTable'

const players: EventPlayer[] = ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => ({ id: i + 1, event_id: 'ev', name, profile_id: null }))

/** Carrera con las posiciones de nuestros 6 jugadores (en orden A..F) */
const race = (race_no: number, positions: number[], track = 'rainbow-road', opponent_results: EventRace['opponent_results'] = null): EventRace => ({
  id: race_no,
  race_no,
  track_id: track,
  missing_home: 0,
  missing_away: 0,
  race_results: positions.map((position, i) => ({ player_id: i + 1, position })),
  opponent_results,
})

const GOOD = [1, 2, 3, 4, 5, 6] // +40
const BAD = [7, 8, 9, 10, 11, 12] // -40
const EVEN = [1, 5, 6, 7, 9, 12] // 0

describe('computeWarAnalytics', () => {
  it('sin carreras devuelve null', () => {
    expect(computeWarAnalytics(buildWarTable(players, []))).toBeNull()
  })

  it('evolución del marcador: ventaja máxima, desventaja máxima y cambios de líder', () => {
    const table = buildWarTable(players, [race(1, BAD), race(2, BAD), race(3, GOOD, 'bowsers-castle'), race(4, GOOD), race(5, GOOD), race(6, EVEN)])
    const a = computeWarAnalytics(table)!
    expect(a.raceRecord).toEqual({ w: 3, l: 2, t: 1 })
    expect(a.maxDeficit).toEqual({ value: -80, raceNo: 2 })
    expect(a.maxLead).toEqual({ value: 40, raceNo: 5 })
    // -40, -80, -40, 0, +40, +40: el líder cambia una vez (el empate no cuenta)
    expect(a.leadChanges).toBe(1)
    expect(a.bestRace).toEqual({ raceNo: 3, trackId: 'bowsers-castle', diff: 40 })
    expect(a.worstRace?.raceNo).toBe(1)
    expect(a.phases.open).toEqual({ races: 4, diff: 0 })
    expect(a.phases.mid).toEqual({ races: 2, diff: 40 })
    expect(a.phases.close).toBeNull()
  })

  it('reparto de posiciones entre los dos equipos', () => {
    const a = computeWarAnalytics(buildWarTable(players, [race(1, GOOD), race(2, EVEN)]))!
    expect(a.positions.home).toEqual([2, 1, 1, 1, 2, 2, 1, 0, 1, 0, 0, 1])
    expect(a.positions.away.reduce((x, y) => x + y, 0)).toBe(12)
    expect(a.top6PerRace).toBe(4.5) // 6 en la primera y 3 en la segunda
    expect(a.avgPos.home).toBe(5.1)
  })

  it('jugadores: puntos, cuota del equipo y veces mejor del equipo', () => {
    const a = computeWarAnalytics(buildWarTable(players, [race(1, GOOD), race(2, EVEN)]))!
    const first = a.homePlayers[0]
    expect(first.name).toBe('A')
    expect(first.points).toBe(30)
    expect(first.perWar).toBe(180)
    expect(first.leads).toBe(2)
    expect(first.share).toBe(29.4) // 30 de 61 + 41
    // Sin las posiciones de los rivales apuntadas no hay datos fiables por rival
    expect(a.awayPlayers).toEqual([])
  })

  it('rivales con posiciones apuntadas', () => {
    const opp = (positions: number[]) => positions.map((position, i) => ({ name: `R${i + 1}`, position }))
    const table = buildWarTable(players, [race(1, GOOD, 'rainbow-road', opp([7, 8, 9, 10, 11, 12]))], ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'])
    const a = computeWarAnalytics(table)!
    expect(a.awayPlayers.map((p) => p.name)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6'])
    expect(a.awayPlayers[0].leads).toBe(1)
  })
})
