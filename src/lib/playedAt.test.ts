import { describe, expect, it } from 'vitest'
import { dayOptions, eventDate, localDate } from './playedAt'

// Fechas locales: no dependen de la zona horaria de quien ejecute los tests
const now = new Date(2026, 9, 14, 18, 37, 12)

describe('playedAt', () => {
  it('formatea el día local', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('ofrece hoy y los 7 días anteriores', () => {
    const days = dayOptions(now)
    expect(days).toHaveLength(8)
    expect(days[0].value).toBe('2026-10-14')
    expect(days[7].value).toBe('2026-10-07')
  })

  it('pasa por el cambio de mes', () => {
    expect(dayOptions(new Date(2026, 10, 3)).map((d) => d.value)).toContain('2026-10-27')
  })

  it('eventDate: usa la creación salvo que el día declarado sea muy anterior', () => {
    expect(eventDate('2026-10-12T21:10:00Z', null)).toBe('2026-10-12T21:10:00Z')
    expect(eventDate('2026-10-12T21:10:00Z', '2026-10-12')).toBe('2026-10-12T21:10:00Z')
    expect(eventDate('2026-10-12T21:10:00Z', '2026-10-11')).toBe('2026-10-12T21:10:00Z')
    expect(eventDate('2026-10-12T21:10:00Z', '2026-10-07')).toBe('2026-10-07T12:00:00Z')
  })
})
