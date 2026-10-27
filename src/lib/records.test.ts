import { describe, expect, it } from 'vitest'
import type { TimedResult } from './form'
import { buildCrowns, crownFactsOf } from './crowns'
import { buildRecords, recordMarks, standingIn } from './records'

const race = (eventId: string, raceNo: number, position: number, date: string, extra: Partial<TimedResult> = {}): TimedResult => ({
  eventId,
  kind: 'war',
  trackId: `t${raceNo}`,
  position,
  raceNo,
  date,
  racers: 12,
  verified: true,
  ...extra,
})
const ev = (id: string, positions: number[], date: string, extra: Partial<TimedResult> = {}) => positions.map((p, i) => race(id, i + 1, p, date, extra))

describe('recordMarks', () => {
  it('solo anota una marca cuando mejora la anterior', () => {
    const tl = [...ev('e1', [1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], '2026-10-01T10:00:00Z'), ...ev('e2', [1, 1, 1, ...Array(9).fill(5)], '2026-10-02T10:00:00Z')]
    const m = recordMarks(tl)
    expect(m.winStreak.map((x) => x.value)).toEqual([1, 2, 3])
    expect(m.winStreak[1].date).toBe('2026-10-01T10:00:00Z')
    expect(m.winsInEvent.map((x) => x.value)).toEqual([2, 3])
  })
})

describe('buildRecords', () => {
  const players = [
    { id: 'a', timeline: [...ev('e1', Array(12).fill(1), '2026-10-01T10:00:00Z', { warWon: true }), ...ev('e2', [12, 1, ...Array(10).fill(5)], '2026-10-02T10:00:00Z')] },
    { id: 'b', timeline: ev('e3', Array(12).fill(2), '2026-10-03T10:00:00Z', { warWon: true }) },
  ]
  const { records, history } = buildRecords(players)

  it('clasificación completa con el mejor evento y las victorias en un evento', () => {
    expect(records.bestEvent[0]).toMatchObject({ profileId: 'a', value: 180, eventId: 'e1' })
    expect(records.bestEvent[1]).toMatchObject({ profileId: 'b', value: 144 })
    expect(records.winsInEvent[0]).toMatchObject({ profileId: 'a', value: 12 })
  })

  it('rachas, remontadas y wars ganadas', () => {
    expect(records.winStreak[0]).toMatchObject({ profileId: 'a', value: 12 })
    expect(records.top6Streak[0].profileId).toBe('a')
    expect(records.redemptions[0]).toMatchObject({ profileId: 'a', value: 1 })
    expect(records.warWins.map((r) => [r.profileId, r.value])).toEqual([['a', 1], ['b', 1]])
    expect(records.cleanEvents.map((r) => r.profileId)).toEqual(['a', 'b'])
  })

  it('en empate manda quien llegó antes', () => {
    expect(records.warWins[0].profileId).toBe('a')
  })

  it('la historia solo guarda las veces que se batió el récord', () => {
    // a hace 180 el día 1; b hace 144 el día 3: no bate nada
    expect(history.bestEvent.map((h) => [h.profileId, h.value])).toEqual([['a', 180]])
    const later = buildRecords([
      { id: 'a', timeline: ev('e1', Array(12).fill(2), '2026-10-01T10:00:00Z') },
      { id: 'b', timeline: ev('e2', Array(12).fill(1), '2026-10-05T10:00:00Z') },
    ])
    expect(later.history.bestEvent.map((h) => [h.profileId, h.value])).toEqual([['a', 144], ['b', 180]])
    expect(later.records.bestEvent[0].profileId).toBe('b')
  })
})

describe('standingIn', () => {
  const list = [
    { profileId: 'a', value: 180, date: '2026-10-01' },
    { profileId: 'b', value: 144, date: '2026-10-02' },
    { profileId: 'c', value: 100, date: '2026-10-03' },
  ]

  it('puesto y lo que falta para el de arriba', () => {
    expect(standingIn(list, 'a')).toMatchObject({ rank: 1, gap: null })
    expect(standingIn(list, 'c')).toMatchObject({ rank: 3, gap: 44 })
  })

  it('sin marca no hay puesto', () => {
    expect(standingIn(list, 'z')).toBeNull()
  })
})

describe('buildCrowns', () => {
  const wins = (prefix: string, n: number, date: string) => Array.from({ length: n }, (_, i) => race(`${prefix}${i}`, 1, 1, date))

  it('sin datos no hay corona', () => {
    expect(buildCrowns([], 40).day.holder).toBeNull()
    expect(buildCrowns([{ id: 'a', timeline: [] }], 40).all.holder).toBeNull()
  })

  it('pole del día, de la semana y trono con su contador', () => {
    const players = [
      // a sube muchos niveles el lunes 5 y el viernes 16; b solo un poco el miércoles 14
      { id: 'a', timeline: [...wins('a1', 10, '2026-10-05T10:00:00Z'), ...wins('a2', 200, '2026-10-16T10:00:00Z')] },
      { id: 'b', timeline: wins('b1', 3, '2026-10-14T10:00:00Z') },
    ]
    const c = buildCrowns(players, 40)
    expect(c.day.counts).toEqual({ a: 2, b: 1 })
    expect(c.week.counts).toEqual({ a: 2 }) // semanas del 5 y del 12 oct: en la segunda b sube menos que a
    expect(c.day.holder).toBe('a')
    expect(c.week.holder).toBe('a')
    // a lidera desde el principio y b nunca lo supera: un solo reinado
    expect(c.all.holder).toBe('a')
    expect(c.all.counts).toEqual({ a: 1 })
  })

  it('el trono pasa a quien supera de verdad y vuelve a contar si lo recupera', () => {
    const players = [
      { id: 'a', timeline: [...wins('a1', 10, '2026-10-01T10:00:00Z'), ...wins('a3', 300, '2026-10-20T10:00:00Z')] },
      { id: 'b', timeline: wins('b1', 60, '2026-10-10T10:00:00Z') },
    ]
    const c = buildCrowns(players, 40)
    expect(c.all.counts).toEqual({ a: 2, b: 1 })
    expect(c.all.holder).toBe('a')
    expect(crownFactsOf(c, 'b')).toMatchObject({ allNow: false, allCount: 1 })
    expect(crownFactsOf(c, 'a')).toMatchObject({ allNow: true, allCount: 2 })
  })
})
