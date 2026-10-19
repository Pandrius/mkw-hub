/*
 * Texturas de los dos diseños «temáticos» de las tablas libres: hielo (como congelada, edad de hielo) y magma (corteza de roca
 * volcánica con lava por las juntas). Las texturas se calculan píxel a píxel con ruido (fbm y Worley/Voronoi) en vez de dibujar
 * líneas y brillos, que es lo que hace que un diseño parezca generado: las grietas siguen las juntas de las placas, no hay
 * simetría ni contornos de neón, y encima va un grano fino. El trazado de la tabla está en tableImageDraw.ts. Todo es
 * determinista (semilla fija): la misma tabla sale siempre igual.
 */
import { mixColors, type Palette } from './warDesign'

type Ctx = CanvasRenderingContext2D
export type Skin = 'ice' | 'magma'

// ───────────────────────── Ruido ─────────────────────────

/** Generador pseudoaleatorio determinista (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Valor pseudoaleatorio estable de una celda entera (0 a 1) */
function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const step = (a: number, b: number, v: number) => smooth(clamp01((v - a) / (b - a)))

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = hash(ix, iy, seed)
  const b = hash(ix + 1, iy, seed)
  const c = hash(ix, iy + 1, seed)
  const d = hash(ix + 1, iy + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** Ruido fractal: varias capas de detalle cada vez más fino (0 a 1 aproximadamente) */
function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x, y, seed + o * 17) * amp
    norm += amp
    x *= 2.03
    y *= 2.03
    amp *= 0.5
  }
  return sum / norm
}

/** Worley: distancia al punto más cercano (f1) y al segundo (f2) de una rejilla de puntos desplazados al azar */
function worley(x: number, y: number, seed: number): [number, number] {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  let f1 = 9
  let f2 = 9
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i
      const cy = iy + j
      const px = cx + hash(cx, cy, seed)
      const py = cy + hash(cx, cy, seed + 101)
      const d = Math.hypot(px - x, py - y)
      if (d < f1) {
        f2 = f1
        f1 = d
      } else if (d < f2) f2 = d
    }
  }
  return [f1, f2]
}

type RGB = [number, number, number]
const rgbOf = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
const mix3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgba = (hex: string, a: number) => `rgba(${rgbOf(hex).join(',')},${a})`

// ───────────────────────── Fondo ─────────────────────────

/** Resolución a la que se calcula la textura (se estira después): el ruido es suave y lo disimula, y así sale rápido */
const TEX_SCALE = 0.6

const cache = new Map<string, HTMLCanvasElement>()

/** Textura de fondo ya calculada para este tamaño y paleta (calcularla cuesta unos cientos de ms, así que se guarda) */
function backgroundTexture(skin: Skin, C: Palette, W: number, H: number): HTMLCanvasElement {
  const key = `${skin}|${W}|${H}|${C.bg}|${C.accent}|${C.red}`
  const hit = cache.get(key)
  if (hit) return hit
  const w = Math.round(W * TEX_SCALE)
  const h = Math.round(H * TEX_SCALE)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const img = ctx.createImageData(w, h)
  const px = img.data
  if (skin === 'ice') paintIce(px, w, h, C)
  else paintMagma(px, w, h, C)
  ctx.putImageData(img, 0, 0)
  if (cache.size > 6) cache.delete(cache.keys().next().value as string)
  cache.set(key, canvas)
  return canvas
}

function paintIce(px: Uint8ClampedArray, w: number, h: number, C: Palette) {
  const top = rgbOf(mixColors(C.bg, '#ffffff', 0.45))
  const deep = rgbOf(mixColors(C.bg, C.accent, 0.42))
  const white: RGB = [246, 251, 255]
  const vein: RGB = rgbOf(mixColors(C.accent, '#ffffff', 0.35))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / TEX_SCALE
      const v = y / TEX_SCALE
      // Hielo con nubes: el color varía en manchas grandes y algo en vertical (más azul cuanto más profundo)
      const cloud = fbm(u / 210, v / 210, 11, 4)
      let c = mix3(top, deep, clamp01(0.15 + (v / (h / TEX_SCALE)) * 0.55 + (cloud - 0.5) * 0.7))
      // Placas fracturadas: juntas finas y claras (grietas) con un poco de desvío
      const wx = u / 150 + (fbm(u / 90, v / 90, 3, 2) - 0.5) * 0.9
      const wy = v / 150 + (fbm(u / 90 + 9, v / 90 + 9, 5, 2) - 0.5) * 0.9
      const [f1, f2] = worley(wx, wy, 21)
      const edge = f2 - f1
      const crack = 1 - step(0.0, 0.045, edge)
      c = mix3(c, vein, crack * 0.55)
      // Cada placa un poco más clara o más oscura que la vecina
      const cellShade = (hash(Math.floor(wx), Math.floor(wy), 8) - 0.5) * 0.1
      c = [c[0] + cellShade * 90, c[1] + cellShade * 90, c[2] + cellShade * 60]
      // Rima: cristales de escarcha en los cuatro bordes, irregulares, con grano fino
      const d = Math.min(u, W_OF(w) - u, v, H_OF(h) - v)
      const rough = fbm(u / 22, v / 22, 33, 3) * 90 + fbm(u / 7, v / 7, 44, 2) * 30
      const frost = 1 - step(10, 130 + 20, d + rough - 40)
      const grain = valueNoise(u / 2.2, v / 2.2, 55)
      c = mix3(c, white, clamp01(frost * (0.62 + grain * 0.38)))
      const i = (y * w + x) * 4
      px[i] = c[0]
      px[i + 1] = c[1]
      px[i + 2] = c[2]
      px[i + 3] = 255
    }
  }
}

const W_OF = (w: number) => w / TEX_SCALE
const H_OF = (h: number) => h / TEX_SCALE

function paintMagma(px: Uint8ClampedArray, w: number, h: number, C: Palette) {
  const rock1 = rgbOf(mixColors(C.bg, '#000000', 0.35))
  const rock2 = rgbOf(mixColors(C.bg, '#6a4a3c', 0.28))
  const deepRed = rgbOf(mixColors(C.red, '#000000', 0.45))
  const orange = rgbOf(C.accent)
  const hot = rgbOf(mixColors(C.accent, '#fff3c4', 0.78))
  const H = h / TEX_SCALE
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / TEX_SCALE
      const v = y / TEX_SCALE
      // Calor: más cerca del fondo y en manchas, de donde sube la lava
      const heat = clamp01(0.18 + Math.pow(v / H, 1.6) * 0.8 + (fbm(u / 260, v / 260, 61, 3) - 0.5) * 0.8)
      // Placas de corteza: celdas de Voronoi con las juntas desviadas, que es donde asoma la lava
      const wx = u / 135 + (fbm(u / 70, v / 70, 71, 3) - 0.5) * 1.15
      const wy = v / 135 + (fbm(u / 70 + 5, v / 70 + 5, 73, 3) - 0.5) * 1.15
      const [f1, f2] = worley(wx, wy, 81)
      const edge = f2 - f1
      // Las juntas son más anchas donde hay más calor y varían a lo largo de su recorrido
      const widen = 0.035 + heat * 0.11 + (fbm(u / 40, v / 40, 91, 2) - 0.5) * 0.06
      const crack = 1 - step(0.0, Math.max(widen, 0.012), edge)
      const halo = Math.exp(-edge * 11) * (0.18 + heat * 0.5)
      // Corteza: basalto con manchas y grano; las placas más calientes se aclaran un poco hacia el borde
      const tex = fbm(u / 9, v / 9, 101, 3)
      let c = mix3(rock1, rock2, clamp01(tex * 0.9 + (fbm(u / 120, v / 120, 111, 3) - 0.5) * 0.5))
      c = mix3(c, deepRed, clamp01(halo * 1.4))
      // Lava: de rojo oscuro en los bordes de la junta a naranja y casi blanco en el centro, según el calor
      const core = clamp01(crack * (0.4 + heat * 0.9))
      const lava = mix3(mix3(deepRed, orange, clamp01(core * 1.4)), hot, clamp01((core - 0.55) * 2.2))
      c = mix3(c, lava, clamp01(crack * 1.05))
      const i = (y * w + x) * 4
      px[i] = c[0]
      px[i + 1] = c[1]
      px[i + 2] = c[2]
      px[i + 3] = 255
    }
  }
}

export function skinBackground(skin: Skin, ctx: Ctx, C: Palette, W: number, H: number) {
  const tex = backgroundTexture(skin, C, W, H)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(tex, 0, 0, W, H)
  const r = rng(W * 31 + Math.round(H))
  if (skin === 'ice') {
    // Burbujas atrapadas en el hielo y un poco de nieve suelta
    for (let i = 0; i < 38; i++) {
      const x = r() * W
      const y = r() * H
      const rad = 1.2 + Math.pow(r(), 2.4) * 7
      ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.35})`
      ctx.beginPath()
      ctx.ellipse(x, y, rad, rad * (0.8 + r() * 0.4), r() * 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(110,160,200,${0.2 + r() * 0.2})`
      ctx.lineWidth = 0.7
      ctx.stroke()
    }
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.55})`
      ctx.beginPath()
      ctx.arc(r() * W, r() * H, 0.4 + r() * 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  // Magma: unas pocas chispas, sin exagerar
  for (let i = 0; i < 70; i++) {
    const y = H * (1 - Math.pow(r(), 2.2))
    ctx.fillStyle = rgba(r() < 0.6 ? C.accent : mixColors(C.accent, '#fff3c4', 0.7), 0.2 + r() * 0.5)
    ctx.beginPath()
    ctx.arc(r() * W, y, 0.5 + r() * 1.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Grano fino por encima de todo: quita el aspecto limpio de vector y lo acerca a una foto */
export function skinGrain(ctx: Ctx, W: number, H: number) {
  const tile = document.createElement('canvas')
  tile.width = 256
  tile.height = 256
  const t = tile.getContext('2d')
  if (!t) return
  const img = t.createImageData(256, 256)
  const r = rng(2024)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + r() * 90
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  t.putImageData(img, 0, 0)
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.22
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

// ───────────────────────── Paneles ─────────────────────────

/** Carámbanos irregulares colgando de un borde: finos, curvos, de largos muy distintos y a rachas */
function icicles(ctx: Ctx, C: Palette, x0: number, x1: number, y: number, maxH: number, seed: number) {
  const r = rng(seed)
  let x = x0 + r() * 6
  while (x < x1 - 4) {
    // A rachas: zonas con carámbanos juntos y huecos sin ninguno
    const gap = r() < 0.18 ? 14 + r() * 40 : 1 + r() * 7
    x += gap
    if (x >= x1 - 4) break
    const w = 3 + r() * 11
    const len = (r() < 0.12 ? 0.55 + r() * 0.45 : 0.1 + Math.pow(r(), 1.7) * 0.5) * maxH + 3
    const lean = (r() - 0.5) * 3
    const g = ctx.createLinearGradient(0, y, 0, y + len)
    g.addColorStop(0, 'rgba(244,250,255,0.96)')
    g.addColorStop(0.6, rgba(mixColors(C.accent, '#ffffff', 0.62), 0.78))
    g.addColorStop(1, rgba(mixColors(C.accent, '#ffffff', 0.3), 0.55))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + w * 0.1 + lean * 0.3, y + len * 0.55, x + w / 2 + lean, y + len)
    ctx.quadraticCurveTo(x + w * 0.9 + lean * 0.3, y + len * 0.55, x + w, y)
    ctx.closePath()
    ctx.fill()
    // Un lado más oscuro y un hilo de luz: da volumen sin brillos de dibujo
    ctx.strokeStyle = rgba(mixColors(C.accent, '#1b3f66', 0.4), 0.28)
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(x + w * 0.3, y + 1)
    ctx.quadraticCurveTo(x + w * 0.28 + lean * 0.3, y + len * 0.5, x + w * 0.46 + lean, y + len * 0.8)
    ctx.stroke()
    x += w * 0.6
  }
}

/** `drip`: largo máximo de los carámbanos del borde de arriba (cortos en las tablas, para no tapar la cabecera) */
export function skinPanel(skin: Skin, ctx: Ctx, C: Palette, x: number, y: number, w: number, h: number, alpha: number, drip = 14) {
  const r = rng(Math.round(x * 7 + y * 13 + w * 3 + h))
  if (skin === 'ice') {
    // Cristal esmerilado: blanco azulado semitransparente con grano, borde frío y carámbanos solo por arriba
    ctx.fillStyle = mixColors(C.surface, '#ffffff', 0.4)
    ctx.globalAlpha = Math.max(alpha, 0.84)
    ctx.fillRect(x, y, w, h)
    ctx.globalAlpha = 1
    for (let i = 0; i < Math.floor((w * h) / 140); i++) {
      ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.15 + r() * 0.25})` : `rgba(150,190,225,${0.05 + r() * 0.1})`
      ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 2, 1 + r() * 2)
    }
    // Escarcha que baja desde arriba y se pierde
    const frost = ctx.createLinearGradient(0, y, 0, y + 46)
    frost.addColorStop(0, 'rgba(255,255,255,0.7)')
    frost.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = frost
    ctx.fillRect(x, y, w, 46)
    ctx.strokeStyle = rgba(mixColors(C.accent, C.line, 0.35), 0.8)
    ctx.lineWidth = 1.5
    ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5)
    icicles(ctx, C, x + 2, x + w - 2, y + 1, drip, Math.round(x * 3 + y * 5 + w))
    return
  }
  // Losa de basalto: roca oscura con textura y una junta de lava solo en algunos tramos del borde de abajo
  ctx.fillStyle = C.surface
  ctx.globalAlpha = alpha
  ctx.fillRect(x, y, w, h)
  ctx.globalAlpha = 1
  for (let i = 0; i < Math.floor((w * h) / 90); i++) {
    ctx.fillStyle = r() < 0.55 ? `rgba(0,0,0,${0.08 + r() * 0.2})` : `rgba(255,235,220,${0.015 + r() * 0.04})`
    ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 3, 1 + r() * 3)
  }
  ctx.strokeStyle = 'rgba(8,3,2,0.9)'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
  // Lava asomando por abajo, a trozos de largo irregular
  let sx = x + 8
  while (sx < x + w - 20) {
    const len = 30 + r() * 150
    if (r() < 0.62) {
      const seg = Math.min(len, x + w - 8 - sx)
      const glow = ctx.createLinearGradient(0, y + h - 14, 0, y + h)
      glow.addColorStop(0, rgba(C.red, 0))
      glow.addColorStop(1, rgba(C.accent, 0.5))
      ctx.fillStyle = glow
      ctx.fillRect(sx, y + h - 14, seg, 13)
      ctx.fillStyle = rgba(mixColors(C.accent, '#fff3c4', 0.45), 0.85)
      ctx.fillRect(sx + seg * 0.1, y + h - 3, seg * 0.8, 1.6)
    }
    sx += len + 10 + r() * 50
  }
}

// ───────────────────────── Barra superior ─────────────────────────

/** Franja de arriba: escarcha con carámbanos, o corteza con lava asomando */
export function skinBar(skin: Skin, ctx: Ctx, C: Palette, W: number, h: number) {
  if (skin === 'ice') {
    const g = ctx.createLinearGradient(0, 0, 0, h + 4)
    g.addColorStop(0, 'rgba(255,255,255,0.98)')
    g.addColorStop(1, rgba(mixColors(C.accent, '#ffffff', 0.5), 0.9))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, h)
    icicles(ctx, C, 0, W, h - 1, 36, 4242)
    return
  }
  const strip = document.createElement('canvas')
  strip.width = Math.round(W / 2)
  strip.height = Math.max(1, Math.round(h / 2))
  const t = strip.getContext('2d')
  if (!t) return
  const img = t.createImageData(strip.width, strip.height)
  const orange = rgbOf(C.accent)
  const hot = rgbOf(mixColors(C.accent, '#fff3c4', 0.7))
  const dark = rgbOf(mixColors(C.red, '#000000', 0.55))
  for (let y = 0; y < strip.height; y++) {
    for (let x = 0; x < strip.width; x++) {
      const n = fbm(x / 26, y / 3, 123, 3)
      const c = mix3(mix3(dark, orange, clamp01(n * 1.6)), hot, clamp01((n - 0.55) * 2.4))
      const i = (y * strip.width + x) * 4
      img.data[i] = c[0]
      img.data[i + 1] = c[1]
      img.data[i + 2] = c[2]
      img.data[i + 3] = 255
    }
  }
  t.putImageData(img, 0, 0)
  ctx.drawImage(strip, 0, 0, W, h)
  // Lava goteando: pocas gotas, de largos distintos y con la punta redondeada
  const r = rng(777)
  let x = 30 + r() * 80
  ctx.fillStyle = rgba(C.accent, 0.95)
  while (x < W - 20) {
    const w = 4 + r() * 6
    const drop = 5 + Math.pow(r(), 2) * 22
    ctx.beginPath()
    ctx.moveTo(x, h - 1)
    ctx.lineTo(x + w, h - 1)
    ctx.quadraticCurveTo(x + w * 0.9, h + drop * 0.7, x + w / 2, h + drop)
    ctx.quadraticCurveTo(x + w * 0.1, h + drop * 0.7, x, h - 1)
    ctx.fill()
    x += 50 + r() * 190
  }
}

/** Color de las cifras del magma: un blanco cálido de metal al rojo (sin degradado ni brillo de neón) */
export function moltenPaint(_ctx: Ctx, C: Palette): string {
  return mixColors(C.accent, '#fff1cf', 0.82)
}
