import { describe, expect, it } from 'vitest'
import {
  buildHistories,
  chartGeometry,
  formatDiff,
  pbProgression,
  pbVerdict,
  recentPbs,
  timeDate,
  type PlayerTime,
} from './pbHistory'

let nextId = 1
const t = (time_ms: number, achieved_on: string | null, over: Partial<PlayerTime> = {}): PlayerTime => ({
  id: nextId++,
  track_id: 'rainbow-road',
  category: 'race',
  nita: false,
  time_ms,
  achieved_on,
  created_at: `${achieved_on ?? '2026-01-01'}T12:00:00+00:00`,
  proof_url: null,
  ...over,
})

describe('timeDate', () => {
  it('usa la fecha conseguida y, si falta, la de alta', () => {
    expect(timeDate({ achieved_on: '2026-03-02', created_at: '2026-05-01T10:00:00+00:00' })).toBe('2026-03-02')
    expect(timeDate({ achieved_on: null, created_at: '2026-05-01T10:00:00+00:00' })).toBe('2026-05-01')
  })
})

describe('pbProgression', () => {
  it('solo guarda las mejoras, en orden cronológico, con lo que mejoró cada una', () => {
    const steps = pbProgression([
      t(130000, '2026-03-01'),
      t(131000, '2026-01-01'),
      t(132000, '2026-02-01'), // peor que el PB de enero: no cuenta
      t(129588, '2026-04-01'),
      t(129588, '2026-05-01'), // empata: no es mejora
    ])
    expect(steps.map((s) => s.time.time_ms)).toEqual([131000, 130000, 129588])
    expect(steps.map((s) => s.improvement_ms)).toEqual([null, 1000, 412])
    expect(steps.map((s) => s.date)).toEqual(['2026-01-01', '2026-03-01', '2026-04-01'])
  })

  it('el mismo día desempata por la hora en que se añadió', () => {
    const a = t(100500, '2026-01-01', { created_at: '2026-01-01T20:00:00+00:00' })
    const b = t(101000, '2026-01-01', { created_at: '2026-01-01T09:00:00+00:00' })
    expect(pbProgression([a, b]).map((s) => s.time.time_ms)).toEqual([101000, 100500])
  })

  it('lista vacía → sin pasos', () => {
    expect(pbProgression([])).toEqual([])
  })
})

describe('buildHistories', () => {
  it('separa por pista, categoría y NITA, y calcula la mejora total', () => {
    const h = buildHistories([
      t(130000, '2026-01-01'),
      t(128000, '2026-02-01'),
      t(129000, '2026-03-01'),
      t(40000, '2026-01-05', { category: 'flap' }),
      t(135000, '2026-01-01', { nita: true }),
    ])
    expect(h).toHaveLength(3)
    const race = h.find((x) => x.key === 'rainbow-road|race|items')!
    expect(race.steps).toHaveLength(2)
    expect(race.attempts).toBe(3)
    expect(race.total_improvement_ms).toBe(2000)
    const flap = h.find((x) => x.key === 'rainbow-road|flap|items')!
    expect(flap.total_improvement_ms).toBe(0)
    expect(h.some((x) => x.key === 'rainbow-road|race|nita')).toBe(true)
  })
})

describe('recentPbs', () => {
  it('mezcla todas las pistas y ordena del más nuevo al más antiguo', () => {
    const h = buildHistories([
      t(130000, '2026-01-01'),
      t(128000, '2026-03-01'),
      t(90000, '2026-02-01', { track_id: 'mario-bros-circuit' }),
      t(89000, '2026-04-01', { track_id: 'mario-bros-circuit' }),
    ])
    const r = recentPbs(h, 3)
    expect(r.map((s) => s.date)).toEqual(['2026-04-01', '2026-03-01', '2026-02-01'])
    expect(r[0].history.track_id).toBe('mario-bros-circuit')
  })
})

describe('pbVerdict', () => {
  it('distingue primer tiempo, PB, empate y cuánto faltó', () => {
    expect(pbVerdict(null, 100000)).toEqual({ kind: 'first' })
    expect(pbVerdict(100000, 99588)).toEqual({ kind: 'pb', diff_ms: 412 })
    expect(pbVerdict(100000, 100000)).toEqual({ kind: 'tie' })
    expect(pbVerdict(100000, 101250)).toEqual({ kind: 'miss', diff_ms: 1250 })
  })
})

describe('formatDiff', () => {
  it('pone signo y decimales según el idioma', () => {
    expect(formatDiff(-412, 'es-ES')).toBe('−0,412 s')
    expect(formatDiff(1250, 'en-GB')).toBe('+1.250 s')
    expect(formatDiff(0, 'es-ES')).toBe('±0,000 s')
  })
})

describe('chartGeometry', () => {
  const steps = pbProgression([t(130000, '2026-01-01'), t(129000, '2026-01-11'), t(128000, '2026-01-21')])

  it('reparte por fecha y pone el tiempo más rápido arriba', () => {
    const { points, path } = chartGeometry(steps, 120, 40, 10)
    expect(points.map((p) => p.x)).toEqual([10, 60, 110])
    expect(points.map((p) => p.y)).toEqual([30, 20, 10])
    expect(path).toBe('M10 30 H60 V20 H110 V10')
  })

  it('si todo es del mismo día, reparte por orden', () => {
    const sameDay = pbProgression([t(130000, '2026-01-01'), t(129000, '2026-01-01')])
    expect(chartGeometry(sameDay, 100, 40, 0).points.map((p) => p.x)).toEqual([0, 100])
  })

  it('un solo PB queda centrado', () => {
    const one = pbProgression([t(130000, '2026-01-01')])
    expect(chartGeometry(one, 100, 40).points[0]).toMatchObject({ x: 50, y: 20 })
    expect(chartGeometry([], 100, 40)).toEqual({ points: [], path: '' })
  })
})
