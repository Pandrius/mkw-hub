import { describe, expect, it } from 'vitest'
import { computeTeamPlayerStats, computeTeamStats, mergeTeamWars, mirrorWar, raceScore, type TeamWar } from './teamStats'

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

  const war = (id: string, races: TeamWar['races']): TeamWar => ({ ...dummyWars[0], id, races })
  const res = (name: string, position: number, profileId: string | null = null) => ({ name, profileId, position })

  it('calcula las estadísticas de cada jugador en las wars del equipo', () => {
    const wars: TeamWar[] = [
      // La más reciente primero: Peckmat ya está vinculado a su usuario
      war('w2', [
        { track_id: 'rainbow-road', race_no: 1, missing_home: 0, missing_away: 0, positions: [1, 5], results: [res('Peckmat', 1, 'u1'), res('Sharpy', 5)] },
      ]),
      war('w1', [
        { track_id: 'rainbow-road', race_no: 1, missing_home: 0, missing_away: 0, positions: [3, 2], results: [res('Peck', 3, 'u1'), res('sharpy', 2)] },
        { track_id: 'bowsers-castle', race_no: 2, missing_home: 0, missing_away: 0, positions: [12, 1], results: [res('Peck', 12, 'u1'), res('Sharpy', 1)] },
      ]),
    ]
    const players = computeTeamPlayerStats(wars)
    expect(players).toHaveLength(2)

    // Sharpy: 8 + 12 + 15 = 35 pts en 3 carreras (sin usuario: se agrupa por nombre)
    const [sharpy, peck] = players
    expect(sharpy.name).toBe('Sharpy')
    expect(sharpy.wars).toBe(2)
    expect(sharpy.races).toBe(3)
    expect(sharpy.points).toBe(35)
    expect(sharpy.avgPoints).toBe(11.67)
    expect(sharpy.top3Rate).toBe(67)

    // Peckmat: 15 + 10 + 1 = 26 pts; nombre más reciente; mejor pista con ≥2 carreras
    expect(peck.name).toBe('Peckmat')
    expect(peck.profileId).toBe('u1')
    expect(peck.avgPos).toBe(5.33)
    expect(peck.bestTrack).toEqual({ trackId: 'rainbow-road', avgPoints: 12.5, races: 2 })
  })

  it('calcula la peor pista de cada jugador con las mismas reglas que la mejor', () => {
    const race = (n: number, track: string, pos: number) => ({
      track_id: track,
      race_no: n,
      missing_home: 0,
      missing_away: 0,
      positions: [pos],
      results: [res('Polimar', pos)],
    })
    // Rainbow Road: 1.º y 3.º (15 y 10 → 12.5). Bowser: 9.º y 11.º (4 y 2 → 3). Mario Circuit: una sola carrera
    const players = computeTeamPlayerStats([
      war('w1', [race(1, 'rainbow-road', 1), race(2, 'bowsers-castle', 9), race(3, 'mario-circuit', 12)]),
      war('w2', [race(1, 'rainbow-road', 3), race(2, 'bowsers-castle', 11)]),
    ])
    const [polimar] = players
    expect(polimar.bestTrack).toEqual({ trackId: 'rainbow-road', avgPoints: 12.5, races: 2 })
    // Mario Circuit (1 pt) no cuenta: con solo una carrera no es fiable
    expect(polimar.worstTrack).toEqual({ trackId: 'bowsers-castle', avgPoints: 3, races: 2 })
  })

  it('no hay peor pista si solo ha corrido en una', () => {
    const [p] = computeTeamPlayerStats([
      war('w1', [
        { track_id: 'rainbow-road', race_no: 1, missing_home: 0, missing_away: 0, positions: [1], results: [res('Solo', 1)] },
        { track_id: 'rainbow-road', race_no: 2, missing_home: 0, missing_away: 0, positions: [2], results: [res('Solo', 2)] },
      ]),
    ])
    expect(p.bestTrack?.trackId).toBe('rainbow-road')
    expect(p.worstTrack).toBeNull()
  })

  it('puntos de una carrera sin validar: posiciones propias, las que quedan y ausentes', () => {
    expect(raceScore({ positions: [1, 2, 3, 4, 5, 6], missing_home: 0, missing_away: 0 })).toEqual({ home: 61, away: 21 })
    // 11 jugadores: falta uno nuestro (1 punto) y el rival se reparte del 6.º al 11.º
    expect(raceScore({ positions: [1, 2, 3, 4, 5], missing_home: 1, missing_away: 0 })).toEqual({ home: 55, away: 27 })
  })

  it('cuota de puntos del equipo, veces mejor del equipo y +/- con y sin el jugador', () => {
    const six = (n: number, names: string[], positions: number[]) => ({
      track_id: 'rainbow-road',
      race_no: n,
      missing_home: 0,
      missing_away: 0,
      positions,
      results: positions.map((p, i) => res(names[i], p)),
    })
    const core = ['A', 'B', 'C', 'D', 'E']
    // 6 carreras con "Sub" (todas perdidas, -40) y 6 con "Star" (todas ganadas, +40)
    const races = [
      ...Array.from({ length: 6 }, (_, i) => six(i + 1, [...core, 'Sub'], [7, 8, 9, 10, 11, 12])),
      ...Array.from({ length: 6 }, (_, i) => six(i + 7, ['Star', ...core], [1, 2, 3, 4, 5, 6])),
    ]
    const players = computeTeamPlayerStats([war('w1', races)])
    const star = players.find((p) => p.name === 'Star')!
    expect(star.share).toBe(24.6) // 15 de 61 en cada carrera
    expect(star.leadRate).toBe(100)
    expect(star.perWar).toBe(180)
    expect(star.onOff).toEqual({ with: 40, without: -40, withoutRaces: 6 })
    // Los que corrieron todas no tienen carreras "sin ellos"
    expect(players.find((p) => p.name === 'A')!.onOff).toBeNull()
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

describe('wars apuntadas por el rival', () => {
  const raw = {
    id: 'w-ck',
    team_id: 4270,
    team_tag: 'CK',
    team_name: 'Crazy Karts',
    opponent_team_id: 3710,
    opponent_tag: 'ηβ',
    opponent_name: 'Nebulosa',
    created_at: '2026-10-07T22:00:00Z',
    finished_at: '2026-10-07T23:00:00Z',
    opponent_confirmed: null,
    races: [
      {
        track_id: 'dk-pass',
        race_no: 1,
        missing_home: 1,
        missing_away: 0,
        positions: [1, 2, 3, 4, 5],
        opponent_results: [
          { name: 'Peckmat', position: 6 },
          { name: 'ηβ 2', position: 7 },
        ],
      },
    ],
  }

  it('da la vuelta a la war: equipos, posiciones restantes y ausentes', () => {
    const m = mirrorWar(raw)
    expect(m.team_id).toBe(3710)
    expect(m.opponent_team_id).toBe(4270)
    expect(m.opponent_tag).toBe('CK')
    expect(m.races[0].positions).toEqual([6, 7, 8, 9, 10, 11])
    expect(m.races[0].missing_home).toBe(0)
    expect(m.races[0].missing_away).toBe(1)
    // Los nombres por defecto no cuentan como jugadores
    expect(m.races[0].results).toEqual([{ name: 'Peckmat', profileId: null, position: 6 }])
  })

  it('solo cuentan las confirmadas, y no si el equipo ya apuntó la misma war', () => {
    const pending = mirrorWar(raw)
    const confirmed = { ...mirrorWar(raw), id: 'w-ok', confirmed: true, created_at: '2026-10-01T20:00:00Z' }
    const rejected = { ...mirrorWar(raw), id: 'w-no', confirmed: false }
    const own: TeamWar = { ...confirmed, id: 'own', created_at: '2026-10-07T21:00:00Z' }

    const a = mergeTeamWars([], [pending, confirmed, rejected])
    expect(a.wars.map((w) => w.id)).toEqual(['w-ok'])
    expect(a.pending.map((w) => w.id)).toEqual(['w-ck'])

    // La propia es de una hora antes contra el mismo rival: la del rival se descarta
    const b = mergeTeamWars([own], [pending])
    expect(b.wars.map((w) => w.id)).toEqual(['own'])
    expect(b.pending).toEqual([])
  })
})

describe('penalties en las estadísticas', () => {
  // Una carrera 61-21 a favor: con una penalty de -50 al equipo propio la war pasa a perderse
  const war: TeamWar = {
    id: 'w',
    team_id: 10,
    team_tag: 'NB',
    team_name: null,
    opponent_team_id: 20,
    opponent_tag: 'SS',
    opponent_name: null,
    created_at: '2026-09-01T12:00:00Z',
    finished_at: '2026-09-01T13:00:00Z',
    races: [{ track_id: 'rainbow-road', race_no: 1, missing_home: 0, missing_away: 0, positions: [1, 2, 3, 4, 5, 6] }],
  }

  it('cambian el resultado de la war', () => {
    expect(computeTeamStats(10, [war]).wins).toBe(1)
    const penalised = computeTeamStats(10, [{ ...war, penalties: [{ side: 'home', label: 'Penalty', points: -50 }] }])
    expect(penalised.losses).toBe(1)
    expect(penalised.totalPointsHome).toBe(61 - 50)
  })

  it('se dan la vuelta cuando la war la apuntó el rival', () => {
    const mirrored = mirrorWar({
      ...war,
      penalties: [{ side: 'home', label: 'Penalty', points: -5 }],
      opponent_confirmed: true,
      races: war.races.map((r) => ({ ...r, opponent_results: null })),
    })
    expect(mirrored.penalties).toEqual([{ side: 'away', label: 'Penalty', points: -5 }])
  })
})
