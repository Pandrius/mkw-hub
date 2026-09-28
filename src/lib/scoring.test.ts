import { describe, expect, it } from 'vitest'
import { scoreRace, validateRace, type TeamSide } from './scoring'

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
