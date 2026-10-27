import { describe, expect, it } from 'vitest'
import type { TimedResult } from './form'
import { ALL_MIN_RACES, buildTrackBoards, tracksLedBy, WEEK_MIN_RACES } from './trackBoard'

const NOW = new Date('2026-10-28T15:00:00Z') // miércoles; la semana empieza el lunes 26
const run = (trackId: string, position: number, date: string, extra: Partial<TimedResult> = {}): TimedResult => ({ eventId: `${trackId}${position}${date}${Math.random()}`, kind: 'war', trackId, position, raceNo: 1, date, racers: 12, verified: true, ...extra })
const many = (n: number, trackId: string, position: number, date: string) => Array.from({ length: n }, () => run(trackId, position, date))

describe('buildTrackBoards', () => {
  it('pide un mínimo de carreras en la pista: 20 en todo el tiempo y 5 en la semana', () => {
    const b = buildTrackBoards(
      [
        { id: 'a', timeline: many(ALL_MIN_RACES, 'rr', 1, '2026-10-01T10:00:00Z') },
        { id: 'b', timeline: many(ALL_MIN_RACES - 1, 'rr', 1, '2026-10-01T10:00:00Z') },
        { id: 'c', timeline: many(WEEK_MIN_RACES, 'cc', 2, '2026-10-27T10:00:00Z') },
        { id: 'd', timeline: many(WEEK_MIN_RACES - 1, 'cc', 1, '2026-10-27T10:00:00Z') },
      ],
      NOW,
    )
    expect(b.all.rr?.map((e) => e.profileId)).toEqual(['a'])
    expect(b.all.cc).toBeUndefined()
    expect(b.week.cc?.map((e) => e.profileId)).toEqual(['c'])
  })

  it('la semana solo cuenta las carreras desde el lunes', () => {
    const b = buildTrackBoards([{ id: 'a', timeline: [...many(WEEK_MIN_RACES, 'rr', 1, '2026-10-25T23:00:00Z'), ...many(2, 'rr', 1, '2026-10-26T01:00:00Z')] }], NOW)
    expect(b.week.rr).toBeUndefined() // solo 2 son de esta semana
  })

  it('ordena por puntos ajustados: pocas carreras buenas no superan a muchas muy buenas', () => {
    const b = buildTrackBoards(
      [
        { id: 'veteran', timeline: many(40, 'rr', 2, '2026-10-01T10:00:00Z') }, // 12 pts de media
        { id: 'lucky', timeline: many(20, 'rr', 1, '2026-10-01T10:00:00Z') }, // 15 pts de media pero solo 20
        { id: 'fillers', timeline: many(60, 'rr', 12, '2026-10-01T10:00:00Z') }, // bajan la media de la pista
      ],
      NOW,
    )
    expect(b.all.rr?.[0].profileId).toBe('lucky') // sigue ganando con 20 carreras de 15 puntos
    expect(b.all.rr?.map((e) => e.profileId)).toEqual(['lucky', 'veteran', 'fillers'])
    expect(b.all.rr?.[0].adj).toBeLessThan(b.all.rr![0].avg)
  })

  it('los tramos no cuentan como pista', () => {
    const b = buildTrackBoards([{ id: 'a', timeline: many(ALL_MIN_RACES, 'rr', 1, '2026-10-01T10:00:00Z').map((r) => ({ ...r, section: true })) }], NOW)
    expect(b.all.rr).toBeUndefined()
  })
})

describe('tracksLedBy', () => {
  it('las pistas en las que se va primero, de todo el tiempo y de la semana', () => {
    const b = buildTrackBoards([{ id: 'a', timeline: [...many(ALL_MIN_RACES, 'rr', 1, '2026-10-27T10:00:00Z'), ...many(WEEK_MIN_RACES, 'cc', 1, '2026-10-27T10:00:00Z')] }], NOW)
    expect(tracksLedBy(b, 'a')).toEqual({ owned: ['rr'], weekly: ['rr', 'cc'] })
    expect(tracksLedBy(b, 'z')).toEqual({ owned: [], weekly: [] })
    expect(tracksLedBy(null, 'a')).toEqual({ owned: [], weekly: [] })
  })
})
