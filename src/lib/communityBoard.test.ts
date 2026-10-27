import { describe, expect, it } from 'vitest'
import { buildBoard, periodStart } from './communityBoard'
import type { TimedResult } from './form'

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
const NOW = new Date('2026-10-28T15:00:00Z') // miércoles

describe('periodStart', () => {
  it('semana desde el lunes y día desde las 00:00 UTC', () => {
    expect(periodStart('all', NOW)).toBeNull()
    expect(periodStart('day', NOW)).toBe('2026-10-28T00:00:00.000Z')
    expect(periodStart('week', NOW)).toBe('2026-10-26T00:00:00.000Z')
    expect(periodStart('week', new Date('2026-11-01T10:00:00Z'))).toBe('2026-10-26T00:00:00.000Z') // domingo
  })
})

describe('buildBoard', () => {
  const players = [
    { id: 'a', timeline: [race('e1', 1, 1, '2026-10-01T10:00:00Z'), race('e1', 2, 1, '2026-10-01T10:00:00Z'), race('e2', 1, 2, '2026-10-27T10:00:00Z')] },
    { id: 'b', timeline: [race('e3', 1, 1, '2026-10-28T09:00:00Z')] },
    { id: 'c', timeline: [] },
  ]
  const board = buildBoard(players, 40, NOW)

  it('todo el tiempo cuenta todas las carreras', () => {
    expect(board.all.wins?.map((e) => [e.profileId, e.count])).toEqual([['a', 2], ['b', 1]])
    expect(board.all.podiums?.[0]).toMatchObject({ profileId: 'a', count: 3 })
  })

  it('semana y día solo cuentan las carreras de su periodo', () => {
    expect(board.week.wins?.map((e) => [e.profileId, e.count])).toEqual([['b', 1]])
    expect(board.week.podiums?.map((e) => [e.profileId, e.count])).toEqual([['a', 1], ['b', 1]])
    expect(board.day.podiums?.map((e) => [e.profileId, e.count])).toEqual([['b', 1]])
  })

  it('la clasificación general suma niveles subidos en el periodo', () => {
    // 10 victorias antiguas = nivel 1 de «victorias»; con 45 más hoy llega al nivel 2 (50)
    const old = ev('old', Array(10).fill(1), '2026-10-01T10:00:00Z')
    const fresh = Array.from({ length: 45 }, (_, i) => race(`f${i}`, 1, 1, '2026-10-28T10:00:00Z'))
    const b = buildBoard([{ id: 'x', timeline: [...old, ...fresh] }], 40, NOW)
    expect(b.all.overall?.[0].count).toBeGreaterThan(b.day.overall?.[0].count ?? 0)
    expect(b.day.overall?.[0].count).toBeGreaterThan(0)
  })
})
