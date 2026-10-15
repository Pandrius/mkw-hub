import { describe, expect, it } from 'vitest'
import { computeAchievements } from './achievements'
import { computeBadges } from './badges'
import type { TimedResult } from './form'
import { validateTitle, type TitleContext } from './titles'
import { wonWar, type WarRaceLine } from './warWins'

/** 12 carreras en las que nuestro equipo ocupa las posiciones dadas */
const races = (positions: number[]): WarRaceLine[] => Array.from({ length: 12 }, () => ({ positions, missingHome: 0, missingAway: 0 }))

describe('wonWar', () => {
  it('gana quien suma más puntos', () => {
    expect(wonWar(races([1, 2, 3, 4, 5, 6]), [])).toBe(true)
    expect(wonWar(races([7, 8, 9, 10, 11, 12]), [])).toBe(false)
  })

  it('un empate no es victoria', () => {
    // Carrera 1: 42 contra 40; carrera 2, al revés → 82 contra 82
    const tie = [
      { positions: [1, 4, 5, 8, 9, 12], missingHome: 0, missingAway: 0 },
      { positions: [2, 3, 6, 7, 10, 11], missingHome: 0, missingAway: 0 },
    ]
    expect(wonWar(tie, [])).toBe(false)
  })

  it('las penalties pueden darle la vuelta al resultado', () => {
    const close = races([1, 2, 4, 5, 8, 12]) // 15+12+9+8+5+1 = 50 contra 32 → gana de sobra
    expect(wonWar(close, [])).toBe(true)
    expect(wonWar(close, [{ side: 'home', label: 'Late', points: -300 }])).toBe(false)
  })

  it('con datos rotos no cuenta como victoria', () => {
    expect(wonWar([{ positions: [1, 1, 1, 1, 1, 1], missingHome: 0, missingAway: 0 }], [])).toBe(false)
  })
})

describe('logro de victorias de war', () => {
  const warRows = (id: string, won: boolean): TimedResult[] => [
    { eventId: id, kind: 'war', trackId: 't1', position: 1, raceNo: 1, date: '2026-10-01T10:00:00Z', racers: 12, verified: true, warWon: won },
  ]
  const wins = (n: number) => Array.from({ length: n }, (_, i) => warRows(`w${i}`, true)).flat()
  const get = (rows: TimedResult[]) => computeAchievements(rows, 40).find((a) => a.id === 'warWins')!

  it('cuenta wars ganadas (una vez por war) con los umbrales 5, 25, 50, 100 y 250', () => {
    expect(get([]).thresholds).toEqual([5, 25, 50, 100, 250])
    expect(get([...wins(4), ...warRows('lost', false)])).toMatchObject({ count: 4, tier: 0, next: 5 })
    expect(get(wins(5))).toMatchObject({ count: 5, tier: 1 })
    expect(get(wins(25)).tier).toBe(2)
    expect(get(wins(50)).tier).toBe(3)
    expect(get(wins(100)).tier).toBe(4)
    expect(get(wins(250))).toMatchObject({ tier: 5, next: null })
  })

  it('varias carreras de la misma war cuentan como una victoria', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ ...warRows('a', true)[0], raceNo: i + 1 }))
    expect(get(rows).count).toBe(1)
  })

  it('el título de cada rango se consigue con su nivel', () => {
    const ctx = (rows: TimedResult[]): TitleContext => ({ achievements: computeAchievements(rows, 40), badges: computeBadges(rows, 40), ownedTracks: [], lounge: null })
    expect(validateTitle('warRank1', ctx(wins(5)))).toBe('warRank1')
    expect(validateTitle('warRank2', ctx(wins(5)))).toBeUndefined()
    expect(validateTitle('warRank5', ctx(wins(250)))).toBe('warRank5')
  })
})
