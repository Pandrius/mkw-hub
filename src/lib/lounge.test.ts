import { describe, expect, it } from 'vitest'
import {
  bestGroup,
  computeLoungeStats,
  eventScore,
  formatOf,
  matchLoungeEvents,
  matchWars,
  mmrSeries,
  parseChanges,
  topPercent,
  weekStart,
  type LoungeChange,
  type LoungeTable,
} from './lounge'

let nextId = 1
function change(over: Partial<LoungeChange> & { time: string }): LoungeChange {
  return {
    changeId: nextId++,
    season: 3,
    newMmr: 7000,
    delta: 0,
    reason: 'Table',
    score: 80,
    partnerScores: [],
    rank: 5,
    tier: 'C',
    numTeams: 12,
    numPlayers: 12,
    ...over,
  }
}

describe('eventScore', () => {
  it('suma los puntos 15-12-10-9... de las 12 carreras', () => {
    expect(eventScore(Array(12).fill(1))).toBe(180)
    expect(eventScore(Array(12).fill(12))).toBe(12)
    expect(eventScore([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe(82)
  })

  it('no es verificable si no son 12 carreras o hay posiciones de 24p', () => {
    expect(eventScore([1, 2, 3])).toBeNull()
    expect(eventScore([...Array(11).fill(1), 13])).toBeNull()
    expect(eventScore([...Array(11).fill(1), 0])).toBeNull()
  })
})

describe('parseChanges', () => {
  it('descarta lo que no tiene identificador y ordena por fecha', () => {
    const out = parseChanges(
      [
        { newMmr: 4600, mmrDelta: 0, reason: 'Placement', time: '2026-01-28T02:02:05Z' },
        { changeId: 2, newMmr: 7200, mmrDelta: 50, reason: 'Table', time: '2026-10-02T10:00:00Z', score: 90, partnerScores: [70], rank: 2, tier: 'SQ', numTeams: 6, numPlayers: 12 },
        { changeId: 1, newMmr: 7150, mmrDelta: -20, reason: 'Table', time: '2026-10-01T10:00:00Z', score: 60 },
      ],
      3,
    )
    expect(out.map((c) => c.changeId)).toEqual([1, 2])
    expect(out[1]).toMatchObject({ season: 3, score: 90, partnerScores: [70], tier: 'SQ', numTeams: 6 })
    expect(out[0]).toMatchObject({ partnerScores: [], rank: null, tier: null })
  })
})

describe('matchLoungeEvents', () => {
  const day = '2026-10-10'

  it('empareja por puntuación dentro del día jugado', () => {
    const c = change({ time: '2026-10-10T20:50:00Z', score: 97 })
    const m = matchLoungeEvents([{ id: 'e1', score: 97, playedOn: day, createdAt: '2026-10-10T21:30:00Z' }], [c])
    expect(m.get('e1')).toBe(c)
  })

  it('cubre cualquier zona horaria: de la tarde anterior a la madrugada siguiente', () => {
    const early = change({ time: '2026-10-09T12:00:00Z', score: 80 }) // ya es día 10 en UTC+12
    const late = change({ time: '2026-10-11T10:00:00Z', score: 81 }) // aún es día 10 en UTC-10, con retraso de la mesa
    const m = matchLoungeEvents(
      [
        { id: 'e1', score: 80, playedOn: day, createdAt: day },
        { id: 'e2', score: 81, playedOn: day, createdAt: day },
      ],
      [early, late],
    )
    expect([...m.keys()].sort()).toEqual(['e1', 'e2'])
  })

  it('no empareja si la puntuación es distinta', () => {
    const c = change({ time: '2026-10-10T20:50:00Z', score: 96 })
    expect(matchLoungeEvents([{ id: 'e1', score: 97, playedOn: day, createdAt: day }], [c]).size).toBe(0)
  })

  it('no empareja un cambio de otro día', () => {
    const before = change({ time: '2026-10-08T12:00:00Z', score: 97 })
    const after = change({ time: '2026-10-13T12:00:00Z', score: 97 })
    expect(matchLoungeEvents([{ id: 'e1', score: 97, playedOn: day, createdAt: day }], [before, after]).size).toBe(0)
  })

  it('un mismo cambio solo sirve para un evento', () => {
    const c = change({ time: '2026-10-10T20:50:00Z', score: 97 })
    const m = matchLoungeEvents(
      [
        { id: 'e1', score: 97, playedOn: day, createdAt: day },
        { id: 'e2', score: 97, playedOn: day, createdAt: day },
      ],
      [c],
    )
    expect(m.size).toBe(1)
  })

  it('respeta los cambios ya usados por otros eventos', () => {
    const c = change({ time: '2026-10-10T20:50:00Z', score: 97 })
    expect(matchLoungeEvents([{ id: 'e1', score: 97, playedOn: day, createdAt: day }], [c], [c.changeId]).size).toBe(0)
  })

  it('con dos mesas iguales elige la más cercana al mediodía del día jugado', () => {
    const near = change({ time: '2026-10-10T12:40:00Z', score: 80 })
    const far = change({ time: '2026-10-10T23:50:00Z', score: 80 })
    expect(matchLoungeEvents([{ id: 'e1', score: 80, playedOn: day, createdAt: day }], [far, near]).get('e1')).toBe(near)
  })

  it('eventos antiguos sin día: se crean al empezar, la mesa se verifica hasta un día después', () => {
    const after = change({ time: '2026-10-12T22:11:00Z', score: 99 })
    expect(matchLoungeEvents([{ id: 'e1', score: 99, playedOn: null, createdAt: '2026-10-12T21:10:00Z' }], [after]).size).toBe(1)
    // Hasta 7 días antes de subirse
    const old = change({ time: '2026-10-08T12:00:00Z', score: 70 })
    expect(matchLoungeEvents([{ id: 'e1', score: 70, playedOn: null, createdAt: '2026-10-10T12:00:00Z' }], [old]).size).toBe(1)
    expect(matchLoungeEvents([{ id: 'e1', score: 70, playedOn: null, createdAt: '2026-10-20T12:00:00Z' }], [old]).size).toBe(0)
  })

  it('ignora las penalizaciones y bonos aunque lleven puntuación', () => {
    const strike = change({ time: '2026-10-10T20:50:00Z', score: 97, reason: 'Strike' })
    expect(matchLoungeEvents([{ id: 'e1', score: 97, playedOn: day, createdAt: day }], [strike]).size).toBe(0)
  })
})

describe('matchWars', () => {
  const table = (id: number, createdOn: string, a: number[], b: number[], numTeams = 2): LoungeTable => ({
    id,
    createdOn,
    tier: 'SQ',
    numTeams,
    numPlayers: 12,
    teams: [a, b].map((scores, i) => ({ rank: i + 1, scores: scores.map((score) => ({ score })) })),
  })
  const a = [90, 80, 75, 70, 40, 35]
  const b = [100, 85, 60, 55, 50, 45]
  const cand = { id: 'w1', playerScores: [35, 40, 70, 75, 80, 90], playedOn: '2026-10-10', createdAt: '2026-10-10T21:30:00Z' }

  it('empareja con la mesa 6v6 donde un equipo tiene las mismas puntuaciones, en cualquier orden', () => {
    const t = table(7, '2026-10-10T20:05:00Z', a, b)
    expect(matchWars([cand], [t]).get('w1')).toBe(t)
    const swapped = table(8, '2026-10-10T20:05:00Z', b, a)
    expect(matchWars([cand], [swapped]).get('w1')).toBe(swapped)
  })

  it('no empareja otras puntuaciones, mesas que no son 6v6 ni mesas de otro día', () => {
    expect(matchWars([cand], [table(1, '2026-10-10T20:05:00Z', [91, 80, 75, 70, 40, 35], b)]).size).toBe(0)
    expect(matchWars([cand], [table(2, '2026-10-10T20:05:00Z', a, b, 6)]).size).toBe(0)
    expect(matchWars([cand], [table(3, '2026-10-07T12:00:00Z', a, b)]).size).toBe(0)
  })

  it('solo verifica wars de exactamente 6 jugadores', () => {
    const t = table(7, '2026-10-10T20:05:00Z', a, b)
    expect(matchWars([{ ...cand, playerScores: [35, 40, 70, 75, 80] }], [t]).size).toBe(0)
  })
})

describe('computeLoungeStats', () => {
  it('sin mesas devuelve null', () => {
    expect(computeLoungeStats([])).toBeNull()
    expect(computeLoungeStats([change({ time: '2026-10-01T10:00:00Z', reason: 'Bonus', score: null })])).toBeNull()
  })

  const base: LoungeChange[] = [
    change({ time: '2026-10-05T10:00:00Z', newMmr: 7100, delta: 100, score: 100, tier: 'C', numTeams: 12, rank: 1 }),
    change({ time: '2026-10-06T10:00:00Z', newMmr: 7000, delta: -100, score: 60, tier: 'SQ', numTeams: 6, rank: 4, partnerScores: [80] }),
    change({ time: '2026-10-07T10:00:00Z', newMmr: 7150, delta: 150, score: 110, tier: 'SQ', numTeams: 6, rank: 1, partnerScores: [90] }),
    change({ time: '2026-10-08T10:00:00Z', newMmr: 7200, delta: 50, score: 90, tier: 'C', numTeams: 12, rank: 3 }),
  ]

  it('resumen: MMR, pico, victorias y medias', () => {
    const s = computeLoungeStats(base)!
    expect(s.tables).toBe(4)
    expect(s.mmr).toBe(7200)
    expect(s.peak.mmr).toBe(7200)
    expect(s.low.mmr).toBe(7000)
    expect(s.net).toBe(200)
    expect(s.wins).toBe(3)
    expect(s.winRate).toBe(75)
    expect(s.avgScore).toBe(90)
    expect(s.noSqAvgScore).toBe(95)
    expect(s.sqAvgScore).toBe(85)
    expect(s.bestScore).toEqual({ score: 110, time: '2026-10-07T10:00:00Z' })
    expect(s.worstScore?.score).toBe(60)
    expect(s.bestGain?.delta).toBe(150)
    expect(s.worstLoss?.delta).toBe(-100)
    expect(s.avgRank).toBe(2.3)
  })

  it('rachas de mesas ganando MMR', () => {
    const s = computeLoungeStats(base)!
    expect(s.streak).toEqual({ current: 2, best: 2 })
  })

  it('compañeros: tu puntuación frente a la media de tus compañeros en mesas por equipos', () => {
    const s = computeLoungeStats(base)!
    expect(s.partner).toEqual({ tables: 2, avgScore: 85, avgPartnerScore: 85, diff: 0 })
  })

  it('agrupa por formato y por tier', () => {
    const s = computeLoungeStats(base)!
    expect(s.byFormat.map((g) => [g.key, g.tables])).toEqual([
      ['ffa', 2],
      ['duo', 2],
    ])
    expect(s.byFormat[1]).toMatchObject({ avgScore: 85, avgDelta: 25, winRate: 50 })
    expect(s.byTier.map((g) => g.key).sort()).toEqual(['C', 'SQ'])
  })

  it('últimas 10 mesas', () => {
    expect(computeLoungeStats(base)!.lastTen).toEqual({ wins: 3, losses: 1, gain: 200, avgScore: 90 })
    expect(computeLoungeStats(base.slice(0, 2))!.lastTen).toBeNull()
  })

  it('usa la hora local para el día y la hora', () => {
    const s = computeLoungeStats([change({ time: '2026-10-05T23:30:00Z', delta: 10 })], 120)!
    // 23:30 UTC + 2 h = 01:30 del martes 6
    expect(s.byHour.map((g) => g.key)).toEqual(['1'])
    expect(s.byWeekday.map((g) => g.key)).toEqual(['2'])
  })

  it('mesas por semana', () => {
    const s = computeLoungeStats(base)!
    expect(s.weekly).toEqual([{ week: '2026-10-05', tables: 4, delta: 200 }])
    expect(weekStart('2026-10-11T23:59:00Z')).toBe('2026-10-05')
    expect(weekStart('2026-10-12T00:00:00Z')).toBe('2026-10-12')
  })
})

describe('utilidades', () => {
  it('bestGroup exige un mínimo de mesas', () => {
    const g = (key: string, tables: number, avgDelta: number) => ({ key, tables, avgScore: 0, avgDelta, winRate: 0 })
    expect(bestGroup([g('a', 2, 90), g('b', 6, 10), g('c', 9, 30)])?.key).toBe('c')
    expect(bestGroup([g('a', 2, 90)])).toBeNull()
  })

  it('formatOf y topPercent', () => {
    expect(formatOf(12)).toBe('ffa')
    expect(formatOf(2)).toBe('war')
    expect(formatOf(5)).toBeNull()
    expect(topPercent(612, 27153)).toBe(2.3)
    expect(topPercent(null, 100)).toBeNull()
    expect(topPercent(200, 100)).toBeNull()
  })

  it('mmrSeries ordena por fecha', () => {
    const s = mmrSeries([change({ time: '2026-10-02T00:00:00Z', newMmr: 2 }), change({ time: '2026-10-01T00:00:00Z', newMmr: 1 })])
    expect(s.map((p) => p.mmr)).toEqual([1, 2])
  })
})
