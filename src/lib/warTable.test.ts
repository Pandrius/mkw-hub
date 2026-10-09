import { describe, expect, it } from 'vitest'
import type { EventPlayer, EventRace } from './events'
import { buildWarTable, lorenziEditorUrl, lorenziImageUrl, lorenziText } from './warTable'

const players: EventPlayer[] = ['A', 'B', 'C', 'D', 'E', 'F', 'Sub'].map((name, i) => ({
  id: i + 1,
  event_id: 'ev',
  name,
  profile_id: null,
}))

const race = (race_no: number, positions: [number, number][], missing_home = 0, missing_away = 0): EventRace => ({
  id: race_no,
  race_no,
  track_id: 'rainbow-road',
  missing_home,
  missing_away,
  race_results: positions.map(([player_id, position]) => ({ player_id, position })),
})

describe('buildWarTable', () => {
  const table = buildWarTable(players, [
    race(1, [[1, 1], [2, 3], [3, 5], [4, 7], [5, 9], [6, 11]]),
    // Sale F, entra Sub; y falta uno nuestro (11 jugadores)
    race(2, [[1, 1], [2, 2], [3, 4], [4, 6], [7, 8]], 1, 0),
  ])

  it('suma los puntos de cada carrera', () => {
    expect(table.races.map((r) => [r.home, r.away])).toEqual([
      [45, 37],
      [15 + 12 + 9 + 7 + 5 + 1, 82 - (15 + 12 + 9 + 7 + 5 + 1)],
    ])
    expect(table.home + table.away).toBe(82 * 2)
    expect(table.races[1].runningDiff).toBe(table.diff)
  })

  it('puntos por jugador, ordenados, sin los que no han corrido', () => {
    expect(table.players.map((p) => [p.player.name, p.points])).toEqual([
      ['A', 30],
      ['B', 22],
      ['C', 17],
      ['D', 13],
      ['E', 4],
      ['Sub', 5],
      ['F', 2],
    ].sort((a, b) => (b[1] as number) - (a[1] as number)))
    expect(table.players.find((p) => p.player.name === 'Sub')?.positions).toEqual({ 2: 8 })
  })

  it('cuenta los puntos de ausentes', () => {
    expect(table.missingPoints).toBe(1)
  })

  it('genera el texto de Lorenzi con los puntos de cada carrera', () => {
    const text = lorenziText('MKH', 'ABC', table)
    expect(text.split('\n')).toEqual([
      '#title MKH vs ABC',
      'MKH',
      'A 15+15',
      'B 10+12',
      'C 8+9',
      'D 6+7',
      // Entre paréntesis, las carreras de quien no corrió todas
      'Sub(1) 5',
      'E(1) 4',
      'F(1) 2',
      'DC 1',
      '',
      'ABC',
      `ABC ${table.away}`,
    ])
  })

  it('limpia nombres que romperían el formato', () => {
    const t2 = buildWarTable([{ id: 1, event_id: 'ev', name: 'Pe[ck]\nmat', profile_id: null }], [])
    t2.players.push({ player: { id: 1, event_id: 'ev', name: 'Pe[ck]\nmat', profile_id: null }, points: 15, races: 1, positions: { 1: 1 } })
    expect(lorenziText('A', 'B', t2)).toContain('Pe ck mat 15')
  })

  it('URLs de Lorenzi con el texto codificado', () => {
    expect(lorenziImageUrl('#title A vs B\nA')).toBe('https://gb2.hlorenzi.com/table.png?data=%23title%20A%20vs%20B%0AA')
    expect(lorenziEditorUrl('x')).toBe('https://gb2.hlorenzi.com/table?data=x')
  })

  it('genera tabla completa de 12 jugadores automáticamente con los 6 rivales', () => {
    const rivals = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']
    // Home toma posiciones 1, 3, 5, 7, 9, 11 (suma: 15+10+8+6+4+2 = 45 pts)
    // Rivales automáticamente toman 2, 4, 6, 8, 10, 12 (suma: 12+9+7+5+3+1 = 37 pts)
    const t12 = buildWarTable(players, [race(1, [[1, 1], [2, 3], [3, 5], [4, 7], [5, 9], [6, 11]])], rivals)

    expect(t12.opponentPlayers).toHaveLength(6)
    expect(t12.opponentPlayers.map((p) => [p.name, p.points])).toEqual([
      ['R1', 12],
      ['R2', 9],
      ['R3', 7],
      ['R4', 5],
      ['R5', 3],
      ['R6', 1],
    ])
    expect(t12.home).toBe(45)
    expect(t12.away).toBe(37)

    const fullText = lorenziText('NEB', 'SOL', t12)
    expect(fullText).toContain('NEB')
    expect(fullText).toContain('SOL')
    expect(fullText).toContain('R1 12')
    expect(fullText).toContain('R6 1')
    expect(fullText).not.toContain('SOL 37') // Rivales individuales en vez de solo total
  })

  it('respeta resultados específicos de rivales cuando se proporcionan', () => {
    const rivals = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']
    const rWithOpponents: EventRace = {
      id: 1,
      race_no: 1,
      track_id: 'luigi-circuit',
      missing_home: 0,
      missing_away: 0,
      race_results: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]].map(([player_id, position]) => ({
        player_id,
        position,
      })),
      opponent_results: [
        { name: 'R1', position: 12 },
        { name: 'R2', position: 11 },
        { name: 'R3', position: 10 },
        { name: 'R4', position: 9 },
        { name: 'R5', position: 8 },
        { name: 'R6', position: 7 },
      ],
    }
    const table = buildWarTable(players, [rWithOpponents], rivals)
    const r6 = table.opponentPlayers.find((p) => p.name === 'R6')
    expect(r6?.positions[1]).toBe(7)
    expect(r6?.points).toBe(6) // 7º lugar = 6 pts
  })
})

describe('penalties', () => {
  const rs = [race(1, [[1, 1], [2, 3], [3, 5], [4, 7], [5, 9], [6, 11]])]
  const plain = buildWarTable(players, rs)
  const withPen = buildWarTable(players, rs, null, [
    { side: 'home', label: 'Penalty', points: -5 },
    { side: 'away', label: 'Late', points: -3 },
  ])

  it('restan al total del equipo penalizado, no a las carreras', () => {
    expect(withPen.home).toBe(plain.home - 5)
    expect(withPen.away).toBe(plain.away - 3)
    expect(withPen.diff).toBe(plain.diff - 2)
    expect(withPen.races[0].home).toBe(plain.races[0].home)
  })

  it('aparecen como línea propia en el texto de Lorenzi', () => {
    const text = lorenziText('NB', 'RKL', withPen)
    expect(text).toContain('Penalty -5')
    expect(text).toContain('Late -3')
    // El total del rival sin jugadores es el de las carreras: Lorenzi le suma la penalty
    expect(text).toContain(`RKL ${plain.away}`)
  })
})

describe('sustituciones en la tabla', () => {
  // Peckmat (id 1) corre las 2 primeras y Sub (id 7) la tercera; Lorenzi muestra las carreras de cada uno
  const rs = [
    race(1, [[1, 1], [2, 3], [3, 5], [4, 7], [5, 9], [6, 11]]),
    race(2, [[1, 1], [2, 3], [3, 5], [4, 7], [5, 9], [6, 11]]),
    race(3, [[7, 1], [2, 3], [3, 5], [4, 7], [5, 9], [6, 11]]),
  ]
  const table = buildWarTable(players, rs)

  it('cuenta las carreras de cada jugador', () => {
    expect(table.players.find((p) => p.player.name === 'A')?.races).toBe(2)
    expect(table.players.find((p) => p.player.name === 'Sub')?.races).toBe(1)
  })

  it('el texto de Lorenzi indica entre paréntesis las carreras de quien no corrió todas', () => {
    const text = lorenziText('NB', 'RKL', table)
    expect(text).toContain('A(2) 15+15')
    expect(text).toContain('Sub(1) 15')
    expect(text).toMatch(/\nB 10\+10\+10/)
  })

  it('con sustituciones, solo los rivales que corren reparten las posiciones restantes', () => {
    const rivals = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']
    const t = buildWarTable(players, [rs[0], rs[2]], rivals, [], [{ side: 'away', out: 'R1', in: 'R7', race_no: 3 }])
    const r1 = t.opponentPlayers.find((p) => p.name === 'R1')
    const r7 = t.opponentPlayers.find((p) => p.name === 'R7')
    expect(Object.keys(r1?.positions ?? {})).toEqual(['1'])
    expect(Object.keys(r7?.positions ?? {})).toEqual(['3'])
  })
})
