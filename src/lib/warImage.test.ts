import { describe, expect, it } from 'vitest'
import type { EventPlayer, EventRace, GameEvent } from './events'
import { buildWarImageData, fitText, hasRealOpponents, neutralizeWarImage, niceScale, raceStats, signed, warImageFileName } from './warImage'
import { buildWarTable } from './warTable'

const players: EventPlayer[] = ['A', 'B', 'C', 'D', 'E', 'F', 'Sub'].map((name, i) => ({
  id: i + 1,
  event_id: 'ev',
  name,
  profile_id: null,
}))

const race = (race_no: number, track_id: string, positions: [number, number][], missing_home = 0): EventRace => ({
  id: race_no,
  race_no,
  track_id,
  missing_home,
  missing_away: 0,
  race_results: positions.map(([player_id, position]) => ({ player_id, position })),
})

const event = (over: Partial<GameEvent> = {}): GameEvent => ({
  id: 'ev',
  kind: 'war',
  status: 'finished',
  team_tag: 'NB',
  team_name: 'Nebulosa',
  team_id: null,
  opponent_tag: 'RKL',
  opponent_name: null,
  opponent_team_id: null,
  opponent_players: null,
  penalties: [],
  substitutions: [],
  created_by: 'u',
  created_at: '2026-10-01T20:00:00Z',
  finished_at: '2026-10-01T21:10:00Z',
  ...over,
})

const races = [
  // 45-37 (+8)
  race(1, 'mario-bros-circuit', [[1, 1], [2, 3], [3, 5], [4, 7], [5, 9], [6, 11]]),
  // 37-45 (-8): justo al revés
  race(2, 'dk-pass', [[1, 2], [2, 4], [3, 6], [4, 8], [5, 10], [6, 12]]),
  // Pista desconocida, con un ausente nuestro
  race(3, 'pista-inventada', [[1, 1], [2, 2], [3, 3], [4, 4], [7, 5]], 1),
]

describe('buildWarImageData', () => {
  const table = buildWarTable(players, races, ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'])
  const data = buildWarImageData(event(), table, false)

  it('totales y diferencia de la tabla', () => {
    expect(data.home.total).toBe(table.home)
    expect(data.away.total).toBe(table.away)
    expect(data.diff).toBe(table.home - table.away)
    expect(data.home.tag).toBe('NB')
    expect(data.home.name).toBe('Nebulosa')
    expect(data.away.name).toBeNull()
  })

  it('serie acumulada carrera a carrera con abreviaturas y color de copa', () => {
    expect(data.races.map((r) => [r.raceNo, r.abbr, r.diff, r.runningDiff])).toEqual([
      [1, 'MBC', 8, 8],
      [2, 'rDKP', -8, 0],
      [3, 'pista-inventada', data.races[2].diff, data.races[2].diff],
    ])
    expect(data.races[0].color).toBe('#ff3b3b') // copa Champiñón
    expect(data.races[2].color).toBe('#a5a29a') // pista desconocida: gris
    expect(data.races.at(-1)?.runningDiff).toBe(data.diff)
  })

  it('jugadores ordenados por puntos, con posición media', () => {
    const pts = data.home.players.map((p) => p.points)
    expect(pts).toEqual([...pts].sort((a, b) => b - a))
    const a = data.home.players.find((p) => p.name === 'A')
    expect(a).toEqual({ name: 'A', points: 12 + 15 + 15, races: 3, avgPos: (1 + 2 + 1) / 3 })
    const sub = data.home.players.find((p) => p.name === 'Sub')
    expect(sub?.races).toBe(1)
    expect(data.home.missingPoints).toBe(1)
  })

  it('oculta los rivales con nombres automáticos y muestra los reales', () => {
    expect(data.away.players).toEqual([])
    const withRivals = buildWarImageData(event(), table, true)
    expect(withRivals.away.players).toHaveLength(6)
    expect(withRivals.away.players[0].points).toBeGreaterThanOrEqual(withRivals.away.players[5].points)
  })

  it('en curso: marca y huecos para las 12 carreras', () => {
    const open = buildWarImageData(event({ status: 'open', finished_at: null }), table, false)
    expect(open.inProgress).toBe(true)
    expect(open.slots).toBe(12)
    expect(open.date).toBe('2026-10-01T20:00:00Z')
    expect(data.inProgress).toBe(false)
    expect(data.date).toBe('2026-10-01T21:10:00Z')
  })

  it('sin carreras no falla', () => {
    const empty = buildWarImageData(event({ team_tag: null, opponent_tag: '  ' }), buildWarTable(players, []), false)
    expect(empty.races).toEqual([])
    expect(empty.home.tag).toBe('?')
    expect(empty.away.tag).toBe('?')
    expect(empty.scale).toEqual({ min: -10, max: 10, step: 10 })
  })
})

describe('hasRealOpponents', () => {
  it('por nombres al crear la war o resultados apuntados', () => {
    expect(hasRealOpponents(event(), races)).toBe(false)
    expect(hasRealOpponents(event({ opponent_players: ['', ' '] }), races)).toBe(false)
    expect(hasRealOpponents(event({ opponent_players: ['Rival'] }), races)).toBe(true)
    expect(hasRealOpponents(event(), [{ opponent_results: [{ name: 'x', position: 2 }] }])).toBe(true)
  })
})

describe('niceScale', () => {
  it('escalas redondas que cubren el máximo', () => {
    expect(niceScale([])).toEqual({ min: -10, max: 10, step: 10 })
    expect(niceScale([0, 0])).toEqual({ min: -10, max: 10, step: 10 })
    expect(niceScale([30, 12])).toEqual({ min: 0, max: 30, step: 10 })
    expect(niceScale([47])).toEqual({ min: 0, max: 60, step: 20 })
    expect(niceScale([32, 160, 294])).toEqual({ min: 0, max: 300, step: 100 })
    expect(niceScale([-120, -40])).toEqual({ min: -150, max: 0, step: 50 })
    expect(niceScale([8, 0, -4])).toEqual({ min: -5, max: 10, step: 5 })
  })
})

describe('utilidades', () => {
  it('signed', () => {
    expect([signed(5), signed(-3), signed(0)]).toEqual(['+5', '-3', '0'])
  })

  it('nombre de archivo sin caracteres raros', () => {
    expect(warImageFileName({ home: { tag: 'N/B' }, away: { tag: 'AP☆' }, date: '2026-10-01T21:10:00Z' } as never)).toBe(
      'war-NB-vs-AP-2026-10-01.png',
    )
    expect(warImageFileName({ home: { tag: 'ηβ' }, away: { tag: 'JJ' }, date: '2026-10-01' } as never)).toBe(
      'war-team-vs-JJ-2026-10-01.png',
    )
  })

  it('fitText recorta con elipsis', () => {
    const measure = (s: string) => s.length * 10
    expect(fitText('corto', 100, measure)).toBe('corto')
    expect(fitText('nombremuylargo', 60, measure)).toBe('nombr…')
    expect(fitText('abc', 5, measure)).toBe('…')
  })
})

describe('modo neutral', () => {
  const table = buildWarTable(players, races, ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'])
  // NB (izquierda) contra RKL: por orden alfabético NB va antes, así que no se intercambian
  const data = buildWarImageData(event(), table, false)
  // Al revés: la war la sube RKL, que alfabéticamente va después de NB
  const swappedInput = buildWarImageData(event({ team_tag: 'RKL', opponent_tag: 'NB' }), table, false)

  it('raceStats cuenta carreras ganadas, empatadas y la mejor carrera', () => {
    const s = raceStats(data)
    expect(s.winsHome + s.winsAway + s.ties).toBe(data.races.length)
    expect(s.winsHome).toBe(data.races.filter((r) => r.home > r.away).length)
    expect(s.best?.score).toBe(Math.max(...data.races.flatMap((r) => [r.home, r.away])))
    expect(s.avgHome + s.avgAway).toBeCloseTo((data.races.reduce((a, r) => a + r.home + r.away, 0)) / data.races.length, 5)
  })

  it('raceStats de una war sin carreras no da NaN', () => {
    expect(raceStats({ races: [] })).toEqual({ winsHome: 0, ties: 0, winsAway: 0, best: null, avgHome: 0, avgAway: 0 })
  })

  it('ordena los equipos por tag sin importar quién suba la war', () => {
    const a = neutralizeWarImage(data)
    const b = neutralizeWarImage(swappedInput)
    expect(a.swapped).toBe(false)
    expect(b.swapped).toBe(true)
    // NB va a la izquierda en los dos casos...
    expect(a.data.home.tag).toBe('NB')
    expect(b.data.home.tag).toBe('NB')
    // ...y conserva sus propios puntos: en el segundo caso NB era el equipo de la derecha
    expect(a.data.home.total).toBe(table.home)
    expect(b.data.home.total).toBe(table.away)
    expect(b.data.away.total).toBe(table.home)
    expect(b.data.races.map((r) => [r.home, r.away])).toEqual(data.races.map((r) => [r.away, r.home]))
  })

  it('al intercambiar, la diferencia se ve desde el nuevo equipo de la izquierda', () => {
    const b = neutralizeWarImage(swappedInput)
    expect(b.data.diff).toBe(-swappedInput.diff)
    expect(b.data.races.every((r, i) => r.diff === -swappedInput.races[i].diff && r.runningDiff === -swappedInput.races[i].runningDiff)).toBe(true)
  })

  it('la ordenación no distingue mayúsculas', () => {
    const lower = buildWarImageData(event({ team_tag: 'zz', opponent_tag: 'Aa' }), table, false)
    expect(neutralizeWarImage(lower).data.home.tag).toBe('Aa')
  })
})
