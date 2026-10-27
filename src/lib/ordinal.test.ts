import { describe, expect, it } from 'vitest'
import { ordinal } from './ordinal'

describe('ordinal', () => {
  it('escribe el puesto en cada idioma', () => {
    expect([1, 2, 12].map((n) => ordinal(n, 'es'))).toEqual(['1º', '2º', '12º'])
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map((n) => ordinal(n, 'en'))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
    expect([1, 2, 12].map((n) => ordinal(n, 'fr'))).toEqual(['1er', '2e', '12e'])
    expect([1, 12].map((n) => ordinal(n, 'ja'))).toEqual(['1位', '12位'])
  })
})
