/*
 * Imagen de la tabla de war libre (ver freeTable.ts): dos equipos con sus jugadores ordenados, totales y diferencia. Es la misma
 * familia de diseños que la imagen de las wars (presets, colores propios, foto de fondo, franjas) más dos estilos solo de las
 * tablas: «versus» (pantalla de combate partida en diagonal) y «arcade» (recreativa con líneas de barrido).
 * Sin diferencia por carrera ni medias: en una tabla libre no se saben.
 */
import { medalOf, placeOf, type TableData, type TableTeam } from './freeTable'
import { coverRect, luminance, medalColor, mixColors, PRESET_STYLE, readable, resolvePalette, type Palette, type PresetStyle, type WarDesign } from './warDesign'
import { fitText } from './warImage'
import { skinBackground, skinBar, skinGrain, skinPanel, moltenPaint, type Skin } from './tableSkins'
import { canvasToPng, loadPhoto, waitForFonts } from './warImageDraw'

type Ctx = CanvasRenderingContext2D

const SCALE = 2
const W = 1200
const PAD = 32
const GAP = 24
const COL_W = (W - PAD * 2 - GAP) / 2
const ROW_H = 44
const HEAD_H = 36
const TEAM_H = 168

const SANS = 'Barlow, system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'
const DISPLAY_SANS = '"Big Shoulders Display", Barlow, sans-serif'
const DISPLAY_SERIF = '"Bodoni Moda", Didot, Georgia, serif'

/** Mínimo con el que se oscurece una foto de fondo: por debajo, la tabla podría no leerse */
export const MIN_TABLE_DIM = 0.3
/** Opacidad de los paneles con foto de fondo: casi sólidos, la foto se ve por los lados y entre ellos */
const PANEL_ALPHA_PHOTO = 0.9

/** `style` es el trazado (los diseños de hielo y magma usan el estándar) y `skin` la textura que se les añade */
type Env = { ctx: Ctx; C: Palette; style: PresetStyle; skin: Skin | null; display: string; alpha: number; light: boolean }

function text(env: Env, s: string, x: number, y: number, font: string, color: string | CanvasGradient, align: CanvasTextAlign = 'left') {
  env.ctx.font = font
  env.ctx.fillStyle = color
  env.ctx.textAlign = align
  env.ctx.fillText(s, x, y)
}

/** Texto que se encoge hasta `minSize` y, si aun así no cabe, se recorta con «…» */
function fitted(env: Env, s: string, x: number, y: number, maxWidth: number, weight: number, size: number, family: string, color: string | CanvasGradient, align: CanvasTextAlign = 'left', minSize = size) {
  const { ctx } = env
  let px = size
  ctx.font = `${weight} ${px}px ${family}`
  while (px > minSize && ctx.measureText(s).width > maxWidth) {
    px -= 2
    ctx.font = `${weight} ${px}px ${family}`
  }
  text(env, fitText(s, maxWidth, (t) => ctx.measureText(t).width), x, y, ctx.font, color, align)
}

/** Texto con espacio extra entre letras */
function spaced(env: Env, s: string, x: number, y: number, font: string, color: string, spacing: number, align: CanvasTextAlign = 'left') {
  const { ctx } = env
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  const chars = [...s]
  const total = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width + spacing, -spacing)
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x
  for (const ch of chars) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}

function slant(ctx: Ctx, x: number, y: number, w: number, h: number, cut: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x + cut, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w - cut, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()
}

function polygon(ctx: Ctx, points: [number, number][], color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
  ctx.fill()
}

/** Panel plano: borde de 2px (1px y esquinas en el elegante, bloque con sombra dura en el arcade) */
function panel(env: Env, x: number, y: number, w: number, h: number, accent?: string, drip = 14) {
  const { ctx, C, style } = env
  if (env.skin) return skinPanel(env.skin, ctx, C, x, y, w, h, env.alpha, drip)
  if (style === 'arcade') {
    ctx.fillStyle = C.bg
    ctx.fillRect(x + 5, y + 5, w, h)
    ctx.fillStyle = C.surface
    ctx.globalAlpha = env.alpha
    ctx.fillRect(x, y, w, h)
    ctx.globalAlpha = 1
    ctx.strokeStyle = accent ?? C.line
    ctx.lineWidth = 4
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4)
    return
  }
  ctx.fillStyle = C.surface
  ctx.globalAlpha = env.alpha
  ctx.fillRect(x, y, w, h)
  ctx.globalAlpha = 1
  ctx.strokeStyle = C.line
  ctx.lineWidth = style === 'elegant' ? 1 : 2
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
  if (style === 'elegant') brackets(ctx, x + 1, y + 1, w - 2, h - 2, C.accent)
}

function brackets(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, len = 14) {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * len, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * len)
    ctx.stroke()
  }
}

function ornament(env: Env, cx: number, y: number, halfW: number) {
  const { ctx, C } = env
  const line = (x0: number, x1: number, fade: 'in' | 'out') => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0)
    g.addColorStop(0, C.accent + (fade === 'in' ? '00' : 'ff'))
    g.addColorStop(1, C.accent + (fade === 'in' ? 'ff' : '00'))
    ctx.fillStyle = g
    ctx.fillRect(Math.min(x0, x1), y, Math.abs(x1 - x0), 1)
  }
  line(cx - halfW, cx - 14, 'in')
  line(cx + 14, cx + halfW, 'out')
  polygon(ctx, [[cx, y - 6], [cx + 6, y + 0.5], [cx, y + 7], [cx - 6, y + 0.5]], C.accent)
}

/** Color de cada lado: el primer equipo con el acento y el segundo con su color */
const sideColor = (env: Env, home: boolean) => (home ? env.C.accent : env.C.away)

// ───────────────────────── Fondo, cabecera y pie ─────────────────────────

function background(env: Env, H: number, photo: HTMLImageElement | null, dim: number) {
  const { ctx, C, style } = env
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  if (photo && photo.naturalWidth > 0) {
    // La foto cubre toda la imagen (recortada, sin deformar) y una capa del color de fondo hace que el texto se lea siempre
    const { sx, sy, sw, sh } = coverRect(photo.naturalWidth, photo.naturalHeight, W, H)
    ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, W, H)
    ctx.globalAlpha = Math.max(dim, MIN_TABLE_DIM)
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }
  if (style === 'elegant') {
    const g = ctx.createRadialGradient(W / 2, H * 0.12, 40, W / 2, H * 0.12, H * 0.9)
    g.addColorStop(0, C.accent + '30')
    g.addColorStop(1, C.accent + '00')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  if (env.skin) skinBackground(env.skin, ctx, C, W, H)
  if (style === 'arcade') {
    // Cuadrícula en perspectiva abajo, como el suelo de una recreativa
    ctx.strokeStyle = C.accent
    ctx.globalAlpha = 0.1
    ctx.lineWidth = 1
    for (let x = -W; x <= 2 * W; x += 60) {
      ctx.beginPath()
      ctx.moveTo(W / 2 + (x - W / 2) * 0.25, H - 220)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
    for (let i = 0; i < 6; i++) {
      const y = H - 220 + (i * i * 220) / 25
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

function hazard(env: Env, y: number, h: number, stripes: boolean) {
  const { ctx, C } = env
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, y, W, h)
  ctx.clip()
  ctx.fillStyle = stripes ? C.bg : C.accent
  ctx.fillRect(0, y, W, h)
  ctx.fillStyle = C.accent
  for (let x = stripes ? -h : W + h; x < W + h; x += 28) {
    ctx.beginPath()
    ctx.moveTo(x, y + h)
    ctx.lineTo(x + h, y)
    ctx.lineTo(x + h + 14, y)
    ctx.lineTo(x + 14, y + h)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

type Header = { height: number }
const headerHeight = (style: PresetStyle, skin: Skin | null = null): number => ({ standard: 14 + 64, elegant: 30 + 124, versus: 96, arcade: 88, ice: 78, magma: 78 })[style] + (skin ? 12 : 0)

function header(env: Env, data: TableData, design: WarDesign, wordWar: string): Header {
  const { ctx, C, style, display } = env
  const title = (data.title || wordWar).toUpperCase()
  if (style === 'standard') {
    // Con textura, los carámbanos o la lava de la barra cuelgan sobre la cabecera: el texto baja un poco
    const dy = env.skin ? 12 : 0
    if (env.skin) skinBar(env.skin, ctx, C, W, 14)
    else hazard(env, 0, 14, design.stripes)
    text(env, 'MKW HUB', PAD, 14 + 42 + dy, `900 30px ${display}`, C.accent)
    ctx.font = `900 30px ${display}`
    const brandW = ctx.measureText('MKW HUB').width
    slant(ctx, PAD + brandW + 14, 14 + 20 + dy, 12, 28, 7, C.accent)
    fitted(env, title, PAD + brandW + 44, 14 + 43 + dy, W - PAD * 2 - brandW - 44, 900, 30, display, C.ink, 'left', 18)
  } else if (style === 'elegant') {
    spaced(env, 'MKW HUB', PAD + 14, 30 + 36, `600 13px ${SANS}`, C.muted, 5)
    let size = 48
    ctx.font = `700 ${size}px ${display}`
    while (size > 24 && [...title].length * size * 0.78 > 760) size -= 2
    spaced(env, title, W / 2, 30 + 92, `700 ${size}px ${display}`, mixColors(C.accent, '#ffffff', 0.25), 9, 'center')
    ornament(env, W / 2, 30 + 112, 330)
  } else if (style === 'versus') {
    // Título centrado entre dos filetes de color
    ctx.fillStyle = C.accent
    ctx.fillRect(0, 0, W / 2, 8)
    ctx.fillStyle = C.away
    ctx.fillRect(W / 2, 0, W / 2, 8)
    spaced(env, 'MKW HUB', PAD, 46, `800 18px ${display}`, C.muted, 6)
    fitted(env, title, W / 2, 68, 760, 900, 54, display, C.ink, 'center', 26)
  } else {
    // Arcade: marcador de pantalla con el título entre dos barras
    ctx.fillStyle = C.accent
    ctx.fillRect(0, 0, W, 6)
    text(env, 'MKW HUB', PAD, 44, `700 20px ${MONO}`, C.accent)
    fitted(env, title, W / 2, 62, 760, 900, 52, display, C.ink, 'center', 26)
  }
  return { height: headerHeight(style, env.skin) }
}

function footer(env: Env, y: number) {
  const { ctx, C, style, display } = env
  if (style === 'elegant') {
    ornament(env, W / 2, y + 8, 440)
    spaced(env, 'MKW-HUB.VERCEL.APP', W / 2, y + 44, `600 12px ${SANS}`, C.accent, 5, 'center')
  } else if (style === 'versus') {
    spaced(env, 'MKW-HUB.VERCEL.APP/TABLAS', W / 2, y + 30, `700 15px ${display}`, C.muted, 5, 'center')
  } else if (style === 'arcade') {
    text(env, 'INSERT COIN', PAD, y + 30, `700 16px ${MONO}`, C.accent)
    text(env, 'mkw-hub.vercel.app/tablas', W - PAD, y + 30, `700 14px ${MONO}`, C.muted, 'right')
  } else {
    ctx.fillStyle = C.line
    ctx.fillRect(PAD, y, W - PAD * 2, 2)
    ctx.fillStyle = C.bg
    ctx.fillRect(PAD, y + 18, 64, 16)
    ctx.fillStyle = C.ink
    for (let row = 0; row < 2; row++) for (let col = 0; col < 8; col++) if ((row + col) % 2 === 0) ctx.fillRect(PAD + col * 8, y + 18 + row * 8, 8, 8)
    text(env, 'mkw-hub.vercel.app/tablas', W - PAD, y + 32, `700 14px ${MONO}`, C.ink, 'right')
  }
}
const footerHeight = (style: PresetStyle): number => ({ standard: 56, elegant: 76, versus: 50, arcade: 50, ice: 56, magma: 56 })[style]

// ───────────────────────── Equipos y marcador ─────────────────────────

function teamHeads(env: Env, data: TableData, y: number) {
  const { ctx, C, style, display } = env
  const diff = Math.abs(data.diff)

  if (style === 'versus') {
    // Dos mitades de color partidas por una diagonal, con el VS en medio
    const cut = 46
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, y, W, TEAM_H)
    ctx.clip()
    polygon(ctx, [[0, y], [W / 2 + cut, y], [W / 2 - cut, y + TEAM_H], [0, y + TEAM_H]], mixColors(C.bg, C.accent, 0.34))
    polygon(ctx, [[W / 2 + cut, y], [W, y], [W, y + TEAM_H], [W / 2 - cut, y + TEAM_H]], mixColors(C.bg, C.away, 0.34))
    polygon(ctx, [[W / 2 + cut - 10, y], [W / 2 + cut + 4, y], [W / 2 - cut + 4, y + TEAM_H], [W / 2 - cut - 10, y + TEAM_H]], C.ink)
    ctx.restore()
    const side = (team: TableTeam, home: boolean) => {
      const color = home ? C.accent : C.away
      const x = home ? PAD + 6 : W - PAD - 6
      const align = home ? 'left' : 'right'
      const maxW = W / 2 - cut - PAD - 190
      fitted(env, team.tag, x, y + 82, maxW, 900, 84, display, C.ink, align, 40)
      if (team.name) fitted(env, team.name, x, y + 116, maxW, 600, 22, SANS, mixColors(color, C.ink, 0.45), align)
      text(env, String(team.total), home ? W / 2 - cut - 36 : W / 2 + cut + 36, y + 120, `900 112px ${display}`, color, home ? 'right' : 'left')
    }
    side(data.home, true)
    side(data.away, false)
    slant(ctx, W / 2 - 52, y + TEAM_H / 2 - 30, 104, 60, 10, C.ink)
    text(env, 'VS', W / 2, y + TEAM_H / 2 + 14, `900 44px ${display}`, readable(C.ink), 'center')
    // Diferencia debajo del VS, sin signo
    fitted(env, `±${diff}`, W / 2, y + TEAM_H - 20, 120, 900, 30, display, C.ink, 'center', 18)
    return
  }

  const teamBox = (team: TableTeam, home: boolean) => {
    const x = home ? PAD : PAD + COL_W + GAP
    const color = sideColor(env, home)
    panel(env, x, y, COL_W, TEAM_H, style === 'arcade' ? color : undefined, 34)
    if (style === 'standard') {
      ctx.fillStyle = color
      ctx.fillRect(home ? x : x + COL_W - 8, y, 8, TEAM_H)
    }
    const gold = style === 'elegant' ? mixColors(color, '#ffffff', 0.2) : color
    const align = home ? 'left' : 'right'
    const edge = home ? x + 30 : x + COL_W - 30
    // El total queda lejos del centro para dejar sitio a la placa de la diferencia
    const totalW = 200
    const nameW = COL_W - 30 - 84 - totalW - 20
    if (style === 'arcade') text(env, home ? 'TEAM 1' : 'TEAM 2', edge, y + 30, `700 14px ${MONO}`, color, align)
    fitted(env, team.tag, edge, y + (team.name ? 104 : 116), nameW, 900, style === 'elegant' ? 64 : 76, display, gold, align, 34)
    if (team.name) fitted(env, team.name, edge, y + 140, nameW, 600, 22, SANS, C.muted, align)
    const total = style === 'arcade' && team.total >= 0 ? String(team.total).padStart(4, '0') : String(team.total)
    const totalPaint = env.skin === 'magma' ? moltenPaint(ctx, C) : style === 'standard' || style === 'arcade' ? color : gold
    ctx.save()
    if (env.skin === 'magma') {
      ctx.shadowColor = C.red
      ctx.shadowBlur = 9
    }
    fitted(env, total, home ? x + COL_W - 84 : x + 84, y + 118, totalW, style === 'arcade' ? 700 : 900, style === 'arcade' ? 78 : 112, style === 'arcade' ? MONO : display, totalPaint, home ? 'right' : 'left', 40)
    ctx.restore()
  }
  teamBox(data.home, true)
  teamBox(data.away, false)

  // Diferencia en medio, sin signo (como en Lorenzi): ±80
  const label = `±${diff}`
  const bw = 128
  const bh = 68
  const by = y + (TEAM_H - bh) / 2
  if (style === 'elegant') {
    const r = 56
    const cx = W / 2
    const cy = y + TEAM_H / 2
    polygon(ctx, [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]], C.bg)
    ctx.strokeStyle = C.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx + r, cy)
    ctx.lineTo(cx, cy + r)
    ctx.lineTo(cx - r, cy)
    ctx.closePath()
    ctx.stroke()
    fitted(env, label, cx, cy + 14, 74, 700, 40, display, C.ink, 'center', 20)
  } else if (style === 'arcade') {
    ctx.fillStyle = C.accent
    ctx.fillRect(W / 2 - bw / 2, by, bw, bh)
    fitted(env, label, W / 2, by + 46, bw - 16, 700, 38, MONO, readable(C.accent), 'center', 20)
  } else {
    slant(ctx, W / 2 - bw / 2, by, bw, bh, 12, C.surface2)
    fitted(env, label, W / 2, y + TEAM_H / 2 + 20, bw - 24, 900, 54, display, C.ink, 'center', 28)
  }
}

// ───────────────────────── Jugadores ─────────────────────────

function playersTable(env: Env, data: TableData, team: TableTeam, home: boolean, x: number, y: number, rows: number, labels: { player: string; points: string; place?: (n: number) => string }) {
  const { ctx, C, style, display, light } = env
  const color = sideColor(env, home)
  const h = HEAD_H + rows * ROW_H + 6
  panel(env, x, y, COL_W, h, style === 'arcade' ? color : undefined)

  // Cabecera de la tabla: tag del equipo y títulos de columna
  // (en el hielo la cabecera no lleva banda: taparía los carámbanos)
  if (env.skin !== 'ice') {
    ctx.fillStyle = C.bg
    ctx.globalAlpha = env.alpha
    ctx.fillRect(x + 3, y + 3, COL_W - 6, HEAD_H - 3)
    ctx.globalAlpha = 1
  }
  if (style === 'versus') {
    ctx.fillStyle = color
    ctx.fillRect(x + 3, y + 3, 6, HEAD_H - 3)
  }
  const head = `800 15px ${display}`
  const headY = y + 25
  text(env, team.tag, x + 22, headY, `900 18px ${display}`, color)
  ctx.font = `900 18px ${display}`
  const tagW = ctx.measureText(team.tag).width
  text(env, ` · ${labels.player.toUpperCase()}`, x + 22 + tagW, headY, head, C.muted)
  text(env, labels.points.toUpperCase(), x + COL_W - 22, headY, head, style === 'standard' ? C.muted : C.accent, 'right')

  team.players.forEach((p, i) => {
    const ry = y + HEAD_H + i * ROW_H
    if (style === 'elegant') {
      ctx.fillStyle = C.line
      ctx.fillRect(x + 20, ry, COL_W - 40, 1)
    } else if (style === 'versus') {
      ctx.fillStyle = mixColors(C.surface2, color, 0.12)
      ctx.globalAlpha = i % 2 ? 0.55 : 0.9
      ctx.fillRect(x + 9, ry + 3, COL_W - 18, ROW_H - 6)
      ctx.globalAlpha = 1
      ctx.fillStyle = color
      ctx.fillRect(x + 9, ry + 3, 4, ROW_H - 6)
    } else if (style === 'arcade') {
      if (i > 0) {
        ctx.fillStyle = C.line
        for (let dx = 14; dx < COL_W - 14; dx += 10) ctx.fillRect(x + dx, ry, 5, 2)
      }
    } else if (i % 2 === 1) {
      ctx.fillStyle = C.surface2
      ctx.globalAlpha = 0.45
      ctx.fillRect(x + 2, ry, COL_W - 4, ROW_H)
      ctx.globalAlpha = 1
    }
    const base = ry + ROW_H / 2 + 8
    const medal = medalOf(p.points, data)
    const medalPaint = medal === null ? null : medalColor(medal, light)
    // Puesto en la sala a la derecha del nombre, en una columna fija junto a los puntos
    const place = labels.place ? placeOf(p.points, data) : null
    fitted(env, p.name, x + 24, base, COL_W - 24 - (place === null ? 130 : 190), 600, 22, SANS, medalPaint ?? C.ink, 'left', 16)
    if (place !== null) text(env, labels.place!(place), x + COL_W - 118, base, `700 19px ${display}`, medalPaint ?? C.muted, 'right')
    text(env, String(p.points), x + COL_W - 22, base + 2, style === 'arcade' ? `700 26px ${MONO}` : `800 30px ${display}`, p.points < 0 ? C.red : (medalPaint ?? C.ink), 'right')
  })

  if (team.players.length === 0) {
    text(env, '—', x + COL_W / 2, y + HEAD_H + (rows * ROW_H) / 2 + 8, `500 20px ${SANS}`, C.muted, 'center')
  }
}

// ───────────────────────── Imagen completa ─────────────────────────

export type TableLabels = { player: string; points: string; war: string; /** Cómo se escribe el puesto en la sala (1º, 1st…); sin él no se enseña */ place?: (n: number) => string }

function drawTable(data: TableData, design: WarDesign, photo: HTMLImageElement | null, labels: TableLabels): HTMLCanvasElement {
  const C = resolvePalette(design)
  const visual = PRESET_STYLE[design.preset]
  // Hielo y magma se trazan como el estándar y llevan encima su textura
  const skin: Skin | null = visual === 'ice' ? 'ice' : visual === 'magma' ? 'magma' : null
  const style: PresetStyle = skin ? 'standard' : visual
  const display = style === 'elegant' ? DISPLAY_SERIF : DISPLAY_SANS
  const rows = Math.max(1, data.home.players.length, data.away.players.length)
  const tableH = HEAD_H + rows * ROW_H + 6
  const top = headerHeight(style, skin)
  const H = top + (style === 'versus' ? 0 : 24) + TEAM_H + 24 + tableH + 36 + footerHeight(style) + 16

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')
  ctx.scale(SCALE, SCALE)

  const env: Env = { ctx, C, style, skin, display, alpha: photo ? PANEL_ALPHA_PHOTO : 1, light: luminance(C.bg) > 0.5 }
  background(env, H, photo, design.photo?.dim ?? 0.55)
  // Con foto, el texto suelto (cabecera y pie) va sobre una banda del color de fondo para que se lea con cualquier imagen
  const scrim = (y0: number, y1: number) => {
    if (!photo) return
    ctx.globalAlpha = 0.78
    ctx.fillStyle = C.bg
    ctx.fillRect(0, y0, W, y1 - y0)
    ctx.globalAlpha = 1
  }
  scrim(0, top)
  // Sobre la lava el texto suelto se pierde: una sombra de roca detrás de la cabecera y del pie
  const rockShade = (y0: number, y1: number, fromTop: boolean) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1)
    g.addColorStop(0, fromTop ? 'rgba(8,3,2,0.7)' : 'rgba(8,3,2,0)')
    g.addColorStop(1, fromTop ? 'rgba(8,3,2,0)' : 'rgba(8,3,2,0.7)')
    ctx.fillStyle = g
    ctx.fillRect(0, y0, W, y1 - y0)
  }
  if (skin === 'magma') rockShade(0, top + 10, true)
  header(env, data, design, labels.war)

  let y = top + (style === 'versus' ? 0 : 24)
  teamHeads(env, data, y)
  y += TEAM_H + 24
  playersTable(env, data, data.home, true, PAD, y, rows, labels)
  playersTable(env, data, data.away, false, PAD + COL_W + GAP, y, rows, labels)
  y += tableH + 36
  scrim(y - 14, H)
  if (skin === 'magma') rockShade(y - 24, H, false)
  footer(env, y)

  if (skin) skinGrain(ctx, W, H)
  if (style === 'elegant') {
    ctx.strokeStyle = mixColors(C.accent, '#ffffff', 0.2)
    ctx.lineWidth = 2
    ctx.strokeRect(14, 14, W - 28, H - 28)
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = C.accent
    ctx.lineWidth = 1
    ctx.strokeRect(22.5, 22.5, W - 45, H - 45)
    ctx.globalAlpha = 1
    for (const [cx, cy] of [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]] as const) polygon(ctx, [[cx, cy - 6], [cx + 6, cy], [cx, cy + 6], [cx - 6, cy]], C.accent)
  } else if (style === 'arcade') {
    // Líneas de barrido por encima de todo y marco de pantalla
    ctx.fillStyle = '#000000'
    ctx.globalAlpha = 0.14
    for (let sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1.5)
    ctx.globalAlpha = 1
    ctx.strokeStyle = C.accent
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, W - 6, H - 6)
  }
  return canvas
}

/** Dibuja la tabla y la exporta a PNG: espera a las fuentes y carga la foto de fondo si hay */
export async function renderTableImage(data: TableData, design: WarDesign, labels: TableLabels): Promise<Blob> {
  const sample = [data.title, data.home.tag, data.home.name, data.away.tag, data.away.name, ...data.home.players.map((p) => p.name), ...data.away.players.map((p) => p.name), labels.player, labels.points, labels.war, ...Array.from({ length: 24 }, (_, i) => labels.place?.(i + 1) ?? ''), '0123456789±+-–·…—'].join('')
  const [photo] = await Promise.all([loadPhoto(design.photo?.dataUrl), waitForFonts(sample, PRESET_STYLE[design.preset] === 'elegant')])
  return canvasToPng(drawTable(data, design, photo, labels))
}

/** Nombre de archivo seguro: tabla-NB-vs-RKL.png */
export function tableFileName(data: TableData): string {
  const clean = (s: string) => s.normalize('NFKD').replace(/[^\w-]+/g, '').slice(0, 20) || 'team'
  return `tabla-${clean(data.home.tag)}-vs-${clean(data.away.tag)}.png`
}
