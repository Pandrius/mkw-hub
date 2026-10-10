import { describe, expect, it } from 'vitest'
import { getTrack, getTrackByAbbr, getTrackColor, getTrackImage, getTrackTextColor, type Track, TRACKS } from './tracks'

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

  it('todas las 40 pistas tienen imagen dedicada y las que no tuvieran recurren a su pista madre', () => {
    for (const t of TRACKS) {
      expect(getTrackImage(t), t.name).toBeTruthy()
      expect(getTrackImage(t, true), `${t.name} HD`).toBeTruthy()
      expect(getTrackImage(t)).toMatch(new RegExp(`tracks/${t.abbr}\\.webp$`))
      expect(getTrackImage(t, true)).toMatch(new RegExp(`tracks/hd/${t.abbr}\\.webp$`))
    }
    // Comprobar fallback a pista madre si una pista carece de captura propia
    const dummySnesTrack: Track = { id: 'dummy-gv', abbr: 'dummy', name: 'Dummy Ghost Valley', cupId: 'snes', parentId: 'boo-cinema' }
    expect(getTrackImage(dummySnesTrack)).toMatch(/tracks\/BCi\.webp$/)
    expect(getTrackImage(dummySnesTrack, true)).toMatch(/tracks\/hd\/BCi\.webp$/)
  })

  it('busca por abreviatura sin distinguir mayúsculas', () => {
    expect(getTrackByAbbr('rdkp')?.name).toBe('DK Pass')
    expect(getTrackByAbbr('BCi')?.name).toBe('Boo Cinema')
    expect(getTrackByAbbr('BC')?.name).toBe("Bowser's Castle")
  })
})

describe('getTrackColor', () => {
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const max = Math.max(r, g, b)
    const d = max - Math.min(r, g, b)
    if (d === 0) return 0
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return h * 60
  }
  const color = (abbr: string) => getTrackColor(getTrackByAbbr(abbr))

  it('todas las pistas tienen un color válido', () => {
    for (const t of TRACKS) expect(getTrackColor(t), t.id).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('las variantes de una misma pista comparten color', () => {
    expect(new Set(['rMC', 'rMC1', 'rMC2', 'rMC3'].map(color)).size).toBe(1)
    expect(new Set(['rGV1', 'rGV2', 'rGV3'].map(color)).size).toBe(1)
    expect(new Set(['rCM', 'rCM1', 'rCM2'].map(color)).size).toBe(1)
  })

  it('el color sigue a la captura de la pista, no a su copa (Dry Bones Burnout es de lava, no verde)', () => {
    const h = hue(color('DBB')!)
    expect(h < 20 || h > 340).toBe(true)
    // Bowser's Castle es de fuego: tono naranja
    expect(hue(color('BC')!)).toBeGreaterThan(15)
    expect(hue(color('BC')!)).toBeLessThan(45)
    // Sky-High Sundae es de cielo: tono azul
    expect(hue(color('rSHS')!)).toBeGreaterThan(190)
    expect(hue(color('rSHS')!)).toBeLessThan(250)
  })

  it('las pistas sin color propio usan el de su pista madre o el de su copa, y sin pista no hay color', () => {
    expect(getTrackColor(undefined)).toBeUndefined()
    expect(getTrackColor(null)).toBeUndefined()
    const sinColor: Track = { id: 'x', name: 'X', cupId: 'mushroom', parentId: 'rainbow-road' }
    expect(getTrackColor(sinColor)).toBe(getTrackColor(getTrack('rainbow-road')))
    const sinNada: Track = { id: 'y', name: 'Y', cupId: 'leaf' }
    expect(getTrackColor(sinNada)).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('cada placa tiene dos colores y las letras se leen sobre el fondo (contraste de al menos 4,5)', () => {
    const lin = (hex: string, i: number) => {
      const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const lum = (hex: string) => 0.2126 * lin(hex, 0) + 0.7152 * lin(hex, 1) + 0.0722 * lin(hex, 2)
    for (const t of TRACKS) {
      const bg = getTrackColor(t)!
      const fg = getTrackTextColor(t)
      expect(fg, t.id).toMatch(/^#[0-9a-f]{6}$/i)
      expect(fg.toLowerCase(), t.id).not.toBe(bg.toLowerCase())
      const [hi, lo] = lum(bg) > lum(fg) ? [lum(bg), lum(fg)] : [lum(fg), lum(bg)]
      expect((hi + 0.05) / (lo + 0.05), t.id).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('las variantes comparten también el color de las letras', () => {
    for (const group of [['rMC', 'rMC1', 'rMC2', 'rMC3'], ['rGV1', 'rGV2', 'rGV3'], ['rCM', 'rCM1', 'rCM2']]) {
      expect(new Set(group.map((a) => getTrackTextColor(getTrackByAbbr(a)))).size).toBe(1)
    }
  })

  it('Dry Bones Burnout lleva letras claras sobre su fondo rojo oscuro', () => {
    expect(getTrackTextColor(getTrackByAbbr('DBB'))).toBe('#ebfaf8')
  })

  it('sin par de colores propio las letras son casi negras', () => {
    expect(getTrackTextColor(undefined)).toBe('#141414')
    expect(getTrackTextColor({ id: 'y', name: 'Y', cupId: 'leaf' })).toBe('#141414')
  })
})
