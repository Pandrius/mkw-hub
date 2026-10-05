import { describe, expect, it } from 'vitest'
import {
  findLineupSlot,
  findTrack,
  inGameName,
  lineupPlayers,
  nextRaceNo,
  parseLoungePosition,
  parsePlayerList,
  parseWarPositions,
  trackChoices,
} from './parse'

const lineup = ['tortelini', 'Bob', 'Carl', 'Dan', 'Eve', 'Fay'].map((name, i) => ({ id: i + 1, name }))
const all = [...lineup, { id: 7, name: 'Gus' }]

describe('parsePlayerList', () => {
  it('separa por comas, punto y coma o saltos de línea y conserva los alias', () => {
    expect(parsePlayerList(' Peckmat = tortelini, Bob;Carl\nDan ,, ')).toEqual(['Peckmat = tortelini', 'Bob', 'Carl', 'Dan'])
    expect(parsePlayerList(undefined)).toEqual([])
  })

  it('inGameName toma la parte tras "="', () => {
    expect(inGameName('Peckmat = tortelini')).toBe('tortelini')
    expect(inGameName('Bob')).toBe('Bob')
  })
})

describe('parseWarPositions', () => {
  it('asigna las posiciones en orden de alineación', () => {
    const r = parseWarPositions('1 3 5 7 9 11', lineup, all)
    expect(r).toEqual({
      missingHome: 0,
      results: [1, 3, 5, 7, 9, 11].map((position, i) => ({ player_id: i + 1, position })),
    })
  })

  it('acepta comas y marca ausentes con x', () => {
    const r = parseWarPositions('1,2, x, 4 6 8', lineup, all)
    expect(r).toMatchObject({ missingHome: 1, results: [{ player_id: 1 }, { player_id: 2 }, { player_id: 4 }, { player_id: 5 }, { player_id: 6 }] })
  })

  it('acepta nombre=posición para cualquier jugador del evento', () => {
    const r = parseWarPositions('Gus=2, tortelini: 1, bob=3, carl=4, dan=5, eve=6', lineup, all)
    expect(r).toMatchObject({ missingHome: 0 })
    expect(r).toHaveProperty('results', expect.arrayContaining([{ player_id: 7, position: 2 }, { player_id: 1, position: 1 }]))
    expect(r).toHaveProperty('results.length', 6)
  })

  it('valida número de posiciones, rango, repetidas y ausentes', () => {
    expect(parseWarPositions('', lineup, all)).toEqual({ error: 'posEmpty' })
    expect(parseWarPositions('1 2 3', lineup, all)).toMatchObject({ error: 'posCount' })
    expect(parseWarPositions('1 2 3 4 5 13', lineup, all)).toMatchObject({ error: 'posRange', vars: { pos: 13 } })
    expect(parseWarPositions('1 1 3 4 5 6', lineup, all)).toMatchObject({ error: 'posRepeated', vars: { pos: 1 } })
    expect(parseWarPositions('1 2 a 4 5 6', lineup, all)).toMatchObject({ error: 'posBadToken', vars: { token: 'a' } })
    expect(parseWarPositions('1 x x x 5 6', lineup, all)).toEqual({ error: 'posMissing' })
    expect(parseWarPositions('Zoe=1', lineup, all)).toMatchObject({ error: 'posUnknownPlayer' })
    expect(parseWarPositions('Bob=1, bob=2', lineup, all)).toMatchObject({ error: 'posRepeatedPlayer' })
  })

  it('en carreras de 11 o 10 la posición máxima baja', () => {
    // Falta uno nuestro → 11 jugadores: el 12 ya no vale
    expect(parseWarPositions('1 2 x 4 5 12', lineup, all)).toMatchObject({ error: 'posRange', vars: { racers: 11 } })
    expect(parseWarPositions('1 2 x 4 5 11', lineup, all)).toMatchObject({ missingHome: 1 })
    // Faltan dos del rival → 10 jugadores
    expect(parseWarPositions('1 2 3 4 5 11', lineup, all, 2)).toMatchObject({ error: 'posRange', vars: { racers: 10 } })
    // Uno nuestro y dos del rival: demasiados
    expect(parseWarPositions('1 2 x 4 5 6', lineup, all, 2)).toEqual({ error: 'posTotalMissing' })
  })
})

describe('parseLoungePosition', () => {
  it('acepta 1..24 con o sin ordinal', () => {
    expect(parseLoungePosition('17', 9)).toEqual({ missingHome: 0, results: [{ player_id: 9, position: 17 }] })
    expect(parseLoungePosition('3.º', 9)).toMatchObject({ results: [{ position: 3 }] })
    expect(parseLoungePosition('2nd', 9)).toMatchObject({ results: [{ position: 2 }] })
    expect(parseLoungePosition('25', 9)).toEqual({ error: 'posLounge' })
    expect(parseLoungePosition('1 2', 9)).toEqual({ error: 'posLounge' })
  })
})

describe('pistas', () => {
  it('findTrack por abreviatura, id o nombre', () => {
    expect(findTrack('rdkp')?.id).toBe('dk-pass')
    expect(findTrack('crown-city')?.id).toBe('crown-city')
    expect(findTrack('rainbow road')?.id).toBe('rainbow-road')
    expect(findTrack('sundae')?.id).toBe('sky-high-sundae')
    expect(findTrack('circuit')).toBeUndefined() // ambigua
    expect(findTrack('')).toBeUndefined()
  })

  it('trackChoices prioriza la abreviatura exacta y respeta el límite de 25', () => {
    expect(trackChoices('cc')[0]).toEqual({ name: 'CC · Crown City', value: 'CC' })
    expect(trackChoices('dkp').map((c) => c.value)).toContain('rDKP')
    expect(trackChoices('peach').map((c) => c.value)).toEqual(expect.arrayContaining(['PS', 'rPB']))
    expect(trackChoices('').length).toBe(25)
    expect(trackChoices('zzzz')).toEqual([])
  })
})

describe('alineación y número de carrera', () => {
  it('nextRaceNo es el mayor + 1', () => {
    expect(nextRaceNo([])).toBe(1)
    expect(nextRaceNo([{ race_no: 1 }, { race_no: 4 }])).toBe(5)
  })

  it('findLineupSlot por nombre, alias o número', () => {
    expect(findLineupSlot(lineup, 'bob')).toBe(1)
    expect(findLineupSlot(lineup, 'Peckmat = tortelini')).toBe(0)
    expect(findLineupSlot(lineup, '6')).toBe(5)
    expect(findLineupSlot(lineup, '7')).toBe(-1)
    expect(findLineupSlot(lineup, 'Gus')).toBe(-1)
  })

  it('lineupPlayers usa los ids guardados o, si no hay, los 6 primeros', () => {
    expect(lineupPlayers([7, 2], all).map((p) => p.name)).toEqual(['Gus', 'Bob'])
    expect(lineupPlayers([], all).map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
