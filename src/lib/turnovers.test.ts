import { describe, expect, it } from 'vitest'
import { turnovers } from './community'
import type { Crowns } from './crowns'
import type { RecordEntry, Records } from './records'
import type { TrackBoards } from './trackBoard'

const rec = (...entries: [string, number][]): RecordEntry[] => entries.map(([profileId, value]) => ({ profileId, value, date: '2026-10-01' }))
const records = (bestEvent: RecordEntry[]): Records => ({ bestEvent, winsInEvent: [], winStreak: [], top6Streak: [], redemptions: [], warWins: [], cleanEvents: [] })
const crowns = (all: string | null, count = 1, day: string | null = null): Crowns => ({
  day: { holder: day, counts: day ? { [day]: 1 } : {} },
  week: { holder: null, counts: {} },
  all: { holder: all, counts: all ? { [all]: count } : {} },
})
const entry = (profileId: string, races = 20) => ({ profileId, races, avg: 10, adj: 10 })
const tracks = (all: Record<string, string>, week: Record<string, string> = {}): TrackBoards => ({
  all: Object.fromEntries(Object.entries(all).map(([t, p]) => [t, [entry(p)]])),
  week: Object.fromEntries(Object.entries(week).map(([t, p]) => [t, [entry(p, 5)]])),
})
const snap = (r: Records, c: Crowns, trackBoards?: TrackBoards) => ({ records: r, crowns: c, trackBoards, generatedAt: '2026-10-28T10:00:00Z' })

describe('turnovers', () => {
  it('sin instantánea anterior no se avisa a nadie', () => {
    expect(turnovers(null, snap(records(rec(['a', 100])), crowns('a')))).toEqual([])
  })

  it('avisa a quien pierde el primer puesto de un récord', () => {
    const out = turnovers(snap(records(rec(['a', 100])), crowns('a')), snap(records(rec(['b', 120], ['a', 100])), crowns('a')))
    expect(out).toEqual([{ kind: 'record_lost', profileId: 'a', to: 'b', record: 'bestEvent', value: 120, dedupe: 'bestEvent:b:120' }])
  })

  it('no avisa si el primero sigue siendo el mismo, aunque mejore su marca', () => {
    expect(turnovers(snap(records(rec(['a', 100])), crowns('a')), snap(records(rec(['a', 130])), crowns('a')))).toEqual([])
  })

  it('el trono: avisa a quien lo pierde y felicita a quien lo gana', () => {
    const out = turnovers(snap(records([]), crowns('a')), snap(records([]), crowns('b', 2)))
    expect(out).toEqual([
      { kind: 'crown_won', profileId: 'b', period: 'all', dedupe: 'all:b:2' },
      { kind: 'throne_lost', profileId: 'a', to: 'b', dedupe: 'b:2' },
    ])
  })

  it('una corona sin dueño que alguien gana avisa solo al ganador', () => {
    expect(turnovers(snap(records([]), crowns(null)), snap(records([]), crowns('b')))).toEqual([{ kind: 'crown_won', profileId: 'b', period: 'all', dedupe: 'all:b:1' }])
    expect(turnovers(snap(records([]), crowns(null, 1, 'x')), snap(records([]), crowns(null, 1, 'y')))).toEqual([{ kind: 'crown_won', profileId: 'y', period: 'day', dedupe: 'day:y:1' }])
  })

  it('pistas: el nuevo primero gana y el anterior pierde; una pista sin primero solo da aviso al ganador', () => {
    const out = turnovers(snap(records([]), crowns('a'), tracks({ rr: 'a' })), snap(records([]), crowns('a'), tracks({ rr: 'b', cc: 'a' })))
    expect(out).toEqual([
      { kind: 'track_won', profileId: 'b', track: 'rr', period: 'all', dedupe: 'all:rr:b:20' },
      { kind: 'track_lost', profileId: 'a', to: 'b', track: 'rr', period: 'all', dedupe: 'all:rr:b:20' },
      { kind: 'track_won', profileId: 'a', track: 'cc', period: 'all', dedupe: 'all:cc:a:20' },
    ])
  })

  it('pistas semanales: la semana forma parte de la clave del aviso', () => {
    const out = turnovers(snap(records([]), crowns('a'), tracks({}, {})), snap(records([]), crowns('a'), tracks({}, { rr: 'b' })))
    expect(out).toEqual([{ kind: 'track_won', profileId: 'b', track: 'rr', period: 'week', dedupe: 'week:rr:b:2026-10-26' }])
  })

  it('si la instantánea anterior no tenía pistas, no se avisa de pistas', () => {
    expect(turnovers(snap(records([]), crowns('a')), snap(records([]), crowns('a'), tracks({ rr: 'b' })))).toEqual([])
  })
})
