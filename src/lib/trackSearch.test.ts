import { describe, expect, it } from 'vitest'
import { TRACKS } from '../data/tracks'
import { searchTracks } from './trackSearch'

describe('searchTracks', () => {
  it('con el campo vacío devuelve todas las pistas en su orden', () => {
    expect(searchTracks('')).toEqual(TRACKS)
    expect(searchTracks('   ')).toEqual(TRACKS)
  })

  it('encuentra por abreviatura, sin importar mayúsculas', () => {
    expect(searchTracks('rr')[0].abbr).toBe('RR')
    expect(searchTracks('RR')[0].abbr).toBe('RR')
  })

  it('la abreviatura exacta va antes que los nombres que solo la contienen', () => {
    const [first] = searchTracks('dd')
    expect(first.abbr).toBe('DD')
  })

  it('encuentra por nombre, también por una palabra de en medio y sin tildes', () => {
    expect(searchTracks('rainbow').some((t) => t.id === 'rainbow-road')).toBe(true)
    expect(searchTracks('castle').length).toBeGreaterThan(0)
    expect(searchTracks('RÁINBOW').some((t) => t.id === 'rainbow-road')).toBe(true)
  })

  it('ignora apóstrofes y signos del nombre', () => {
    expect(searchTracks('bowsers').some((t) => t.id === 'bowsers-castle')).toBe(true)
    expect(searchTracks("bowser's").some((t) => t.id === 'bowsers-castle')).toBe(true)
  })

  it('varias palabras: todas deben aparecer', () => {
    const r = searchTracks('ghost valley')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((t) => /ghost/i.test(t.name) && /valley/i.test(t.name))).toBe(true)
  })

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(searchTracks('zzzzqq')).toEqual([])
  })
})
