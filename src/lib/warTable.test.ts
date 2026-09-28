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
      'Sub 5',
      'E 4',
      'F 2',
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
})
