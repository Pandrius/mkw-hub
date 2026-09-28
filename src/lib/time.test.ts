import { describe, expect, it } from 'vitest'
import { formatTime, parseTime } from './time'

describe('formatTime', () => {
  it('usa el formato de Mario Kart', () => {
    expect(formatTime(139361)).toBe(`2'19"361`)
    expect(formatTime(45007)).toBe(`0'45"007`)
  })
})

describe('parseTime', () => {
  it.each([
    ['2:19.361', 139361],
    [`2'19"361`, 139361],
    ['2 19 361', 139361],
    ['0:45.2', 45200],
    ['45.123', 45123],
    [' 1:05,050 ', 65050],
  ])('%s → %i', (input, expected) => {
    expect(parseTime(input)).toBe(expected)
  })

  it('rechaza formatos no válidos', () => {
    expect(parseTime('2:75.000')).toBeNull()
    expect(parseTime('abc')).toBeNull()
    expect(parseTime('')).toBeNull()
  })

  it('es la inversa de formatTime', () => {
    for (const ms of [139361, 45007, 61000, 600]) expect(parseTime(formatTime(ms))).toBe(ms)
  })
})
