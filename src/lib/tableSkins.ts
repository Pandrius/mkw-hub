/*
 * Texturas de los dos diseños «temáticos» de las tablas libres: hielo (como congelada, edad de hielo) y magma (roca volcánica con
 * grietas incandescentes). Solo dibujo decorativo con Canvas 2D; el trazado de la tabla está en tableImageDraw.ts. Todo se genera
 * con un generador pseudoaleatorio de semilla fija, así que la misma tabla sale siempre igual.
 */
import { mixColors, type Palette } from './warDesign'

type Ctx = CanvasRenderingContext2D
export type Skin = 'ice' | 'magma'

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

const rgba = (hex: string, a: number) => {
  const c = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `rgba(${c(0)},${c(1)},${c(2)},${a})`
}

function poly(ctx: Ctx, pts: [number, number][]) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
}

/** Carámbanos colgando de un borde horizontal: triángulos irregulares, más largos en unos sitios que en otros */
function icicles(ctx: Ctx, C: Palette, x0: number, x1: number, y: number, maxH: number, seed: number) {
  const r = rng(seed)
  let x = x0
  while (x < x1) {
    const w = 8 + r() * 20
    // Unos pocos largos y muchos cortos
    const h = 6 + Math.pow(r(), 2.2) * maxH
    const xe = Math.min(x + w, x1)
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, 'rgba(255,255,255,0.97)')
    g.addColorStop(1, rgba(mixColors(C.accent, '#ffffff', 0.55), 0.85))
    ctx.fillStyle = g
    poly(ctx, [[x, y], [xe, y], [x + (xe - x) * (0.35 + r() * 0.3), y + h]])
    ctx.fill()
    ctx.strokeStyle = rgba(mixColors(C.accent, '#ffffff', 0.4), 0.55)
    ctx.lineWidth = 1
    ctx.stroke()
    // Brillo en un lado del carámbano
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    poly(ctx, [[x + 1, y], [x + (xe - x) * 0.4, y], [x + (xe - x) * 0.45, y + h * 0.55]])
    ctx.fill()
    if (xe >= x1) break
    x = xe - 1
  }
}

/** Grieta irregular de varios tramos con ramas, de (x, y) hacia el ángulo dado */
function crackPath(r: () => number, x: number, y: number, angle: number, segments: number, step: number, out: [number, number][][], branch = 0.22) {
  const pts: [number, number][] = [[x, y]]
  let a = angle
  for (let i = 0; i < segments; i++) {
    a += (r() - 0.5) * 1.1
    x += Math.cos(a) * step * (0.5 + r())
    y += Math.sin(a) * step * (0.5 + r())
    pts.push([x, y])
    if (r() < branch && segments - i > 3) crackPath(r, x, y, a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.7), Math.floor((segments - i) / 2), step * 0.8, out, branch * 0.5)
  }
  out.push(pts)
}

function strokePaths(ctx: Ctx, paths: [number, number][][]) {
  for (const p of paths) {
    ctx.beginPath()
    p.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.stroke()
  }
}

// ───────────────────────── Fondo ─────────────────────────

export function skinBackground(skin: Skin, ctx: Ctx, C: Palette, W: number, H: number) {
  const r = rng(W * 31 + Math.round(H))
  if (skin === 'ice') {
    // Hielo: degradado frío, placas de hielo fracturado, nieve y escarcha en los bordes
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, mixColors(C.bg, '#ffffff', 0.55))
    g.addColorStop(1, mixColors(C.bg, C.accent, 0.3))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 90; i++) {
      const cx = r() * W
      const cy = r() * H
      const rad = 70 + r() * 260
      const n = 3 + Math.floor(r() * 2)
      const base = r() * Math.PI * 2
      const pts: [number, number][] = Array.from({ length: n }, (_, k) => {
        const ang = base + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.9
        return [cx + Math.cos(ang) * rad * (0.5 + r() * 0.5), cy + Math.sin(ang) * rad * (0.5 + r() * 0.5)]
      })
      ctx.fillStyle = r() < 0.6 ? `rgba(255,255,255,${0.05 + r() * 0.11})` : rgba(C.accent, 0.04 + r() * 0.06)
      poly(ctx, pts)
      ctx.fill()
      ctx.strokeStyle = `rgba(255,255,255,${0.14 + r() * 0.2})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
    // Grietas finas dentro del hielo
    const cracks: [number, number][][] = []
    for (let i = 0; i < 9; i++) crackPath(r, r() * W, r() * H, r() * Math.PI * 2, 8, 46, cracks, 0.3)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1.4
    strokePaths(ctx, cracks)
    ctx.strokeStyle = rgba(mixColors(C.accent, '#ffffff', 0.2), 0.25)
    ctx.lineWidth = 0.8
    strokePaths(ctx, cracks)
    // Escarcha blanca en los cuatro bordes
    for (const [x0, y0, x1, y1] of [[0, 0, 110, 0], [W, 0, W - 110, 0], [0, 0, 0, 110], [0, H, 0, H - 130]] as const) {
      const f = ctx.createLinearGradient(x0, y0, x1, y1)
      f.addColorStop(0, 'rgba(255,255,255,0.85)')
      f.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = f
      ctx.fillRect(0, 0, W, H)
    }
    // Nieve y cristales
    for (let i = 0; i < 650; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.55})`
      ctx.beginPath()
      ctx.arc(r() * W, r() * H, 0.5 + r() * 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 26; i++) {
      // Copos de seis puntas
      const cx = r() * W
      const cy = r() * H
      const size = 5 + r() * 9
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + r() * 0.4})`
      ctx.lineWidth = 1.2
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3
        ctx.beginPath()
        ctx.moveTo(cx - Math.cos(a) * size, cy - Math.sin(a) * size)
        ctx.lineTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size)
        ctx.stroke()
      }
    }
    return
  }

  // Magma: basalto oscuro, brillo de lava abajo, grietas incandescentes y brasas
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 110; i++) {
    const cx = r() * W
    const cy = r() * H
    const rad = 40 + r() * 170
    const pts: [number, number][] = Array.from({ length: 5 }, (_, k) => {
      const ang = (k / 5) * Math.PI * 2 + r() * 0.8
      return [cx + Math.cos(ang) * rad * (0.55 + r() * 0.45), cy + Math.sin(ang) * rad * (0.55 + r() * 0.45)]
    })
    ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.12 + r() * 0.2})` : `rgba(255,255,255,${0.012 + r() * 0.025})`
    poly(ctx, pts)
    ctx.fill()
  }
  const pool = ctx.createRadialGradient(W / 2, H + 120, 20, W / 2, H + 120, H * 0.95)
  pool.addColorStop(0, rgba(C.accent, 0.62))
  pool.addColorStop(0.45, rgba(C.red, 0.22))
  pool.addColorStop(1, rgba(C.red, 0))
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, W, H)
  const cracks: [number, number][][] = []
  for (let i = 0; i < 16; i++) {
    // Las grietas nacen más abajo, de donde sube la lava
    const y0 = H * (0.35 + r() * 0.75)
    crackPath(r, r() * W, y0, -Math.PI / 2 + (r() - 0.5) * 2, 11, 38, cracks, 0.28)
  }
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = C.accent
  ctx.shadowBlur = 18
  ctx.strokeStyle = rgba(C.accent, 0.55)
  ctx.lineWidth = 5
  strokePaths(ctx, cracks)
  ctx.shadowBlur = 6
  ctx.strokeStyle = mixColors(C.accent, '#fff0b8', 0.7)
  ctx.lineWidth = 1.6
  strokePaths(ctx, cracks)
  ctx.restore()
  for (let i = 0; i < 190; i++) {
    const y = H * (1 - Math.pow(r(), 1.7))
    ctx.fillStyle = rgba(r() < 0.55 ? C.accent : mixColors(C.accent, '#fff0b8', 0.7), 0.25 + r() * 0.65)
    ctx.beginPath()
    ctx.arc(r() * W, y, 0.7 + r() * 2.1, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ───────────────────────── Paneles ─────────────────────────

/** Borde de roca: el rectángulo con el contorno irregular (para el magma) */
function jaggedRect(ctx: Ctx, r: () => number, x: number, y: number, w: number, h: number, jitter: number) {
  const pts: [number, number][] = []
  for (let px = x; px < x + w; px += 16) pts.push([px, y + (r() - 0.5) * jitter])
  for (let py = y; py < y + h; py += 16) pts.push([x + w + (r() - 0.5) * jitter, py])
  for (let px = x + w; px > x; px -= 16) pts.push([px, y + h + (r() - 0.5) * jitter])
  for (let py = y + h; py > y; py -= 16) pts.push([x + (r() - 0.5) * jitter, py])
  poly(ctx, pts)
}

export function skinPanel(skin: Skin, ctx: Ctx, C: Palette, x: number, y: number, w: number, h: number, alpha: number) {
  const r = rng(Math.round(x * 7 + y * 13 + w * 3 + h))
  if (skin === 'ice') {
    // Cristal helado: casi blanco, con escarcha arriba, borde brillante y carámbanos colgando
    ctx.fillStyle = mixColors(C.surface, '#ffffff', 0.45)
    ctx.globalAlpha = Math.max(alpha, 0.82)
    ctx.fillRect(x, y, w, h)
    ctx.globalAlpha = 1
    const frost = ctx.createLinearGradient(0, y, 0, y + 34)
    frost.addColorStop(0, 'rgba(255,255,255,0.9)')
    frost.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = frost
    ctx.fillRect(x, y, w, 34)
    // Reflejo diagonal del cristal
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    poly(ctx, [[x + w * 0.55, y], [x + w * 0.7, y], [x + w * 0.45, y + h], [x + w * 0.3, y + h]])
    ctx.fill()
    ctx.strokeStyle = rgba(mixColors(C.accent, C.line, 0.4), 0.9)
    ctx.lineWidth = 2
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8)
    icicles(ctx, C, x + 2, x + w - 2, y + 1, Math.min(34, h * 0.4), Math.round(x * 3 + y * 5 + w))
    // Un poco de nieve acumulada en el borde de arriba
    for (let i = 0; i < Math.floor(w / 5); i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.6 + r() * 0.4})`
      ctx.beginPath()
      ctx.arc(x + 4 + r() * (w - 8), y + 2 + r() * 4, 1 + r() * 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }

  // Losa de basalto con el contorno de roca y una grieta de lava por el borde
  ctx.save()
  jaggedRect(ctx, r, x + 2, y + 2, w - 4, h - 4, 5)
  ctx.fillStyle = C.surface
  ctx.globalAlpha = alpha
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
  const glow = ctx.createLinearGradient(0, y + h - 36, 0, y + h)
  glow.addColorStop(0, rgba(C.accent, 0))
  glow.addColorStop(1, rgba(C.accent, 0.3))
  ctx.fillStyle = glow
  ctx.fillRect(x + 2, y + h - 36, w - 4, 34)
  ctx.save()
  ctx.shadowColor = C.accent
  ctx.shadowBlur = 16
  ctx.strokeStyle = rgba(C.accent, 0.95)
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  const r2 = rng(Math.round(x * 7 + y * 13 + w * 3 + h))
  jaggedRect(ctx, r2, x + 2, y + 2, w - 4, h - 4, 5)
  ctx.stroke()
  ctx.restore()
  ctx.strokeStyle = mixColors(C.accent, '#fff0b8', 0.6)
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 1
  const r3 = rng(Math.round(x * 7 + y * 13 + w * 3 + h))
  jaggedRect(ctx, r3, x + 2, y + 2, w - 4, h - 4, 5)
  ctx.stroke()
  ctx.globalAlpha = 1
}

// ───────────────────────── Barra superior ─────────────────────────

/** Franja de arriba: escarcha con carámbanos, o lava con goteras */
export function skinBar(skin: Skin, ctx: Ctx, C: Palette, W: number, h: number) {
  if (skin === 'ice') {
    const g = ctx.createLinearGradient(0, 0, W, 0)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.5, mixColors(C.accent, '#ffffff', 0.45))
    g.addColorStop(1, '#ffffff')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, h)
    icicles(ctx, C, 0, W, h - 1, 30, 4242)
    return
  }
  const g = ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, C.red)
  g.addColorStop(0.35, C.accent)
  g.addColorStop(0.6, mixColors(C.accent, '#fff0b8', 0.7))
  g.addColorStop(0.85, C.accent)
  g.addColorStop(1, C.red)
  ctx.save()
  ctx.shadowColor = C.accent
  ctx.shadowBlur = 14
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, h)
  // Goteras de lava
  const r = rng(777)
  let x = 6
  while (x < W) {
    const w = 8 + r() * 14
    const drop = 4 + Math.pow(r(), 2) * 26
    ctx.beginPath()
    ctx.moveTo(x, h - 1)
    ctx.lineTo(x + w, h - 1)
    ctx.quadraticCurveTo(x + w * 0.5, h + drop * 1.6, x + w * 0.5, h + drop)
    ctx.quadraticCurveTo(x + w * 0.5, h + drop * 1.6, x, h - 1)
    ctx.fill()
    x += w + 6 + r() * 30
  }
  ctx.restore()
}

/** Relleno de las cifras de magma: de amarillo incandescente a rojo, de arriba abajo */
export function moltenPaint(ctx: Ctx, C: Palette, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, '#fff3b0')
  g.addColorStop(0.45, C.accent)
  g.addColorStop(1, C.red)
  return g
}
