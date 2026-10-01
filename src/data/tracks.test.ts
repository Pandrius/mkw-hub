import { describe, expect, it } from 'vitest'
import { getTrackByAbbr, getTrackImage, TRACKS } from './tracks'

describe('tracks', () => {
  it('las 30 pistas principales tienen abreviatura única', () => {
    const main = TRACKS.filter((t) => !t.parentId)
    expect(main).toHaveLength(30)
    const abbrs = main.map((t) => t.abbr)
    expect(abbrs.every(Boolean)).toBe(true)
    expect(new Set(abbrs).size).toBe(30)
  })

  it('las 40 pistas tienen abreviatura única', () => {
    const abbrs = TRACKS.map((t) => t.abbr)
    expect(abbrs.every(Boolean)).toBe(true)
    expect(new Set(abbrs).size).toBe(40)
  })

  it('todas las pistas tienen imagen (las SNES usan la de su pista madre)', () => {
    for (const t of TRACKS) {
      expect(getTrackImage(t), t.name).toBeTruthy()
      expect(getTrackImage(t, true), `${t.name} HD`).toBeTruthy()
    }
    expect(getTrackImage(getTrackByAbbr('rGV2')!)).toMatch(/tracks\/BCi\.webp$/)
    expect(getTrackImage(getTrackByAbbr('rGV2')!, true)).toMatch(/tracks\/hd\/BCi\.webp$/)
  })

  it('busca por abreviatura sin distinguir mayúsculas', () => {
    expect(getTrackByAbbr('rdkp')?.name).toBe('DK Pass')
    expect(getTrackByAbbr('BCi')?.name).toBe('Boo Cinema')
    expect(getTrackByAbbr('BC')?.name).toBe("Bowser's Castle")
  })
})
