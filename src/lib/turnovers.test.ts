import { describe, expect, it } from 'vitest'
import { turnovers } from './community'
import type { Crowns } from './crowns'
import type { RecordEntry, Records } from './records'

const rec = (...entries: [string, number][]): RecordEntry[] => entries.map(([profileId, value]) => ({ profileId, value, date: '2026-10-01' }))
const records = (bestEvent: RecordEntry[]): Records => ({ bestEvent, winsInEvent: [], winStreak: [], top6Streak: [], redemptions: [], warWins: [], cleanEvents: [] })
const crowns = (all: string | null, count = 1): Crowns => ({ day: { holder: null, counts: {} }, week: { holder: null, counts: {} }, all: { holder: all, counts: all ? { [all]: count } : {} } })

describe('turnovers', () => {
  it('sin instantánea anterior no se avisa a nadie', () => {
    expect(turnovers(null, { records: records(rec(['a', 100])), crowns: crowns('a') })).toEqual([])
  })

  it('avisa a quien pierde el primer puesto de un récord', () => {
    const out = turnovers({ records: records(rec(['a', 100])), crowns: crowns('a') }, { records: records(rec(['b', 120], ['a', 100])), crowns: crowns('a') })
    expect(out).toEqual([{ kind: 'record_lost', profileId: 'a', to: 'b', record: 'bestEvent', value: 120, dedupe: 'bestEvent:b:120' }])
  })

  it('no avisa si el primero sigue siendo el mismo, aunque mejore su marca', () => {
    expect(turnovers({ records: records(rec(['a', 100])), crowns: crowns('a') }, { records: records(rec(['a', 130])), crowns: crowns('a') })).toEqual([])
  })

  it('avisa a quien pierde el trono, y no si nadie lo tenía', () => {
    const out = turnovers({ records: records([]), crowns: crowns('a') }, { records: records([]), crowns: crowns('b', 2) })
    expect(out).toEqual([{ kind: 'throne_lost', profileId: 'a', to: 'b', dedupe: 'b:2' }])
    expect(turnovers({ records: records([]), crowns: crowns(null) }, { records: records([]), crowns: crowns('b') })).toEqual([])
  })
})
