import { describe, expect, it } from 'vitest'
import { parsePoints, rankRows, tableText, type FreeRow } from './freeTable'

const row = (id: number, name: string, points: string): FreeRow => ({ id, name, points })

describe('tabla libre', () => {
  it('entiende negativos, decimales y campos vacíos', () => {
    expect(parsePoints('-15')).toBe(-15)
    expect(parsePoints('7,5')).toBe(7.5)
    expect(parsePoints('')).toBe(0)
    expect(parsePoints('abc')).toBe(0)
  })

  it('ordena por puntos, los empates comparten puesto y se ignoran filas vacías', () => {
    const ranked = rankRows([row(1, 'B', '80'), row(2, '', ''), row(3, 'A', '100'), row(4, 'C', '80'), row(5, 'D', '-5')])
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([['A', 1], ['B', 2], ['C', 2], ['D', 4]])
  })

  it('sin límite de jugadores', () => {
    const many = Array.from({ length: 40 }, (_, i) => row(i, `P${i}`, String(i)))
    expect(rankRows(many)).toHaveLength(40)
  })

  it('texto plano', () => {
    expect(tableText('Torneo', rankRows([row(1, 'A', '10'), row(2, 'B', '5')]))).toBe('Torneo\n1. A — 10\n2. B — 5')
  })
})
