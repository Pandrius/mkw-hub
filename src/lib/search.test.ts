import { describe, expect, it } from 'vitest'
import { TRACKS } from '../data/tracks'
import {
  hitHref,
  isSearchShortcut,
  isTypingTarget,
  matchScore,
  moveIndex,
  normalize,
  rankHits,
  sanitizeTerm,
  scoreHit,
  searchTracks,
  type SearchHit,
} from './search'

const player = (id: string, name: string): SearchHit => ({ kind: 'player', id, label: name, terms: [name] })
const team = (id: string, name: string, tag: string, parent: string | null = null): SearchHit => ({
  kind: 'team',
  id,
  label: name,
  detail: tag,
  terms: [name, tag, parent],
})

describe('normalize', () => {
  it('quita tildes, mayúsculas y espacios de más', () => {
    expect(normalize('  Estadísticas  DE   Peña ')).toBe('estadisticas de pena')
  })
})

describe('sanitizeTerm', () => {
  it('quita los caracteres que romperían el filtro de PostgREST', () => {
    expect(sanitizeTerm('a%b_c*d,e(f)g"h\'i\\j')).toBe('a b c d e f g h i j')
    expect(sanitizeTerm('  Team   Japan ')).toBe('Team Japan')
  })

  it('limita la longitud', () => {
    expect(sanitizeTerm('x'.repeat(200))).toHaveLength(50)
  })
})

describe('matchScore', () => {
  it('prioriza igual > empieza por > palabra > contiene', () => {
    expect(matchScore('rr', 'RR')).toBe(100)
    expect(matchScore('rain', 'Rainbow Road')).toBe(80)
    expect(matchScore('road', 'Rainbow Road')).toBe(60)
    expect(matchScore('bow', 'Rainbow Road')).toBe(40)
    expect(matchScore('xyz', 'Rainbow Road')).toBe(0)
  })

  it('no distingue tildes ni mayúsculas y aguanta campos vacíos', () => {
    expect(matchScore('pena', 'Peña')).toBe(100)
    expect(matchScore('a', null)).toBe(0)
    expect(matchScore('   ', 'algo')).toBe(0)
  })
})

describe('scoreHit', () => {
  it('el campo principal puntúa algo más que los secundarios', () => {
    expect(scoreHit('jp', team('1', 'JP', 'XX'))).toBeGreaterThan(scoreHit('jp', team('2', 'Japan', 'JP')))
  })

  it('coincide por el club padre', () => {
    expect(scoreHit('zeta', team('3', 'Academy', 'ZA', 'Zeta Gaming'))).toBeGreaterThan(0)
  })
})

describe('searchTracks', () => {
  it('encuentra por nombre y por abreviatura sin distinguir mayúsculas', () => {
    expect(searchTracks('rainbow', TRACKS).map((h) => h.id)).toEqual(['rainbow-road'])
    expect(searchTracks('rdkp', TRACKS).map((h) => h.id)).toEqual(['dk-pass'])
  })

  it('la "r" de las retro es opcional', () => {
    expect(searchTracks('dkp', TRACKS).map((h) => h.id)).toContain('dk-pass')
  })

  it('consulta vacía no devuelve nada', () => {
    expect(searchTracks('  ', TRACKS)).toEqual([])
  })
})

describe('rankHits', () => {
  it('agrupa por tipo en orden fijo: jugadores, equipos, pistas', () => {
    const groups = rankHits('ma', [...searchTracks('ma', TRACKS), team('1', 'Mario Mafia', 'MM'), player('p', 'Mario')])
    expect(groups.map((g) => g.kind)).toEqual(['player', 'team', 'track'])
  })

  it('ordena por puntuación y luego alfabéticamente', () => {
    const groups = rankHits('ka', [
      team('1', 'Super Kart', 'SK'),
      team('2', 'Kart Lovers', 'KL'),
      team('3', 'Kappa', 'KP'),
      team('4', 'KA', 'KA'),
    ])
    expect(groups[0].hits.map((h) => h.id)).toEqual(['4', '3', '2', '1'])
  })

  it('descarta lo que ya no coincide y los duplicados', () => {
    const groups = rankHits('neo', [player('a', 'Neo'), player('a', 'Neo'), player('b', 'Trinity')])
    expect(groups).toEqual([{ kind: 'player', hits: [player('a', 'Neo')] }])
  })

  it('limita los resultados de cada tipo', () => {
    const many = Array.from({ length: 12 }, (_, i) => player(String(i), `Player ${i}`))
    expect(rankHits('player', many, 5)[0].hits).toHaveLength(5)
  })

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(rankHits('zzz', [player('a', 'Neo')])).toEqual([])
  })
})

describe('hitHref', () => {
  it('lleva a la página de cada tipo', () => {
    expect(hitHref({ kind: 'player', id: 'abc-123' })).toBe('/estadisticas/abc-123')
    expect(hitHref({ kind: 'team', id: '42' })).toBe('/equipos/42')
    expect(hitHref({ kind: 'track', id: 'dk-pass' })).toBe('/pistas/dk-pass')
  })
})

describe('moveIndex', () => {
  it('avanza y retrocede dando la vuelta', () => {
    expect(moveIndex(-1, 1, 3)).toBe(0)
    expect(moveIndex(-1, -1, 3)).toBe(2)
    expect(moveIndex(2, 1, 3)).toBe(0)
    expect(moveIndex(0, -1, 3)).toBe(2)
    expect(moveIndex(1, 1, 3)).toBe(2)
  })

  it('sin opciones no hay ninguna activa', () => {
    expect(moveIndex(0, 1, 0)).toBe(-1)
  })
})

describe('atajos de teclado', () => {
  const input = { tagName: 'INPUT' } as unknown as EventTarget
  const body = { tagName: 'BODY' } as unknown as EventTarget
  const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}, target = body) => ({
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target,
    ...mods,
  })

  it('reconoce los campos de texto', () => {
    expect(isTypingTarget(input)).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true)
    expect(isTypingTarget(body)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })

  it('"/" abre el buscador salvo si se está escribiendo', () => {
    expect(isSearchShortcut(key('/'))).toBe(true)
    expect(isSearchShortcut(key('/', {}, input))).toBe(false)
  })

  it('Ctrl+K y Cmd+K funcionan siempre', () => {
    expect(isSearchShortcut(key('k', { ctrlKey: true }, input))).toBe(true)
    expect(isSearchShortcut(key('K', { metaKey: true }))).toBe(true)
    expect(isSearchShortcut(key('k'))).toBe(false)
  })
})
