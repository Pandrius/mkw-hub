import { describe, expect, it } from 'vitest'
import { buildComparison, summarize, type BestTime, type Entity } from './compare'

const t = (profile_id: string, track_id: string, time_ms: number): BestTime => ({
  profile_id,
  track_id,
  time_ms,
  achieved_on: null,
  proof_url: null,
})

const ana: Entity = { kind: 'player', id: 'ana', name: 'Ana', country: 'ES', avatar: null }
const bob: Entity = { kind: 'player', id: 'bob', name: 'Bob', country: null, avatar: null }
const team: Entity = { kind: 'team', id: 7, name: 'Kart Club', tag: 'KC', memberIds: ['bob', 'cid'] }

const times = [t('ana', 'rr', 230000), t('bob', 'rr', 229000), t('cid', 'rr', 228500), t('ana', 'mbc', 100000), t('cid', 'dkp', 90000)]

describe('buildComparison', () => {
  const rows = buildComparison(['rr', 'mbc', 'dkp', 'ws'], [ana, bob, team], times)

  it('un equipo usa el mejor tiempo de sus miembros', () => {
    expect(rows[0].cells[2]).toEqual({ time_ms: 228500, profileId: 'cid', proof_url: null, achieved_on: null })
  })

  it('marca la entidad más rápida de cada pista', () => {
    expect(rows.map((r) => r.fastest)).toEqual([2, 0, 2, null])
  })

  it('celdas vacías si no hay tiempo', () => {
    expect(rows[1].cells[1]).toBeNull()
    expect(rows[3].cells).toEqual([null, null, null])
  })

  it('se pueden mezclar jugadores y equipos, incluso si comparten miembros', () => {
    expect(rows[0].cells.map((c) => c?.time_ms)).toEqual([230000, 229000, 228500])
  })

  it('resumen de pistas con tiempo y victorias', () => {
    expect(summarize(rows, 3)).toEqual([
      { tracks: 2, wins: 1 },
      { tracks: 1, wins: 0 },
      { tracks: 2, wins: 2 },
    ])
  })

  it('con una sola entidad no hay victorias', () => {
    const solo = buildComparison(['rr'], [ana], times)
    expect(summarize(solo, 1)).toEqual([{ tracks: 1, wins: 0 }])
  })
})
