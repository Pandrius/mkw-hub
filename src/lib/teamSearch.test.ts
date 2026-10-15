import { describe, expect, it } from 'vitest'
import { rankTeams, teamMatchRank } from './search'

const team = (name: string, tag: string, parent_name: string | null = null) => ({ name, tag, parent_name })

describe('rankTeams', () => {
  const teams = [
    team('After Dark', 'AD'),
    team('Dark Horse', 'DH'),
    team('Rozando la Katástrofe', 'RK'),
    team('Rock Kart', 'RK'),
    team('RK Academy', 'RKA'),
    team('Park Racers', 'PR'),
    team('Arkham', 'ARK'),
    team('Lobos', 'LB', 'Rk Club'),
  ]

  it('al buscar un tag salen primero los equipos con ese tag exacto, aunque otros lo lleven en el nombre', () => {
    const names = rankTeams('RK', teams).map((t) => t.name)
    expect(names.slice(0, 2)).toEqual(['Rock Kart', 'Rozando la Katástrofe'])
    expect(names[2]).toBe('RK Academy')
    expect(names.indexOf('After Dark')).toBeGreaterThan(names.indexOf('Arkham'))
  })

  it('después de los tags vienen los nombres: empieza por, palabra que empieza por, contiene y club', () => {
    const names = rankTeams('dark', teams).map((t) => t.name)
    expect(names).toEqual(['Dark Horse', 'After Dark'])
    expect(rankTeams('rk club', teams).map((t) => t.name)).toEqual(['Lobos'])
  })

  it('no distingue mayúsculas ni tildes y descarta lo que no coincide', () => {
    expect(rankTeams('katastrofe', teams).map((t) => t.name)).toEqual(['Rozando la Katástrofe'])
    expect(rankTeams('zzz', teams)).toEqual([])
    expect(teamMatchRank('', teams[0])).toBe(0)
  })
})
