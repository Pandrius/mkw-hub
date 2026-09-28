import { describe, expect, it } from 'vitest'
import { scoreRace, scoreTeamRace, validateRace, type TeamSide } from './scoring'

const race = (sides: TeamSide[], missing: TeamSide[] = []) => ({
  placements: sides.map((side, i) => ({ side, position: i + 1 })),
  missing,
})

describe('scoreRace', () => {
  it('reparte 82 puntos en una carrera de 12', () => {
    const r = race(['red', 'blue', 'red', 'blue', 'red', 'blue', 'red', 'blue', 'red', 'blue', 'red', 'blue'])
    const s = scoreRace(r)
    expect(s.red + s.blue).toBe(82)
    expect(s.red).toBe(15 + 10 + 8 + 6 + 4 + 2)
  })

  it('en una carrera de 11 el ausente cuenta como 12.º (1 punto)', () => {
    const r = race(['red', 'red', 'red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue', 'blue'], ['blue'])
    const s = scoreRace(r)
    expect(s.red).toBe(15 + 12 + 10 + 9 + 8 + 7)
    expect(s.blue).toBe(6 + 5 + 4 + 3 + 2 + 1)
    expect(s.red + s.blue).toBe(82)
  })

  it('en una carrera de 10 cada ausente recibe 1 punto y se pierde 1 punto', () => {
    const r = race(['red', 'red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue', 'blue'], ['red', 'blue'])
    const s = scoreRace(r)
    expect(s.red).toBe(15 + 12 + 10 + 9 + 8 + 1)
    expect(s.blue).toBe(7 + 6 + 5 + 4 + 3 + 1)
    expect(s.red + s.blue).toBe(81)
  })

  it('permite que los dos ausentes sean del mismo equipo', () => {
    const r = race(['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue'], ['red', 'red'])
    const s = scoreRace(r)
    expect(s.red).toBe(15 + 12 + 10 + 9 + 1 + 1)
    expect(s.red + s.blue).toBe(81)
  })
})

describe('scoreTeamRace', () => {
  it('calcula el rival con las posiciones restantes', () => {
    expect(scoreTeamRace([1, 3, 5, 7, 9, 11])).toEqual({ home: 15 + 10 + 8 + 6 + 4 + 2, away: 12 + 9 + 7 + 5 + 3 + 1 })
  })

  it('11 jugadores con uno de los nuestros ausente', () => {
    const s = scoreTeamRace([1, 2, 4, 6, 8], 1, 0)
    expect(s.home).toBe(15 + 12 + 9 + 7 + 5 + 1)
    expect(s.home + s.away).toBe(82)
  })

  it('10 jugadores, uno ausente por equipo', () => {
    const s = scoreTeamRace([1, 2, 3, 4, 5], 1, 1)
    expect(s.home).toBe(15 + 12 + 10 + 9 + 8 + 1)
    expect(s.home + s.away).toBe(81)
  })

  it('lanza error si la carrera no es válida', () => {
    expect(() => scoreTeamRace([1, 1, 2, 3, 4, 5])).toThrow()
  })
})

describe('validateRace', () => {
  it('rechaza posiciones repetidas', () => {
    const r = race(['red', 'blue', 'red', 'blue', 'red', 'blue', 'red', 'blue', 'red', 'blue', 'red', 'blue'])
    r.placements[1].position = 1
    expect(validateRace(r)).toMatch(/repetida/)
  })

  it('rechaza una posición 12 en una carrera de 11', () => {
    const r = race(['red', 'red', 'red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue', 'blue'], ['blue'])
    r.placements[10].position = 12
    expect(validateRace(r)).toMatch(/no es válida/)
  })

  it('rechaza equipos que no tengan 6 jugadores', () => {
    const r = race(['red', 'red', 'red', 'red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue', 'blue'])
    expect(validateRace(r)).toMatch(/rojo tiene 7/)
  })

  it('rechaza más de 2 ausentes', () => {
    const r = race(['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue', 'blue'], ['red', 'red', 'blue'])
    expect(validateRace(r)).toMatch(/máximo/)
  })
})
