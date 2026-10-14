import { describe, expect, it } from 'vitest'
import { at, currentHour, dayOptions, hoursFor } from './playedAt'

// Fechas locales: no dependen de la zona horaria de quien ejecute los tests
const now = new Date(2026, 9, 14, 18, 37, 12)

describe('playedAt', () => {
  it('la hora actual en punto', () => {
    expect(currentHour(now)).toEqual(new Date(2026, 9, 14, 18, 0, 0, 0))
  })

  it('ofrece hoy y los 7 días anteriores', () => {
    const days = dayOptions(now)
    expect(days).toHaveLength(8)
    expect(days[0]).toEqual(new Date(2026, 9, 14))
    expect(days[7]).toEqual(new Date(2026, 9, 7))
  })

  it('hoy solo hasta la hora actual', () => {
    const hours = hoursFor(dayOptions(now)[0], now)
    expect(hours[0]).toBe(0)
    expect(hours.at(-1)).toBe(18)
  })

  it('un día intermedio tiene las 24 horas', () => {
    expect(hoursFor(dayOptions(now)[3], now)).toHaveLength(24)
  })

  it('hace 7 días solo desde la hora actual', () => {
    const hours = hoursFor(dayOptions(now)[7], now)
    expect(hours[0]).toBe(18)
    expect(hours.at(-1)).toBe(23)
  })

  it('at compone día y hora', () => {
    expect(at(new Date(2026, 9, 10), 21)).toEqual(new Date(2026, 9, 10, 21, 0, 0, 0))
  })
})
