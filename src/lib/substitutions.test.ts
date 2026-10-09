import { describe, expect, it } from 'vitest'
import { activeNames, isActiveInRace, parseSubstitutions, type Substitution } from './substitutions'

// Desde la carrera 9 entra Polimar por Peckmat; desde la 5 entra x por un rival
const subs: Substitution[] = [
  { side: 'home', out: 'Peckmat', in: 'Polimar', race_no: 9 },
  { side: 'away', out: 'R1', in: 'R7', race_no: 5 },
]

describe('isActiveInRace', () => {
  it('quien sale corre hasta la carrera anterior y quien entra desde esa', () => {
    expect(isActiveInRace('Peckmat', 'home', subs, 8)).toBe(true)
    expect(isActiveInRace('Peckmat', 'home', subs, 9)).toBe(false)
    expect(isActiveInRace('Polimar', 'home', subs, 8)).toBe(false)
    expect(isActiveInRace('Polimar', 'home', subs, 9)).toBe(true)
    expect(isActiveInRace('Polimar', 'home', subs, 12)).toBe(true)
  })
  it('los que no aparecen en ninguna sustitución corren siempre', () => {
    for (let r = 1; r <= 12; r++) expect(isActiveInRace('Otro', 'home', subs, r)).toBe(true)
  })
  it('cada equipo va por separado aunque coincida el nombre', () => {
    expect(isActiveInRace('Peckmat', 'away', subs, 12)).toBe(true)
  })
})

describe('activeNames', () => {
  const home = ['Peckmat', 'A', 'B', 'Polimar']
  it('mantiene el orden y deja solo a quien corre', () => {
    expect(activeNames(home, 'home', subs, 8)).toEqual(['Peckmat', 'A', 'B'])
    expect(activeNames(home, 'home', subs, 9)).toEqual(['A', 'B', 'Polimar'])
  })
  it('sin sustituciones corren todos', () => {
    expect(activeNames(home, 'home', [], 3)).toEqual(home)
  })
})

describe('parseSubstitutions', () => {
  it('descarta lo que no tiene la forma esperada', () => {
    expect(parseSubstitutions(null)).toEqual([])
    expect(
      parseSubstitutions([
        { side: 'home', out: 'A', in: 'B', race_no: 3 },
        { side: 'x', out: 'A', in: 'B', race_no: 3 },
        { side: 'home', out: 'A', in: 'B', race_no: 13 },
        { side: 'home', out: 'A', race_no: 3 },
      ]),
    ).toEqual([{ side: 'home', out: 'A', in: 'B', race_no: 3 }])
  })
})
