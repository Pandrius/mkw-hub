import { describe, expect, it } from 'vitest'
import { getTrackByAbbr, TRACKS } from './tracks'

describe('tracks', () => {
  it('las 30 pistas principales tienen abreviatura única', () => {
    const main = TRACKS.filter((t) => !t.parentId)
    expect(main).toHaveLength(30)
    const abbrs = main.map((t) => t.abbr)
    expect(abbrs.every(Boolean)).toBe(true)
    expect(new Set(abbrs).size).toBe(30)
  })

  it('busca por abreviatura sin distinguir mayúsculas', () => {
    expect(getTrackByAbbr('rdkp')?.name).toBe('DK Pass')
    expect(getTrackByAbbr('BCi')?.name).toBe('Boo Cinema')
    expect(getTrackByAbbr('BC')?.name).toBe("Bowser's Castle")
  })
})
