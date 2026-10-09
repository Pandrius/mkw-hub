import { describe, expect, it } from 'vitest'
import { mirrorPenalties, parsePenalties, penaltyTotals, type Penalty } from './penalties'

const list: Penalty[] = [
  { side: 'home', label: 'Penalty', points: -5 },
  { side: 'away', label: 'Late', points: -3 },
  { side: 'home', label: 'DC', points: -2 },
]

describe('penaltyTotals', () => {
  it('suma las penalties de cada equipo', () => {
    expect(penaltyTotals(list)).toEqual({ home: -7, away: -3 })
  })
  it('sin penalties no resta nada', () => {
    expect(penaltyTotals([])).toEqual({ home: 0, away: 0 })
    expect(penaltyTotals(undefined)).toEqual({ home: 0, away: 0 })
  })
})

describe('mirrorPenalties', () => {
  it('da la vuelta al equipo penalizado', () => {
    expect(penaltyTotals(mirrorPenalties(list))).toEqual({ home: -3, away: -7 })
  })
})

describe('parsePenalties', () => {
  it('descarta lo que no tiene la forma esperada', () => {
    expect(parsePenalties(null)).toEqual([])
    expect(parsePenalties('x')).toEqual([])
    expect(
      parsePenalties([
        { side: 'home', label: 'Ok', points: -4 },
        { side: 'other', label: 'Mal equipo', points: -4 },
        { side: 'away', label: 'Positivos no', points: 4 },
        { side: 'away', label: 'Decimales no', points: -1.5 },
        { side: 'away', points: -1 },
        null,
      ]),
    ).toEqual([{ side: 'home', label: 'Ok', points: -4 }])
  })
})
