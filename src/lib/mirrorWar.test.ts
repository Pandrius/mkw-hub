import { describe, expect, it } from 'vitest'
import type { EventDetail, EventPlayer, EventRace, GameEvent } from './events'
import { mirrorEventDetail, NO_CORRECTIONS, warPlayerNames } from './mirrorWar'
import { buildWarTable } from './warTable'

const aNames = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']
const bNames = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']
const players: EventPlayer[] = aNames.map((name, i) => ({ id: i + 1, event_id: 'ev', name, profile_id: null }))

const event: GameEvent = {
  id: 'ev',
  kind: 'war',
  status: 'finished',
  team_tag: 'AAA',
  team_name: 'Alpha',
  team_id: 1,
  opponent_tag: 'BBB',
  opponent_name: 'Beta',
  opponent_team_id: 2,
  opponent_players: bNames,
  penalties: [
    { side: 'home', label: 'Late', points: -5 },
    { side: 'away', label: 'DC', points: -3 },
  ],
  substitutions: [],
  created_by: 'u',
  created_at: '2026-10-01T20:00:00Z',
  finished_at: '2026-10-01T21:00:00Z',
}

// Carrera 1: A en 1,3,5,7,9,11 y B en 2,4,6,8,10,12 (con nombres). Carrera 2: sin posiciones de B, y falta 1 de A (11 corredores)
const races: EventRace[] = [
  {
    id: 1,
    race_no: 1,
    track_id: 'rainbow-road',
    missing_home: 0,
    missing_away: 0,
    race_results: [1, 3, 5, 7, 9, 11].map((position, i) => ({ player_id: i + 1, position })),
    opponent_results: bNames.map((name, i) => ({ name, position: (i + 1) * 2 })),
  },
  {
    id: 2,
    race_no: 2,
    track_id: 'dk-pass',
    missing_home: 1,
    missing_away: 0,
    race_results: [1, 2, 3, 4, 5].map((position, i) => ({ player_id: i + 1, position })),
    opponent_results: null,
  },
]
const detail: EventDetail = { event, players, races }

const tableOf = (d: EventDetail) => buildWarTable(d.players, d.races, d.event.opponent_players, d.event.penalties, d.event.substitutions)

describe('warPlayerNames', () => {
  it('separa los jugadores de cada equipo', () => {
    expect(warPlayerNames(detail)).toEqual({ team: bNames, opponent: aNames })
  })
  it('añade nombres que solo salen en las carreras o en los cambios, y rellena los que faltan', () => {
    const extra = warPlayerNames({
      ...detail,
      event: { ...event, opponent_players: ['B1'], substitutions: [{ side: 'away', out: 'B1', in: 'B9', race_no: 4 }] },
      races: [{ ...races[0], opponent_results: [{ name: 'B7', position: 2 }] }],
    })
    expect(extra.team).toEqual(['B1', 'B7', 'B9'])
    expect(warPlayerNames({ ...detail, races: [], event: { ...event, opponent_players: null } }).team).toEqual(['BBB 1', 'BBB 2', 'BBB 3', 'BBB 4', 'BBB 5', 'BBB 6'])
  })
})

describe('mirrorEventDetail', () => {
  const mirror = mirrorEventDetail(detail)

  it('pone al equipo que valida a la izquierda', () => {
    expect(mirror.event.team_tag).toBe('BBB')
    expect(mirror.event.team_id).toBe(2)
    expect(mirror.event.opponent_tag).toBe('AAA')
    expect(mirror.event.opponent_team_id).toBe(1)
    expect(mirror.event.opponent_players).toEqual(aNames)
    expect(mirror.players.map((p) => p.name)).toEqual(bNames)
  })

  it('los resultados van al revés: lo que sumaba uno lo suma el otro, y las pistas no cambian', () => {
    const original = tableOf(detail)
    const mirrored = tableOf(mirror)
    expect(mirrored.home).toBe(original.away)
    expect(mirrored.away).toBe(original.home)
    expect(mirrored.diff).toBe(-original.diff)
    expect(mirror.races.map((r) => r.track_id)).toEqual(races.map((r) => r.track_id))
    expect(mirror.races.map((r) => r.race_no)).toEqual([1, 2])
  })

  it('los ausentes de cada equipo se intercambian', () => {
    expect(mirror.races[1].missing_home).toBe(0)
    expect(mirror.races[1].missing_away).toBe(1)
  })

  it('sin posiciones por jugador, reparte las que quedan entre los rivales en orden', () => {
    // Carrera 2: A corre 1-5, así que quedan 6..11 (11 corredores) para B1..B5 y el sexto: 6 posiciones libres
    const r2 = mirror.races[1].race_results.map((x) => x.position)
    expect(r2).toEqual([6, 7, 8, 9, 10, 11])
    expect(mirror.races[1].race_results.map((x) => x.player_id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('las posiciones de los otros quedan como resultados del rival, con su nombre', () => {
    expect(mirror.races[0].opponent_results).toEqual(aNames.map((name, i) => ({ name, position: [1, 3, 5, 7, 9, 11][i] })))
  })

  it('las penalties pasan al otro equipo con la misma puntuación', () => {
    expect(mirror.event.penalties).toEqual([
      { side: 'away', label: 'Late', points: -5 },
      { side: 'home', label: 'DC', points: -3 },
    ])
  })

  it('no modifica la war original', () => {
    expect(detail.event.team_tag).toBe('AAA')
    expect(detail.races[0].race_results).toHaveLength(6)
  })
})

describe('correcciones', () => {
  it('cambian los nombres de los dos equipos y de las penalties, sin tocar puntuaciones', () => {
    const fixed = mirrorEventDetail(detail, {
      teamNames: { B2: 'Beta Dos', B3: 'Cuenta = Tres' },
      opponentNames: { A1: 'Alpha Uno' },
      penaltyLabels: { '0': 'Tarde', '1': '   ' },
    })
    expect(fixed.players.map((p) => p.name)).toEqual(['B1', 'Beta Dos', 'Tres', 'B4', 'B5', 'B6'])
    expect(fixed.event.opponent_players?.[0]).toBe('Alpha Uno')
    expect(fixed.races[0].opponent_results?.[0].name).toBe('Alpha Uno')
    expect(fixed.event.penalties.map((p) => p.label)).toEqual(['Tarde', 'DC'])
    expect(fixed.event.penalties.map((p) => p.points)).toEqual([-5, -3])
    const before = tableOf(mirrorEventDetail(detail, NO_CORRECTIONS))
    const after = tableOf(fixed)
    expect([after.home, after.away]).toEqual([before.home, before.away])
  })

  it('las sustituciones siguen apuntando a los jugadores corregidos', () => {
    const withSubs: EventDetail = {
      ...detail,
      event: {
        ...event,
        substitutions: [
          { side: 'home', out: 'A1', in: 'A7', race_no: 2 },
          { side: 'away', out: 'B1', in: 'B7', race_no: 2 },
        ],
      },
      players: [...players, { id: 7, event_id: 'ev', name: 'A7', profile_id: null }],
    }
    const fixed = mirrorEventDetail(withSubs, { teamNames: { B7: 'Beta Siete' }, opponentNames: { A7: 'Alpha Siete' }, penaltyLabels: {} })
    expect(fixed.event.substitutions).toEqual([
      { side: 'away', out: 'A1', in: 'Alpha Siete', race_no: 2 },
      { side: 'home', out: 'B1', in: 'Beta Siete', race_no: 2 },
    ])
  })
})
