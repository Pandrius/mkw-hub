import { describe, expect, it } from 'vitest'
import { computeAchievements } from './achievements'
import { computeBadges } from './badges'
import type { TimedResult } from './form'
import { BOLT_STYLES, canPickBolts, countSqTables, DEFAULT_BOLT_STYLE, featurable, isBoltStyle, titleCatalog, validateFeatured, validateTitle, type TitleContext } from './titles'

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

function ctxFor(rows: TimedResult[], lounge: TitleContext['lounge'] = null, ownedTracks: string[] = []): TitleContext {
  return { achievements: computeAchievements(rows, 40), badges: computeBadges(rows, 40), ownedTracks, lounge }
}

describe('titleCatalog', () => {
  it('sin carreras no hay ningún título ganado', () => {
    expect(titleCatalog(ctxFor([])).filter((t) => t.earned)).toEqual([])
  })

  it('ocho eventos legendarios dan «Leyenda» y ya no hay títulos del evento perfecto', () => {
    const one = titleCatalog(ctxFor(event('a', Array(12).fill(1))))
    expect(one.find((t) => t.id === 'legend')?.earned).toBe(false)
    expect(one.some((t) => t.id === 'perfectionist' || t.id === 'untouchable')).toBe(false)
    const eight = Array.from({ length: 8 }, (_, i) => event(`e${i}`, Array(12).fill(1))).flat()
    expect(titleCatalog(ctxFor(eight)).find((t) => t.id === 'legend')?.earned).toBe(true)
  })

  it('«Dueño de pista» sale de la lista de pistas que da el ranking (1 % mejor)', () => {
    const owner = titleCatalog(ctxFor([], null, ['lc'])).find((t) => t.id === 'owner:lc')
    expect(owner).toMatchObject({ earned: true, param: 'lc', group: 'track' })
    expect(titleCatalog(ctxFor([])).some((t) => t.id.startsWith('owner:'))).toBe(false)
  })

  it('títulos del Lounge según el MMR máximo, el puesto y las mesas SQ', () => {
    const lounge = { peakMmr: 7360, topPercent: 2.3, sqTables: 30 }
    const earned = new Set(titleCatalog(ctxFor([], lounge)).filter((t) => t.earned).map((t) => t.id))
    expect([...earned].sort()).toEqual(['rank:bronze', 'rank:gold', 'rank:silver', 'sqPlayer', 'top:10', 'top:5'])
  })
})

describe('validateTitle', () => {
  const ctx = ctxFor(event('a', Array(12).fill(1)))
  it('acepta un título ganado, el vacío para quitarlo, y rechaza el resto', () => {
    expect(validateTitle('unstoppable', ctx)).toBe('unstoppable')
    expect(validateTitle(null, ctx)).toBeNull()
    expect(validateTitle('', ctx)).toBeNull()
    expect(validateTitle('legend', ctx)).toBeUndefined()
    expect(validateTitle('inventado', ctx)).toBeUndefined()
    expect(validateTitle(5, ctx)).toBeUndefined()
  })
})

describe('insignias destacadas', () => {
  const rows = event('a', Array(12).fill(1))
  const owned = featurable(computeAchievements(rows, 40), computeBadges(rows, 40))

  it('solo se pueden destacar las que tienen algún nivel', () => {
    expect(owned.map((f) => f.id)).toContain('ach:legendEvent')
    expect(owned.map((f) => f.id)).not.toContain('badge:races')
  })

  it('valida: máximo 3, sin repetidas y ganadas', () => {
    expect(validateFeatured(['ach:legendEvent'], owned)).toEqual(['ach:legendEvent'])
    expect(validateFeatured([], owned)).toEqual([])
    expect(validateFeatured(['ach:legendEvent', 'ach:legendEvent'], owned)).toBeNull()
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

describe('rayos de los escudos especiales', () => {
  const f = (id: string) => ({ id, glyph: 'crown' as const, tier: 1 as const })
  it('solo los eligen quienes tienen el evento legendario o la leyenda absoluta', () => {
    expect(canPickBolts([f('ach:wins'), f('badge:races')])).toBe(false)
    expect(canPickBolts([f('ach:wins'), f('ach:legendEvent')])).toBe(true)
    expect(canPickBolts([f('ach:allAchievements')])).toBe(true)
  })
  it('acepta los tres estilos y rechaza el resto', () => {
    for (const s of BOLT_STYLES) expect(isBoltStyle(s)).toBe(true)
    expect(isBoltStyle('rainbow')).toBe(false)
    expect(isBoltStyle(null)).toBe(false)
    expect(DEFAULT_BOLT_STYLE).toBe('simple')
  })
})

describe('coronas de la comunidad', () => {
  const none = { dayNow: false, weekNow: false, allNow: false, dayCount: 0, weekCount: 0, allCount: 0 }
  const earned = (crowns: typeof none) =>
    titleCatalog({ ...ctxFor([]), crowns })
      .filter((t) => t.group === 'crown' && t.earned)
      .map((t) => t.id)
      .sort()

  it('sin coronas no hay títulos de corona', () => {
    expect(earned(none)).toEqual([])
    expect(titleCatalog(ctxFor([])).filter((t) => t.group === 'crown' && t.earned)).toEqual([])
  })

  it('«ahora» y «alguna vez» son títulos distintos, y el segundo lleva las veces', () => {
    expect(earned({ ...none, weekNow: true, weekCount: 3, dayCount: 2 })).toEqual(['poleDayEver', 'poleWeek', 'poleWeekEver'])
    const catalog = titleCatalog({ ...ctxFor([]), crowns: { ...none, dayCount: 2 } })
    expect(catalog.find((t) => t.id === 'poleDayEver')).toMatchObject({ earned: true, param: '2' })
  })

  it('los títulos del trono: uno para quien reina y otro para quien ha reinado', () => {
    expect(earned({ ...none, allCount: 2 })).toEqual(['kingEver'])
    const king = { ...ctxFor([]), crowns: { ...none, allNow: true, allCount: 1 } }
    expect(validateTitle('kingNow', king)).toBe('kingNow')
    expect(validateTitle('kingNow', { ...king, crowns: none })).toBeUndefined()
  })

  it('aparecer en un ranking solo da títulos: ninguna insignia destacable es de corona', () => {
    expect(featurable([], computeBadges([], 40)).some((f) => f.id.startsWith('crown:'))).toBe(false)
  })
})

describe('títulos por pista', () => {
  it('«Dueño de …» (todo el tiempo) y el semanal salen de las pistas que se lidera', () => {
    const catalog = titleCatalog({ ...ctxFor([], null, ['lc']), weeklyTracks: ['rr'] })
    expect(catalog.find((t) => t.id === 'owner:lc')).toMatchObject({ earned: true, param: 'lc', group: 'track' })
    expect(catalog.find((t) => t.id === 'weekly:rr')).toMatchObject({ earned: true, param: 'rr', group: 'track' })
    expect(titleCatalog(ctxFor([])).some((t) => t.id.startsWith('weekly:'))).toBe(false)
  })

  it('se puede elegir el título semanal solo si se lidera la pista', () => {
    expect(validateTitle('weekly:rr', { ...ctxFor([]), weeklyTracks: ['rr'] })).toBe('weekly:rr')
    expect(validateTitle('weekly:rr', ctxFor([]))).toBeUndefined()
  })
})
