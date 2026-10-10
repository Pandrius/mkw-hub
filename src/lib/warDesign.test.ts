import { describe, expect, it } from 'vitest'
import { coverRect, DEFAULT_DESIGN, DESIGN_VERSION, fitWithin, luminance, medalColor, mixColors, parseDesign, PRESET_IDS, PRESET_STYLE, PRESETS, readable, resolvePalette } from './warDesign'

describe('resolvePalette', () => {
  it('sin retoques es la del preset', () => {
    expect(resolvePalette(DEFAULT_DESIGN)).toEqual(PRESETS.asphalt)
    expect(resolvePalette({ ...DEFAULT_DESIGN, preset: 'neon' })).toEqual(PRESETS.neon)
  })
  it('los colores propios van por encima y los inválidos se ignoran', () => {
    const p = resolvePalette({ ...DEFAULT_DESIGN, colors: { accent: '#ff0000', bg: 'rojo' as string } })
    expect(p.accent).toBe('#ff0000')
    expect(p.bg).toBe(PRESETS.asphalt.bg)
  })
})

describe('readable', () => {
  it('texto oscuro sobre fondos claros y claro sobre oscuros', () => {
    expect(readable('#ffd500')).toBe('#141414')
    expect(readable('#ffffff')).toBe('#141414')
    expect(readable('#141414')).toBe('#ffffff')
    expect(readable('#0b0b1a')).toBe('#ffffff')
  })
  it('luminance va de 0 a 1', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#ffffff')).toBeCloseTo(1, 5)
  })
})

describe('parseDesign', () => {
  it('lo roto o desconocido vuelve al diseño por defecto', () => {
    expect(parseDesign(null)).toEqual(DEFAULT_DESIGN)
    expect(parseDesign('x')).toEqual(DEFAULT_DESIGN)
    expect(parseDesign({ preset: 'inventado' }).preset).toBe('asphalt')
  })
  it('conserva lo válido y descarta lo demás', () => {
    const d = parseDesign({
      preset: 'ocean',
      colors: { accent: '#AABBCC', ink: 'no', otro: '#000000' },
      photo: { dataUrl: 'data:image/jpeg;base64,AAAA', dim: 5 },
      stripes: false,
    })
    expect(d.preset).toBe('ocean')
    expect(d.colors).toEqual({ accent: '#aabbcc' })
    expect(d.photo).toEqual({ dataUrl: 'data:image/jpeg;base64,AAAA', dim: 0.9 })
    expect(d.stripes).toBe(false)
  })
  it('no acepta como foto algo que no sea una imagen en base64', () => {
    expect(parseDesign({ photo: { dataUrl: 'https://evil.com/a.png', dim: 0.5 } }).photo).toBeNull()
    expect(parseDesign({ photo: { dataUrl: 'data:text/html;base64,AAAA', dim: 0.5 } }).photo).toBeNull()
    expect(parseDesign({ photo: { dataUrl: 'data:image/svg+xml;base64,AAAA', dim: 0.5 } }).photo).toBeNull()
  })
})

describe('fitWithin', () => {
  it('reduce manteniendo la proporción y nunca agranda', () => {
    expect(fitWithin(4000, 2000, 1600)).toEqual({ width: 1600, height: 800 })
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
})

describe('coverRect', () => {
  it('recorta por los lados una foto más ancha que el lienzo', () => {
    // Lienzo cuadrado, foto 2:1 → se ve la parte central
    expect(coverRect(2000, 1000, 500, 500)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 })
  })
  it('recorta por arriba y abajo una foto más alta', () => {
    expect(coverRect(1000, 2000, 500, 500)).toEqual({ sx: 0, sy: 500, sw: 1000, sh: 1000 })
  })
})

describe('presets', () => {
  // Distancia entre dos colores #rrggbb (0 iguales, ~441 blanco y negro)
  const dist = (a: string, b: string) => {
    const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
    return Math.hypot(c(a, 0) - c(b, 0), c(a, 1) - c(b, 1), c(a, 2) - c(b, 2))
  }

  it('todos los presets tienen un estilo y colores válidos', () => {
    for (const id of PRESET_IDS) {
      expect(['standard', 'elegant']).toContain(PRESET_STYLE[id])
      for (const color of Object.values(PRESETS[id])) expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('Oficial es el estilo elegante y el resto el estándar', () => {
    expect(PRESET_STYLE.official).toBe('elegant')
    expect(PRESET_IDS.filter((id) => PRESET_STYLE[id] === 'elegant')).toEqual(['official'])
  })

  it('Neón y Océano no se parecen: ni el acento ni el fondo', () => {
    expect(dist(PRESETS.neon.accent, PRESETS.ocean.accent)).toBeGreaterThan(200)
    expect(dist(PRESETS.neon.bg, PRESETS.ocean.bg)).toBeGreaterThan(15)
  })

  it('el Claro es crema: ningún fondo ni panel es blanco puro', () => {
    for (const color of [PRESETS.light.bg, PRESETS.light.surface, PRESETS.light.surface2]) {
      expect(color.toLowerCase()).not.toBe('#ffffff')
      expect(dist(color, '#ffffff')).toBeGreaterThan(15)
    }
  })

  it('el texto se lee sobre el fondo en todos los presets', () => {
    for (const id of PRESET_IDS) {
      const p = PRESETS[id]
      expect(Math.abs(luminance(p.ink) - luminance(p.bg))).toBeGreaterThan(0.5)
    }
  })
})

describe('perspectiva neutral', () => {
  it('es la de por defecto', () => {
    expect(DEFAULT_DESIGN.neutral).toBe(true)
    expect(parseDesign(null).neutral).toBe(true)
    expect(parseDesign({}).neutral).toBe(true)
  })

  it('lo guardado con la versión actual se respeta, también si se eligió la del equipo', () => {
    expect(parseDesign({ v: DESIGN_VERSION, neutral: false }).neutral).toBe(false)
    expect(parseDesign({ v: DESIGN_VERSION, neutral: true }).neutral).toBe(true)
    expect(parseDesign({ v: DESIGN_VERSION }).neutral).toBe(true)
  })

  it('lo guardado antes de que lo neutral fuera lo normal se pasa a neutral', () => {
    // Antes se guardaba "neutral: false" aunque nadie lo hubiera elegido
    expect(parseDesign({ preset: 'official', neutral: false }).neutral).toBe(true)
    expect(parseDesign({ preset: 'official', neutral: false }).preset).toBe('official')
  })
})

describe('medalColor', () => {
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const max = Math.max(r, g, b)
    const d = max - Math.min(r, g, b)
    if (d === 0) return 0
    return (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60
  }
  const sat = (hex: string) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    return (Math.max(...v) - Math.min(...v)) / (Math.max(...v) || 1)
  }

  it('el oro es dorado, la plata gris y el bronce marrón anaranjado, en fondo oscuro y claro', () => {
    for (const light of [false, true]) {
      const [gold, silver, bronze] = [0, 1, 2].map((r) => medalColor(r, light)!)
      expect(hue(gold)).toBeGreaterThan(35)
      expect(hue(gold)).toBeLessThan(55)
      expect(sat(silver)).toBeLessThan(0.15)
      expect(hue(bronze)).toBeGreaterThan(20)
      expect(hue(bronze)).toBeLessThan(40)
      expect(sat(bronze)).toBeGreaterThan(0.4)
    }
  })

  it('no depende de la paleta: en ningún diseño el oro es el color de acento', () => {
    for (const id of PRESET_IDS) {
      const light = luminance(PRESETS[id].bg) > 0.5
      expect(medalColor(0, light)!.toLowerCase()).not.toBe(PRESETS[id].accent.toLowerCase())
    }
  })

  it('solo hay tres medallas', () => {
    expect(medalColor(3, false)).toBeNull()
    expect(medalColor(-1, false)).toBeNull()
  })
})

describe('mixColors', () => {
  it('mezcla dos colores', () => {
    expect(mixColors('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixColors('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixColors('#d4af37', '#ffffff', 0.55)).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('aclarar es más luminoso y oscurecer menos que el original', () => {
    const gold = '#d4af37'
    expect(luminance(mixColors(gold, '#ffffff', 0.5))).toBeGreaterThan(luminance(gold))
    expect(luminance(mixColors(gold, '#000000', 0.5))).toBeLessThan(luminance(gold))
  })
})
