import { describe, expect, it } from 'vitest'
import { computeAchievements, ownedTracks } from './achievements'
import { computeBadges } from './badges'
import type { TimedResult } from './form'
import { countSqTables, featurable, titleCatalog, validateFeatured, validateTitle, type TitleContext } from './titles'

const race = (eventId: string, i: number, position: number, trackId = `t${i}`, verified = true): TimedResult => ({
  eventId,
  kind: 'war',
  trackId,
  position,
  raceNo: i + 1,
  date: '2026-10-01T10:00:00Z',
  racers: 12,
  verified,
})
const event = (id: string, positions: number[], trackOf = (i: number) => `t${i}`) => positions.map((p, i) => race(id, i, p, trackOf(i)))

function ctxFor(rows: TimedResult[], lounge: TitleContext['lounge'] = null): TitleContext {
  return { achievements: computeAchievements(rows, 40), badges: computeBadges(rows, 40), ownedTracks: ownedTracks(rows), lounge }
}

describe('titleCatalog', () => {
  it('sin carreras no hay ningún título ganado', () => {
    expect(titleCatalog(ctxFor([])).filter((t) => t.earned)).toEqual([])
  })

  it('un evento perfecto da «Perfeccionista» pero no «Intocable»', () => {
    const earned = titleCatalog(ctxFor(event('a', Array(12).fill(1)))).filter((t) => t.earned).map((t) => t.id)
    expect(earned).toContain('perfectionist')
    expect(earned).not.toContain('untouchable')
  })

  it('«Dueño de pista» se genera por cada pista dominada', () => {
    const rows = Array.from({ length: 10 }, (_, k) => race(`e${k}`, 0, 1, 'lc'))
    const owner = titleCatalog(ctxFor(rows)).find((t) => t.id === 'owner:lc')
    expect(owner).toMatchObject({ earned: true, param: 'lc', group: 'track' })
  })

  it('títulos del Lounge según el MMR máximo, el puesto y las mesas SQ', () => {
    const lounge = { peakMmr: 7360, topPercent: 2.3, sqTables: 30 }
    const earned = new Set(titleCatalog(ctxFor([], lounge)).filter((t) => t.earned).map((t) => t.id))
    expect([...earned].sort()).toEqual(['mmr:5000', 'mmr:7000', 'sqPlayer', 'top:10', 'top:5'])
  })
})

describe('validateTitle', () => {
  const ctx = ctxFor(event('a', Array(12).fill(1)))
  it('acepta un título ganado, el vacío para quitarlo, y rechaza el resto', () => {
    expect(validateTitle('perfectionist', ctx)).toBe('perfectionist')
    expect(validateTitle(null, ctx)).toBeNull()
    expect(validateTitle('', ctx)).toBeNull()
    expect(validateTitle('untouchable', ctx)).toBeUndefined()
    expect(validateTitle('inventado', ctx)).toBeUndefined()
    expect(validateTitle(5, ctx)).toBeUndefined()
  })
})

describe('insignias destacadas', () => {
  const rows = event('a', Array(12).fill(1))
  const owned = featurable(computeAchievements(rows, 40), computeBadges(rows, 40))

  it('solo se pueden destacar las que tienen algún nivel', () => {
    expect(owned.map((f) => f.id)).toContain('ach:perfectEvent')
    expect(owned.map((f) => f.id)).not.toContain('badge:races')
  })

  it('valida: máximo 3, sin repetidas y ganadas', () => {
    expect(validateFeatured(['ach:perfectEvent'], owned)).toEqual(['ach:perfectEvent'])
    expect(validateFeatured([], owned)).toEqual([])
    expect(validateFeatured(['ach:perfectEvent', 'ach:perfectEvent'], owned)).toBeNull()
    expect(validateFeatured(['badge:races'], owned)).toBeNull()
    expect(validateFeatured(['ach:wins', 'ach:podiums', 'ach:top6', 'ach:winStreak'], owned)).toBeNull()
    expect(validateFeatured('ach:wins', owned)).toBeNull()
  })
})

describe('countSqTables', () => {
  it('cuenta solo mesas SQ', () => {
    expect(countSqTables([{ reason: 'Table', tier: 'SQ' }, { reason: 'Table', tier: 'C' }, { reason: 'Bonus', tier: 'SQ' }])).toBe(1)
  })
})
