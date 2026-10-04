import { describe, expect, it } from 'vitest'
import { buildGoals, formatGap, formatPct, marginCount, trackGoal, type RankTime } from './ttGoals'

let nextId = 1
const r = (player_name: string, time_ms: number, profile_id: string | null = null, track_id = 'rr'): RankTime => ({
  id: nextId++,
  track_id,
  time_ms,
  player_name,
  profile_id,
})

/** Ranking de 15 jugadores: P1 = 100000, P2 = 100100… P15 = 101400 */
const fifteen = Array.from({ length: 15 }, (_, i) => r(`P${i + 1}`, 100000 + i * 100))

describe('trackGoal', () => {
  it('fuera del top 10: siguiente puesto y distancia al top 10', () => {
    const g = trackGoal('rr', 'me', 101350, [...fifteen, r('Yo', 101350, 'me')], null)
    expect(g.position).toBe(15)
    expect(g.total).toBe(16)
    expect(g.next).toEqual({ position: 14, playerName: 'P14', gapMs: 50 })
    expect(g.milestone).toEqual({ top: 10, gapMs: 101350 - 100900 })
    expect(g.leadMs).toBeNull()
  })

  it('si el siguiente puesto ya es el top 10, propone el top 3', () => {
    const g = trackGoal('rr', 'me', 100950, fifteen, null)
    expect(g.position).toBe(11)
    expect(g.next?.position).toBe(10)
    expect(g.milestone).toEqual({ top: 3, gapMs: 100950 - 100200 })
  })

  it('2.º: el objetivo es el 1.º y no hay escalón aparte', () => {
    const g = trackGoal('rr', 'me', 100050, fifteen, null)
    expect(g.position).toBe(2)
    expect(g.next).toEqual({ position: 1, playerName: 'P1', gapMs: 50 })
    expect(g.milestone).toBeNull()
  })

  it('4.º-6.º: propone el 1.º o el top 3 como escalón', () => {
    const g = trackGoal('rr', 'me', 100250, fifteen, null)
    expect(g.position).toBe(4)
    expect(g.milestone).toEqual({ top: 1, gapMs: 250 })
    const g5 = trackGoal('rr', 'me', 100450, fifteen, null)
    expect(g5.position).toBe(6)
    expect(g5.milestone).toEqual({ top: 3, gapMs: 100450 - 100200 })
  })

  it('1.º: ventaja sobre el 2.º y sin referencia de la comunidad', () => {
    const g = trackGoal('rr', 'me', 99800, [r('Yo', 99800, 'me'), ...fifteen], null)
    expect(g.position).toBe(1)
    expect(g.next).toBeNull()
    expect(g.leadMs).toBe(200)
    expect(g.reference).toBeNull()
    expect(g.pct).toBeNull()
  })

  it('solo en el ranking: 1.º de 1 sin ventaja', () => {
    const g = trackGoal('rr', 'me', 99800, [], null)
    expect(g).toMatchObject({ position: 1, total: 1, leadMs: null, next: null, milestone: null })
  })

  it('los empates no cuentan como "más rápido"', () => {
    const g = trackGoal('rr', 'me', 100100, fifteen, null)
    expect(g.position).toBe(2)
    expect(g.next?.playerName).toBe('P1')
  })

  it('porcentaje respecto al récord mundial si lo hay', () => {
    const g = trackGoal('rr', 'me', 103200, fifteen, 100000)
    expect(g.reference).toBe('wr')
    expect(g.pct).toBeCloseTo(103.2)
    expect(g.refGapMs).toBe(3200)
  })

  it('sin récord (FLAP / NITA): porcentaje respecto al 1.º de la comunidad', () => {
    const g = trackGoal('rr', 'me', 102000, fifteen, null)
    expect(g.reference).toBe('community')
    expect(g.pct).toBeCloseTo(102)
    expect(g.refGapMs).toBe(2000)
  })
})

describe('marginCount', () => {
  it('no destaca nada con menos de 2 pistas y como mucho 3', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 30].map(marginCount)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })
})

describe('buildGoals', () => {
  const community = [
    r('Ana', 100000, 'ana', 'rr'),
    r('Yo', 104000, 'me', 'rr'),
    r('Yo', 105000, 'me', 'rr'), // un tiempo peor del mismo jugador no cuenta
    r('Ana', 50000, 'ana', 'mbc'),
    r('Yo', 51000, 'me', 'mbc'),
    r('Ana', 70000, 'ana', 'dkp'),
    r('Yo', 69000, 'me', 'dkp'),
  ]
  const mine = [
    { track_id: 'rr', time_ms: 104000 },
    { track_id: 'mbc', time_ms: 51000 },
    { track_id: 'dkp', time_ms: 69000 },
  ]

  it('ordena por margen de mejora y deja al final las pistas donde es 1.º', () => {
    const goals = buildGoals('me', mine, community, null)
    expect(goals.map((g) => g.trackId)).toEqual(['rr', 'mbc', 'dkp'])
    expect(goals[0].pct).toBeCloseTo(104)
    expect(goals[2]).toMatchObject({ position: 1, leadMs: 1000, pct: null })
  })

  it('destaca las pistas más lejos de la referencia', () => {
    const goals = buildGoals('me', mine, community, null)
    expect(goals.map((g) => g.mostMargin)).toEqual([true, false, false])
  })

  it('usa el récord mundial de cada pista cuando se le pasa', () => {
    const wrs = new Map([
      ['rr', 103000],
      ['mbc', 45000],
      ['dkp', 68000],
    ])
    const goals = buildGoals('me', mine, community, wrs)
    expect(goals.map((g) => g.trackId)).toEqual(['mbc', 'dkp', 'rr'])
    expect(goals.every((g) => g.reference === 'wr')).toBe(true)
  })

  it('pistas sin más tiempos en la comunidad', () => {
    const goals = buildGoals('me', [{ track_id: 'ws', time_ms: 90000 }], [], null)
    expect(goals[0]).toMatchObject({ trackId: 'ws', position: 1, total: 1, mostMargin: false })
  })
})

describe('formato', () => {
  it('diferencia en segundos con milésimas según el idioma', () => {
    expect(formatGap(800, 'es-ES')).toBe('0,800')
    expect(formatGap(-12345, 'en-GB')).toBe('12.345')
  })

  it('porcentaje con un decimal', () => {
    expect(formatPct(103.24, 'es-ES')).toBe('103,2')
    expect(formatPct(103.25, 'en-GB')).toMatch(/^103\.[23]$/)
  })
})
