import { describe, expect, it } from 'vitest'
import { buildTable, decodeWar, emptyWar, encodeWar, hasContent, lorenziFreeText, medalOf, parsePoints, placeOf, tableText, type FreeTeam, type FreeWar } from './freeTable'

const team = (tag: string, players: [string, string][], name = ''): FreeTeam => ({ tag, name, players: players.map(([n, p], id) => ({ id, name: n, points: p })) })
const war = (home: FreeTeam, away: FreeTeam, title = ''): FreeWar => ({ title, home, away })

describe('parsePoints', () => {
  it('entiende negativos, decimales y campos vacíos', () => {
    expect(parsePoints('-15')).toBe(-15)
    expect(parsePoints('7,5')).toBe(7.5)
    expect(parsePoints('')).toBe(0)
    expect(parsePoints('abc')).toBe(0)
  })

  it('suma los puntos de cada carrera como en Lorenzi', () => {
    expect(parsePoints('15+12+10')).toBe(37)
    expect(parsePoints(' 15 + 12 ')).toBe(27)
    expect(parsePoints('10+-5')).toBe(5)
    expect(parsePoints('15+')).toBe(0)
  })
})

describe('buildTable', () => {
  const w = war(team('NB', [['Ana', '40'], ['Beto', '85'], ['', ''], ['Cris', '85']], 'Nebulosa'), team('RKL', [['Dani', '15+12'], ['Eli', '-5']]), 'Final')

  it('ordena a los jugadores dentro de cada equipo y suma los totales', () => {
    const t = buildTable(w)
    expect(t.home.players.map((p) => p.name)).toEqual(['Beto', 'Cris', 'Ana'])
    expect(t.home.total).toBe(210)
    expect(t.away.players.map((p) => [p.name, p.points])).toEqual([['Dani', 27], ['Eli', -5]])
    expect(t.away.total).toBe(22)
    expect(t.diff).toBe(188)
    expect(t.title).toBe('Final')
  })

  it('sin tags usa Team 1 y Team 2, y no limita los jugadores', () => {
    const many = team('', Array.from({ length: 40 }, (_, i) => [`P${i}`, String(i)] as [string, string]))
    const t = buildTable(war(many, team('', [])))
    expect(t.home.tag).toBe('Team 1')
    expect(t.away.tag).toBe('Team 2')
    expect(t.home.players).toHaveLength(40)
  })

  it('la tabla vacía no tiene contenido', () => {
    expect(hasContent(buildTable(emptyWar()))).toBe(false)
    expect(hasContent(buildTable(w))).toBe(true)
  })

  it('medallas: los tres mejores de los dos equipos, con empates', () => {
    const t = buildTable(w)
    expect(medalOf(85, t)).toBe(0)
    expect(medalOf(40, t)).toBe(2)
    expect(medalOf(-5, t)).toBeNull()
  })
})

describe('textos', () => {
  const w = war(team('NB', [['Ana', '10+5'], ['Beto', '20']], 'Nebulosa'), team('RKL', [['Dani', '7']]), 'Final')

  it('texto plano', () => {
    expect(tableText(buildTable(w))).toBe('Final\n\nNB (Nebulosa) — 35\n1. Beto — 20\n2. Ana — 15\n\nRKL — 7\n1. Dani — 7')
  })

  it('formato de Lorenzi, con las sumas tal cual', () => {
    expect(lorenziFreeText(w)).toBe('#title Final\nNB\nAna 10+5\nBeto 20\n\nRKL\nDani 7')
  })
})

describe('enlace compartible', () => {
  it('ida y vuelta con tildes, símbolos, negativos y diseño', () => {
    const w = war(team('ÑB', [['Peckmat ñ', '100'], ['', ''], ['日本', '-5']], 'Nebulosa'), team('RKL', [['Dani', '15+12']]), 'Torneo — final')
    const decoded = decodeWar(encodeWar(w, { preset: 'versus', colors: { accent: '#ff0000' } }))!
    expect(decoded.design).toEqual({ preset: 'versus', colors: { accent: '#ff0000' } })
    expect(decoded.war.title).toBe('Torneo — final')
    expect(decoded.war.home).toMatchObject({ tag: 'ÑB', name: 'Nebulosa' })
    expect(decoded.war.home.players.map((p) => [p.name, p.points])).toEqual([['Peckmat ñ', '100'], ['日本', '-5']])
    expect(decoded.war.away.players.map((p) => [p.name, p.points])).toEqual([['Dani', '15+12']])
  })

  it('sin diseño', () => {
    expect(decodeWar(encodeWar(war(team('A', []), team('B', []))))!.design).toBeNull()
  })

  it('rechaza datos que no son una tabla', () => {
    expect(decodeWar(null)).toBeNull()
    expect(decodeWar('%%%')).toBeNull()
    expect(decodeWar(btoa('{"v":1}'))).toBeNull()
    expect(decodeWar(btoa('{"v":2,"h":5}'))).toBeNull()
    expect(decodeWar('a'.repeat(7000))).toBeNull()
  })
})

describe('placeOf', () => {
  const player = (points: number) => ({ name: 'x', points })
  const t = { home: { tag: 'A', name: '', total: 0, players: [player(90), player(70), player(70)] }, away: { tag: 'B', name: '', total: 0, players: [player(80), player(-5)] } }

  it('el puesto en la sala cuenta a los dos equipos juntos y los empates lo comparten', () => {
    expect([90, 80, 70, 70, -5].map((p) => placeOf(p, t))).toEqual([1, 2, 3, 3, 5])
  })

  it('con un solo jugador no hay puesto que enseñar', () => {
    expect(placeOf(10, { home: { tag: 'A', name: '', total: 10, players: [player(10)] }, away: { tag: 'B', name: '', total: 0, players: [] } })).toBeNull()
  })
})
