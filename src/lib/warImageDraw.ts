import { proxiedLogoUrl } from './logoProxy'
import { supabase } from './supabase'
import { coverRect, DEFAULT_DESIGN, luminance, mixColors, PRESET_STYLE, PRESETS, readable, resolvePalette, type Palette, type WarDesign } from './warDesign'
import { fitText, medalRanks, neutralizeWarImage, raceStats, signed, type WarImageData, type WarImagePlayer, type WarImageTeam } from './warImage'

/*
 * Dibujo de la imagen de la war con Canvas 2D, a mano y sin dependencias.
 * Misma estética que la web (src/index.css): asfalto, amarillo kart, sin esquinas redondeadas,
 * Big Shoulders Display para cifras y titulares, Barlow para nombres, JetBrains Mono para datos.
 */

/** Textos ya traducidos que aparecen en la imagen */
export type WarImageLabels = {
  /** "FINAL" o "EN CURSO · 7/12" */
  status: string
  date: string
  player: string
  avgPos: string
  points: string
  missing: string
  /** Nombre por defecto de una penalty sin nombre */
  penalty: string
  runningDiff: string
  /** Nombre de la competición, que el diseño Oficial muestra arriba en lugar de "WAR" (vacío si no hay) */
  competition: string
  /** Modo neutral */
  raceByRace: string
  racesWon: string
  avgRace: string
  tied: string
  noOpponents: string
  footer: string
}

/** Logos ya cargados (null si no hay o no se pudieron cargar) */
export type WarImageLogos = { home: HTMLImageElement | null; away: HTMLImageElement | null }

/** Paleta del diseño con el que se está dibujando (la fija drawWarImage) */
let C: Palette = PRESETS.asphalt
/** Opacidad de los paneles: con foto de fondo se dejan algo transparentes para que se vea */
let PANEL_ALPHA = 1
let STRIPES = true
/** Modo neutral: sin diferencias ni colores de ganar o perder */
let NEUTRAL = false

const DISPLAY_SANS = '"Big Shoulders Display", Barlow, sans-serif'
const DISPLAY_SERIF = '"Bodoni Moda", Didot, Georgia, serif'
/** Tipografía de titulares y cifras del estilo con el que se está dibujando */
let DISPLAY = DISPLAY_SANS
/** Estilo elegante (diseño Oficial): serif, sin placas inclinadas, filetes finos y marco */
let ELEGANT = false
const SANS = 'Barlow, system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'

/** Resolución: 2x para que se vea nítida en Discord y en pantallas de alta densidad */
const SCALE = 2
const W = 1200
const PAD = 32
const GAP = 24
const COL_W = (W - PAD * 2 - GAP) / 2
const ROW_H = 36

const diffColor = (n: number) => (n > 0 ? C.green : n < 0 ? C.red : C.muted)

/** Espera a que estén cargadas las fuentes de la web (si no, el canvas usaría las del sistema) */
export async function waitForFonts(sample: string, serif = false): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const specs = [
    `900 64px ${DISPLAY}`,
    `800 24px ${DISPLAY}`,
    `700 16px ${DISPLAY}`,
    `600 20px ${SANS}`,
    `500 16px ${SANS}`,
    `700 14px ${MONO}`,
    `500 14px ${MONO}`,
  ]
  if (serif) specs.push(`900 64px ${DISPLAY_SERIF}`, `700 26px ${DISPLAY_SERIF}`, `600 20px ${DISPLAY_SERIF}`)
  try {
    // load() con el texto real: las fuentes de Google van troceadas por alfabetos (unicode-range)
    await Promise.all(specs.map((f) => document.fonts.load(f, sample)))
    await document.fonts.ready
  } catch {
    // Si falla, dibujamos con lo que haya
  }
}

// URLs de logos que ya fallaron (normalmente por CORS): no se vuelven a intentar
const failedLogos = new Set<string>()

/**
 * Carga un logo apto para el canvas. Solo sirve si el servidor permite CORS; si no,
 * el canvas quedaría "contaminado" y no se podría exportar, así que devolvemos null
 * y se dibuja la placa con el tag.
 */
export function loadLogo(url: string | null | undefined, timeoutMs = 3000): Promise<HTMLImageElement | null> {
  if (!url || failedLogos.has(url)) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    const fail = () => {
      failedLogos.add(url)
      resolve(null)
    }
    const timer = setTimeout(fail, timeoutMs)
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      fail()
    }
    img.src = url
  })
}

/** Logos de los dos equipos de la war (si están vinculados a equipos de la web) */
export async function loadTeamLogos(teamId: number | null, opponentTeamId: number | null): Promise<WarImageLogos> {
  const ids = [teamId, opponentTeamId].filter((id): id is number => id !== null)
  if (!supabase || ids.length === 0) return { home: null, away: null }
  try {
    const { data, error } = await supabase.from('teams').select('id, logo_url').in('id', ids)
    if (error) throw error
    const urlOf = (id: number | null) => (data ?? []).find((t) => t.id === id)?.logo_url as string | null | undefined
    const logoOf = (id: number | null) => {
      const url = urlOf(id)
      return loadLogo(url ? proxiedLogoUrl(url) : null)
    }
    const [home, away] = await Promise.all([logoOf(teamId), logoOf(opponentTeamId)])
    return { home, away }
  } catch {
    return { home: null, away: null }
  }
}

type Ctx = CanvasRenderingContext2D
/** Color liso o degradado (el oro del diseño Oficial) */
type Paint = string | CanvasGradient

function text(ctx: Ctx, s: string, x: number, y: number, font: string, color: Paint, align: CanvasTextAlign = 'left') {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.fillText(s, x, y)
}

/** Texto que se encoge (hasta `minSize`) y si aun así no cabe, se recorta con "…" */
function fittedText(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  maxWidth: number,
  weight: number,
  size: number,
  family: string,
  color: Paint,
  align: CanvasTextAlign = 'left',
  minSize = size,
) {
  let px = size
  ctx.font = `${weight} ${px}px ${family}`
  while (px > minSize && ctx.measureText(s).width > maxWidth) {
    px -= 2
    ctx.font = `${weight} ${px}px ${family}`
  }
  text(ctx, fitText(s, maxWidth, (t) => ctx.measureText(t).width), x, y, ctx.font, color, align)
}

/** Bloque inclinado tipo placa de kart (clip-path de .plate / .slant) */
function slant(ctx: Ctx, x: number, y: number, w: number, h: number, cut: number, color: string) {
  const c = ELEGANT ? 0 : cut
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x + c, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w - c, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()
}

/** Banda de peligro amarilla y negra (.hazard) */
function hazard(ctx: Ctx, y: number, h: number) {
  // El estilo elegante no lleva franjas: lo enmarca el marco dorado
  if (ELEGANT) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, y, W, h)
  ctx.clip()
  ctx.fillStyle = STRIPES ? C.bg : C.accent
  ctx.fillRect(0, y, W, h)
  ctx.fillStyle = C.accent
  for (let x = STRIPES ? -h : W + h; x < W + h; x += 28) {
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

/** Texto con espacio extra entre letras (versalitas de la cabecera) */
function spaced(ctx: Ctx, s: string, x: number, y: number, font: string, color: Paint, spacing: number, align: CanvasTextAlign = 'left') {
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

/** Ancho que ocupa un texto con espacio extra entre letras */
function spacedWidth(ctx: Ctx, s: string, font: string, spacing: number): number {
  ctx.font = font
  return [...s].reduce((sum, ch) => sum + ctx.measureText(ch).width + spacing, -spacing)
}

/** Metal de un color: degradado vertical claro arriba y oscuro abajo */
function metal(ctx: Ctx, base: string, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, mixColors(base, '#ffffff', 0.55))
  g.addColorStop(0.5, base)
  g.addColorStop(1, mixColors(base, '#000000', 0.42))
  return g
}

/** Oro metálico: el acento hecho metal */
const gold = (ctx: Ctx, y0: number, y1: number) => metal(ctx, C.accent, y0, y1)

/**
 * Plata cromada del estilo elegante: más oscura que el oro y con un reflejo claro en el centro, como un
 * metal pulido (el oro es un degradado suave de claro a oscuro).
 */
function silverMetal(ctx: Ctx, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, '#f2f4f8')
  g.addColorStop(0.32, '#aab0bd')
  g.addColorStop(0.52, '#eef1f6')
  g.addColorStop(0.74, '#868d9b')
  g.addColorStop(1, '#b4bac6')
  return g
}

/** Color del primer equipo: oro metálico en el estilo elegante y, en el resto, el acento */
const homePaint = (ctx: Ctx, y0: number, y1: number): Paint => (ELEGANT ? gold(ctx, y0, y1) : C.accent)

/** Color del segundo equipo: plata en el estilo elegante y, en el resto, el color de la tinta */
const awayPaint = (ctx: Ctx, y0: number, y1: number): Paint => (ELEGANT ? silverMetal(ctx, y0, y1) : C.ink)

/**
 * Color de las tres mejores puntuaciones de la war: oro (el acento), plata y bronce. En el estilo elegante son
 * metales con degradado; en el resto, colores lisos (más oscuros si el fondo es claro, para que se lean).
 */
function medalPaint(ctx: Ctx, rank: number, y0: number, y1: number): Paint | null {
  if (rank > 2) return null
  const light = luminance(C.bg) > 0.5
  if (ELEGANT) {
    return rank === 0 ? gold(ctx, y0, y1) : rank === 1 ? silverMetal(ctx, y0, y1) : metal(ctx, '#c9803f', y0, y1)
  }
  if (rank === 0) return C.accent
  return rank === 1 ? (light ? '#7f8590' : '#b9bfcb') : light ? '#94571f' : '#c47f3b'
}

/** Filete dorado que se desvanece por un extremo (`in`: nace de la nada y llega pleno; `out`: al revés) */
function rule(ctx: Ctx, x0: number, x1: number, y: number, fade: 'in' | 'out') {
  if (x1 - x0 < 4) return
  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  g.addColorStop(0, fade === 'in' ? C.accent + '00' : C.accent)
  g.addColorStop(1, fade === 'in' ? C.accent : C.accent + '00')
  ctx.fillStyle = g
  ctx.fillRect(x0, y, x1 - x0, 1)
}

/** Filete con un rombo en el centro, a cada lado un filete que se desvanece (separador de invitación) */
function ornament(ctx: Ctx, cx: number, y: number, halfW: number) {
  rule(ctx, cx - halfW, cx - 22, y, 'in')
  rule(ctx, cx + 22, cx + halfW, y, 'out')
  diamond(ctx, cx, y + 0.5, 5, C.accent)
  diamond(ctx, cx - 13, y + 0.5, 2.5, C.accent)
  diamond(ctx, cx + 13, y + 0.5, 2.5, C.accent)
}

/** Título de sección: a la izquierda con una barra (estándar) o centrado entre filetes dorados (elegante) */
function sectionTitle(ctx: Ctx, label: string, y: number) {
  if (!ELEGANT) {
    slant(ctx, PAD, y, 12, 26, 0, C.accent)
    text(ctx, label.toUpperCase(), PAD + 22, y + 22, `900 24px ${DISPLAY}`, C.ink)
    return
  }
  const font = `700 19px ${DISPLAY}`
  const title = label.toUpperCase()
  const w = spacedWidth(ctx, title, font, 6)
  spaced(ctx, title, W / 2, y + 22, font, gold(ctx, y + 6, y + 26), 6, 'center')
  rule(ctx, PAD, W / 2 - w / 2 - 22, y + 15, 'in')
  rule(ctx, W / 2 + w / 2 + 22, W - PAD, y + 15, 'out')
}

/** Esquinas en L doradas (marcos de las cartelas del estilo elegante) */
function brackets(ctx: Ctx, x: number, y: number, w: number, h: number, len = 16) {
  ctx.strokeStyle = C.accent
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    ctx.moveTo(cx + dx * len, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * len)
  }
  ctx.stroke()
}

/** Rombo con la cifra dentro, doble filete dorado (sustituye a la placa inclinada en el estilo elegante) */
function diamondBadge(ctx: Ctx, cx: number, cy: number, r: number, label: string, tone: string) {
  const path = (rad: number) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - rad)
    ctx.lineTo(cx + rad, cy)
    ctx.lineTo(cx, cy + rad)
    ctx.lineTo(cx - rad, cy)
    ctx.closePath()
  }
  path(r)
  ctx.fillStyle = C.bg
  ctx.fill()
  ctx.strokeStyle = gold(ctx, cy - r, cy + r)
  ctx.lineWidth = 2
  ctx.stroke()
  path(r - 8)
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = C.accent
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.globalAlpha = 1
  fittedText(ctx, label, cx, cy + 12, r * 1.05, 700, 36, DISPLAY, tone, 'center', 20)
}

/** Rombo pequeño (adorno del pie en el estilo elegante) */
function diamond(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + r, cy)
  ctx.lineTo(cx, cy + r)
  ctx.lineTo(cx - r, cy)
  ctx.closePath()
  ctx.fill()
}

/** Resplandor suave del color de acento arriba, para que el fondo liso no quede plano */
function vignette(ctx: Ctx, H: number) {
  const g = ctx.createRadialGradient(W / 2, H * 0.12, 40, W / 2, H * 0.12, H * 0.9)
  g.addColorStop(0, C.accent + '30')
  g.addColorStop(1, C.accent + '00')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

/** Bandera a cuadros (.checker) */
function checker(ctx: Ctx, x: number, y: number, w: number, h: number, size = 8) {
  ctx.fillStyle = C.bg
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = C.ink
  for (let row = 0; row * size < h; row++) {
    for (let col = 0; col * size < w; col++) {
      if ((row + col) % 2 === 0) ctx.fillRect(x + col * size, y + row * size, size, size)
    }
  }
}

/** Panel plano con borde de 2px (.panel) */
function panel(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = C.surface
  ctx.globalAlpha = PANEL_ALPHA
  ctx.fillRect(x, y, w, h)
  ctx.globalAlpha = 1
  ctx.strokeStyle = C.line
  ctx.lineWidth = ELEGANT ? 1 : 2
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
  if (ELEGANT) brackets(ctx, x + 1, y + 1, w - 2, h - 2)
}

/** Logo del equipo en un cuadro, ajustado sin deformar */
function logo(ctx: Ctx, img: HTMLImageElement, x: number, y: number, size: number) {
  ctx.fillStyle = C.surface2
  ctx.fillRect(x, y, size, size)
  const box = size - 16
  const ratio = Math.min(box / img.naturalWidth, box / img.naturalHeight)
  const w = img.naturalWidth * ratio
  const h = img.naturalHeight * ratio
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h)
  ctx.strokeStyle = C.line
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2)
}

/** Ficha de equipo: logo (si hay), tag, nombre y total. El rival va en espejo, a la derecha */
function teamPanel(ctx: Ctx, team: WarImageTeam, img: HTMLImageElement | null, x: number, y: number, h: number, home: boolean) {
  // Color del equipo: el de la izquierda en acento (oro metálico en el elegante) y el otro en tinta
  const teamPaint: Paint = home ? (ELEGANT ? gold(ctx, y + h / 2 - 52, y + h / 2 + 12) : C.accent) : awayPaint(ctx, y + h / 2 - 52, y + h / 2 + 12)
  panel(ctx, x, y, COL_W, h)
  if (!ELEGANT) {
    // Franja de color del lado exterior
    ctx.fillStyle = home ? C.accent : C.muted
    ctx.fillRect(home ? x : x + COL_W - 8, y, 8, h)
  }

  // Sin logo utilizable (no hay o el servidor no permite CORS) se omite el cuadro
  const hasLogo = !!img && img.naturalWidth > 0
  const logoSize = hasLogo ? 96 : 0
  const logoX = home ? x + 28 : x + COL_W - 28 - logoSize
  if (img && hasLogo) logo(ctx, img, logoX, y + (h - logoSize) / 2, logoSize)
  const logoGap = hasLogo ? 20 : 0

  // El total queda lejos del centro para dejar sitio a la placa de diferencia
  const totalX = home ? x + COL_W - 84 : x + 84
  ctx.font = `900 112px ${DISPLAY}`
  const totalW = ctx.measureText(String(team.total)).width
  // En el modo neutral la puntuación lleva el color de su equipo, para saber de quién es cada una
  const totalPaint: Paint = NEUTRAL ? (ELEGANT ? (home ? gold(ctx, y + h / 2 - 56, y + h / 2 + 44) : awayPaint(ctx, y + h / 2 - 56, y + h / 2 + 44)) : teamPaint) : C.ink
  text(ctx, String(team.total), totalX, y + h / 2 + 40, ctx.font, totalPaint, home ? 'right' : 'left')

  const nameX = home ? logoX + logoSize + logoGap : logoX - logoGap
  const nameMax = COL_W - 28 - logoSize - logoGap - 84 - totalW - 20
  const align = home ? 'left' : 'right'
  // Sin nombre, el tag baja para quedar centrado
  fittedText(ctx, team.tag, nameX, y + h / 2 + (team.name ? 8 : 22), nameMax, 900, 60, DISPLAY, teamPaint, align, 32)
  if (team.name) fittedText(ctx, team.name, nameX, y + h / 2 + 40, nameMax, 600, 20, SANS, C.muted, align)
}

const fmtAvg = (n: number | null) => (n === null ? '–' : n.toFixed(1))

/** Tabla de jugadores de un equipo */
function playersTable(
  ctx: Ctx,
  team: WarImageTeam,
  x: number,
  y: number,
  rows: number,
  totalRaces: number,
  labels: WarImageLabels,
  home: boolean,
  medals: Map<WarImagePlayer, number>,
) {
  const accent: Paint = home ? homePaint(ctx, y + 8, y + 27) : awayPaint(ctx, y + 8, y + 27)
  const headH = 34
  panel(ctx, x, y, COL_W, headH + rows * ROW_H + 4)
  ctx.fillStyle = C.bg
  ctx.globalAlpha = PANEL_ALPHA
  ctx.fillRect(x + 2, y + 2, COL_W - 4, headH - 2)
  ctx.globalAlpha = 1

  const colPts = x + COL_W - 20
  const colAvg = x + COL_W - 110
  const head = `800 15px ${DISPLAY}`
  // Los tags se dejan tal cual (en mayúsculas, ηβ se leería "HB")
  text(ctx, team.tag, x + 20, y + 23, `900 17px ${DISPLAY}`, accent)
  const tagW = ctx.measureText(team.tag).width
  text(ctx, ` · ${labels.player.toUpperCase()}`, x + 20 + tagW, y + 23, head, C.muted)
  text(ctx, labels.avgPos.toUpperCase(), colAvg, y + 23, head, ELEGANT ? C.accent : C.muted, 'right')
  text(ctx, labels.points.toUpperCase(), colPts, y + 23, head, ELEGANT ? C.accent : C.muted, 'right')

  const list: (WarImagePlayer | 'missing' | WarImageTeam['penalties'][number])[] = [...team.players]
  if (team.missingPoints > 0) list.push('missing')
  list.push(...team.penalties)

  if (list.length === 0) {
    text(ctx, labels.noOpponents, x + COL_W / 2, y + headH + (rows * ROW_H) / 2 + 6, `500 16px ${SANS}`, C.muted, 'center')
    return
  }

  list.forEach((p, i) => {
    const ry = y + headH + i * ROW_H
    if (ELEGANT) {
      // Un filete fino entre filas, como en una carta de gala
      ctx.fillStyle = C.line
      ctx.fillRect(x + 18, ry, COL_W - 36, 1)
    } else if (i % 2 === 1) {
      ctx.fillStyle = C.surface2
      ctx.globalAlpha = 0.45
      ctx.fillRect(x + 2, ry, COL_W - 4, ROW_H)
      ctx.globalAlpha = 1
    }
    const base = ry + ROW_H / 2 + 7
    if (p === 'missing') {
      text(ctx, labels.missing, x + 52, base, `500 18px ${SANS}`, C.muted)
      text(ctx, String(team.missingPoints), colPts, base + 1, `800 24px ${DISPLAY}`, C.muted, 'right')
      return
    }
    if ('label' in p) {
      // Penalty: nombre libre y puntos negativos en rojo
      const label = fitText(p.label || labels.penalty, colPts - 70 - (x + 52), (t) => ctx.measureText(t).width)
      text(ctx, label, x + 52, base, `500 18px ${SANS}`, C.muted)
      text(ctx, String(p.points), colPts, base + 1, `800 24px ${DISPLAY}`, C.red, 'right')
      return
    }
    text(ctx, String(i + 1).padStart(2, '0'), x + 20, base - 1, `500 13px ${MONO}`, C.muted)
    // Si no corrió todas, se indica cuántas carreras hizo
    const partial = p.races < totalRaces ? ` (${p.races})` : ''
    ctx.font = `500 14px ${MONO}`
    const partialW = partial ? ctx.measureText(partial).width : 0
    ctx.font = `600 20px ${SANS}`
    const name = fitText(p.name, colAvg - 70 - (x + 52) - partialW, (t) => ctx.measureText(t).width)
    // Oro, plata y bronce para las tres mejores puntuaciones de la war (entre los dos equipos), en el nombre y en los puntos
    const medal = medalPaint(ctx, medals.get(p) ?? 3, base - 22, base + 6)
    text(ctx, name, x + 52, base, ctx.font, medal ?? C.ink)
    if (partial) text(ctx, partial, x + 52 + ctx.measureText(name).width, base - 1, `500 14px ${MONO}`, C.muted)
    text(ctx, fmtAvg(p.avgPos), colAvg, base - 1, `700 15px ${MONO}`, C.muted, 'right')
    text(ctx, String(p.points), colPts, base + 1, `800 26px ${DISPLAY}`, medal ?? C.ink, 'right')
  })
}

/** Gráfico de barras con la diferencia acumulada tras cada carrera y la pista debajo */
function runningChart(ctx: Ctx, data: WarImageData, y: number, labels: WarImageLabels): number {
  const titleH = 40
  const chartH = 220
  const axisW = 52
  const x0 = PAD + axisW
  const x1 = W - PAD
  const slotW = (x1 - x0) / data.slots
  const top = y + titleH
  const { min, max, step } = data.scale
  // Margen arriba y abajo para las cifras de las barras
  const plotTop = top + 28
  const plotH = chartH - 56
  const yOf = (v: number) => plotTop + ((max - v) / (max - min)) * plotH
  const zero = yOf(0)

  sectionTitle(ctx, labels.runningDiff, y)

  // Rejilla y eje
  ctx.lineWidth = 1
  for (let v = min; v <= max; v += step) {
    const gy = Math.round(yOf(v)) + 0.5
    ctx.strokeStyle = v === 0 ? C.muted : C.line
    ctx.setLineDash(v === 0 ? [] : [4, 6])
    ctx.beginPath()
    ctx.moveTo(x0, gy)
    ctx.lineTo(x1, gy)
    ctx.stroke()
    text(ctx, signed(v), x0 - 10, gy + 4, `500 12px ${MONO}`, v === 0 ? C.ink : C.muted, 'right')
  }
  ctx.setLineDash([])

  const byNo = new Map(data.races.map((r) => [r.raceNo, r]))
  const barW = Math.min(56, slotW * 0.62)
  const labelsY = top + chartH + 14

  for (let n = 1; n <= data.slots; n++) {
    const cx = x0 + slotW * (n - 0.5)
    const r = byNo.get(n)
    text(ctx, String(n), cx, labelsY + 10, `500 12px ${MONO}`, r ? C.muted : C.line, 'center')
    if (!r) {
      // Carrera aún sin jugar: hueco punteado
      ctx.strokeStyle = C.line
      ctx.setLineDash([3, 4])
      ctx.strokeRect(cx - barW / 2 + 0.5, zero - 14 + 0.5, barW - 1, 28)
      ctx.setLineDash([])
      continue
    }
    const v = r.runningDiff
    const by = yOf(v)
    ctx.fillStyle = diffColor(v)
    if (v === 0) ctx.fillRect(cx - barW / 2, zero - 2, barW, 4)
    else ctx.fillRect(cx - barW / 2, Math.min(by, zero), barW, Math.abs(by - zero))
    // Valor acumulado encima (o debajo) de la barra
    const vy = v >= 0 ? by - 8 : by + 20
    text(ctx, signed(v), cx, vy, `800 20px ${DISPLAY}`, C.ink, 'center')

    // Placa con la abreviatura de la pista, del color de su copa
    ctx.font = `900 17px ${DISPLAY}`
    const abbr = fitText(r.abbr, slotW - 18, (t) => ctx.measureText(t).width)
    const pw = Math.min(slotW - 6, ctx.measureText(abbr).width + 18)
    trackPlate(ctx, abbr, cx, labelsY + 18, pw, r.color, r.textColor)
    // Resultado de esa carrera
    text(ctx, signed(r.diff), cx, labelsY + 62, `700 14px ${MONO}`, diffColor(r.diff), 'center')
  }
  return labelsY + 72 - y
}

/** Alto del bloque carrera a carrera del modo neutral */
const BOARD_H = 262

/**
 * Modo neutral: en lugar de la diferencia acumulada, el marcador de cada carrera con los puntos de los
 * dos equipos (cada fila con su tag y su color, nada de verde o rojo) y dos cifras que no dependen de qué
 * equipo suba la war: carreras ganadas y puntos medios.
 */
/** Placa con la abreviatura de una pista: fondo y letras de los colores de la pista (esmaltada y con filete en el estilo elegante) */
function trackPlate(ctx: Ctx, abbr: string, cx: number, y: number, w: number, bg: string, fg: string) {
  const h = 24
  if (ELEGANT) {
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, mixColors(bg, '#ffffff', 0.24))
    g.addColorStop(0.55, bg)
    g.addColorStop(1, mixColors(bg, '#000000', 0.22))
    ctx.fillStyle = g
    ctx.fillRect(cx - w / 2, y, w, h)
    ctx.strokeStyle = mixColors(bg, '#000000', 0.5)
    ctx.lineWidth = 1
    ctx.strokeRect(cx - w / 2 + 0.5, y + 0.5, w - 1, h - 1)
  } else {
    slant(ctx, cx - w / 2, y, w, h, 5, bg)
  }
  text(ctx, abbr, cx, y + 18, `900 17px ${DISPLAY}`, fg, 'center')
}

/** Texto hecho de tramos de distinto color (cada equipo con el suyo), encogido hasta que quepa */
function coloredRuns(
  ctx: Ctx,
  parts: { text: string; color: Paint }[],
  x: number,
  y: number,
  maxWidth: number,
  weight: number,
  size: number,
  family: string,
  minSize: number,
) {
  const widthAt = (px: number) => {
    ctx.font = `${weight} ${px}px ${family}`
    return parts.reduce((sum, p) => sum + ctx.measureText(p.text).width, 0)
  }
  let px = size
  while (px > minSize && widthAt(px) > maxWidth) px -= 2
  ctx.font = `${weight} ${px}px ${family}`
  ctx.textAlign = 'left'
  let cx = x
  for (const p of parts) {
    ctx.fillStyle = p.color
    ctx.fillText(p.text, cx, y)
    cx += ctx.measureText(p.text).width
  }
}

function raceBoard(ctx: Ctx, data: WarImageData, y: number, labels: WarImageLabels): number {
  const stats = raceStats(data)
  sectionTitle(ctx, labels.raceByRace, y)

  // Cada fila de cifras lleva el tag de su equipo en su color, para saber de quién es cada número
  const labelW = 70
  const x0 = PAD + labelW
  const slotW = (W - PAD - x0) / data.slots
  const byNo = new Map(data.races.map((r) => [r.raceNo, r]))
  const top = y + 44
  fittedText(ctx, data.home.tag, PAD, top + 76, labelW - 10, 800, 22, DISPLAY, homePaint(ctx, top + 56, top + 80), 'left', 13)
  fittedText(ctx, data.away.tag, PAD, top + 106, labelW - 10, 800, 22, DISPLAY, awayPaint(ctx, top + 86, top + 110), 'left', 13)
  for (let n = 1; n <= data.slots; n++) {
    const cx = x0 + slotW * (n - 0.5)
    const r = byNo.get(n)
    text(ctx, String(n), cx, top + 10, `500 12px ${MONO}`, r ? C.muted : C.line, 'center')
    if (!r) {
      // Carrera aún sin jugar: hueco punteado
      ctx.strokeStyle = C.line
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.strokeRect(cx - slotW / 2 + 8.5, top + 20.5, slotW - 17, 100)
      ctx.setLineDash([])
      continue
    }
    ctx.font = `900 17px ${DISPLAY}`
    const abbr = fitText(r.abbr, slotW - 18, (t) => ctx.measureText(t).width)
    const pw = Math.min(slotW - 6, ctx.measureText(abbr).width + 18)
    trackPlate(ctx, abbr, cx, top + 18, pw, r.color, r.textColor)
    text(ctx, String(r.home), cx, top + 76, `800 26px ${DISPLAY}`, homePaint(ctx, top + 54, top + 80), 'center')
    text(ctx, String(r.away), cx, top + 106, `800 26px ${DISPLAY}`, awayPaint(ctx, top + 84, top + 110), 'center')
    // Reparto de los puntos de la carrera entre los dos equipos
    const bw = slotW - 18
    const bx = cx - bw / 2
    const total = r.home + r.away
    const aw = total > 0 ? (r.home / total) * bw : bw / 2
    ctx.fillStyle = homePaint(ctx, top + 118, top + 125)
    ctx.fillRect(bx, top + 118, aw, 7)
    ctx.fillStyle = awayPaint(ctx, top + 118, top + 125)
    ctx.fillRect(bx + aw, top + 118, bw - aw, 7)
  }

  // Dos cifras neutrales para que el bloque no quede vacío
  const tileW = (W - PAD * 2 - GAP) / 2
  const tileY = top + 150
  // Estadísticas de abajo: cada equipo con su metal en el estilo elegante
  const a = homePaint(ctx, tileY + 30, tileY + 58)
  const b = awayPaint(ctx, tileY + 30, tileY + 58)
  const dash = { text: ' – ', color: C.muted }
  const tiles: [string, { text: string; color: Paint }[]][] = [
    [
      labels.racesWon,
      [
        { text: `${data.home.tag} ${stats.winsHome}`, color: a },
        dash,
        { text: `${stats.winsAway} ${data.away.tag}`, color: b },
        ...(stats.ties ? [{ text: `  ·  ${stats.ties} ${labels.tied}`, color: C.muted }] : []),
      ],
    ],
    [
      labels.avgRace,
      data.races.length
        ? [
            { text: `${data.home.tag} ${stats.avgHome.toFixed(1)}`, color: a },
            dash,
            { text: `${stats.avgAway.toFixed(1)} ${data.away.tag}`, color: b },
          ]
        : [{ text: '–', color: C.ink }],
    ],
  ]
  tiles.forEach(([label, parts], i) => {
    const tx = PAD + i * (tileW + GAP)
    panel(ctx, tx, tileY, tileW, 68)
    text(ctx, label.toUpperCase(), tx + 16, tileY + 24, `500 12px ${MONO}`, C.muted)
    coloredRuns(ctx, parts, tx + 16, tileY + 54, tileW - 32, 800, 28, DISPLAY, 18)
  })
  return BOARD_H
}

/** Dibuja la imagen completa en un canvas nuevo (a 2x) */
export function drawWarImage(
  data: WarImageData,
  labels: WarImageLabels,
  logos: WarImageLogos,
  design: WarDesign = DEFAULT_DESIGN,
  photo: HTMLImageElement | null = null,
): HTMLCanvasElement {
  C = resolvePalette(design)
  ELEGANT = PRESET_STYLE[design.preset] === 'elegant'
  DISPLAY = ELEGANT ? DISPLAY_SERIF : DISPLAY_SANS
  STRIPES = design.stripes
  NEUTRAL = design.neutral
  PANEL_ALPHA = photo ? 0.8 : 1
  try {
    return drawWarCanvas(data, labels, logos, design, photo)
  } finally {
    C = PRESETS.asphalt
    ELEGANT = false
    DISPLAY = DISPLAY_SANS
    STRIPES = true
    NEUTRAL = false
    PANEL_ALPHA = 1
  }
}

function drawWarCanvas(
  data: WarImageData,
  labels: WarImageLabels,
  logos: WarImageLogos,
  design: WarDesign,
  photo: HTMLImageElement | null,
): HTMLCanvasElement {
  const rows = Math.max(
    1,
    data.home.players.length + (data.home.missingPoints > 0 ? 1 : 0) + data.home.penalties.length,
    data.away.players.length + data.away.penalties.length,
  )
  const hazardH = ELEGANT ? 30 : 14
  const headerH = ELEGANT ? 160 : 64
  const teamH = 160
  const tableH = 34 + rows * ROW_H + 4
  const chartH = NEUTRAL ? BOARD_H : 40 + 220 + 14 + 72
  const footerH = ELEGANT ? 92 : 56
  const H = hazardH + headerH + teamH + 24 + tableH + 36 + chartH + 24 + footerH

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')
  ctx.scale(SCALE, SCALE)

  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  if (photo && photo.naturalWidth > 0) {
    // Foto a toda la imagen (recortada, sin deformar) y una capa del color de fondo para que se lea el texto
    const { sx, sy, sw, sh } = coverRect(photo.naturalWidth, photo.naturalHeight, W, H)
    ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, W, H)
    ctx.globalAlpha = design.photo?.dim ?? 0.55
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }
  if (ELEGANT) vignette(ctx, H)
  hazard(ctx, 0, hazardH)

  // Cabecera: marca, estado y fecha (en el elegante, el título centrado de una invitación)
  let y = hazardH
  if (ELEGANT) {
    // El nombre de la competición, o "WAR" si no hay, en dorado y lo más grande que quepa
    const title = (labels.competition.trim() || 'WAR').toUpperCase()
    spaced(ctx, 'MKW HUB', PAD + 14, y + 38, `600 13px ${SANS}`, C.muted, 5)
    spaced(ctx, labels.date, W - PAD - 14, y + 38, `500 13px ${SANS}`, C.muted, 3, 'right')
    let size = 48
    while (size > 24 && spacedWidth(ctx, title, `700 ${size}px ${DISPLAY}`, 9) > 760) size -= 2
    spaced(ctx, title, W / 2, y + 96, `700 ${size}px ${DISPLAY}`, gold(ctx, y + 96 - size * 0.75, y + 102), 9, 'center')
    ornament(ctx, W / 2, y + 118, 330)
    spaced(ctx, labels.status.toUpperCase(), W / 2, y + 146, `600 13px ${SANS}`, C.accent, 7, 'center')
  } else {
    text(ctx, 'MKW HUB', PAD, y + 42, `900 30px ${DISPLAY}`, C.accent)
    ctx.font = `900 30px ${DISPLAY}`
    const brandW = ctx.measureText('MKW HUB').width
    slant(ctx, PAD + brandW + 14, y + 20, 64, 28, 7, C.accent)
    text(ctx, 'WAR', PAD + brandW + 46, y + 41, `900 20px ${DISPLAY}`, readable(C.accent), 'center')

    text(ctx, labels.date, W - PAD, y + 40, `500 15px ${MONO}`, C.muted, 'right')
    ctx.font = `500 15px ${MONO}`
    const dateW = ctx.measureText(labels.date).width
    ctx.font = `900 20px ${DISPLAY}`
    const statusW = ctx.measureText(labels.status).width + 30
    const statusX = W - PAD - dateW - 18 - statusW
    slant(ctx, statusX, y + 20, statusW, 28, 7, data.inProgress ? C.accent : C.ink)
    text(ctx, labels.status, statusX + statusW / 2, y + 41, ctx.font, readable(data.inProgress ? C.accent : C.ink), 'center')
  }
  y += headerH

  // Equipos y marcador
  teamPanel(ctx, data.home, logos.home, PAD, y, teamH, true)
  teamPanel(ctx, data.away, logos.away, PAD + COL_W + GAP, y, teamH, false)
  // Placa central con la diferencia (en el modo neutral, la distancia sin signo como en Lorenzi: ±80)
  const badgeW = 132
  const badgeH = 72
  if (ELEGANT) {
    const label = NEUTRAL ? `±${Math.abs(data.diff)}` : signed(data.diff)
    const tone = NEUTRAL || data.diff === 0 ? C.ink : diffColor(data.diff)
    diamondBadge(ctx, W / 2, y + teamH / 2, 62, label, tone)
  } else if (NEUTRAL) {
    slant(ctx, W / 2 - badgeW / 2, y + (teamH - badgeH) / 2, badgeW, badgeH, 12, C.surface2)
    fittedText(ctx, `±${Math.abs(data.diff)}`, W / 2, y + teamH / 2 + 20, badgeW - 24, 900, 54, DISPLAY, C.ink, 'center', 28)
  } else {
    slant(ctx, W / 2 - badgeW / 2, y + (teamH - badgeH) / 2, badgeW, badgeH, 12, data.diff === 0 ? C.surface2 : diffColor(data.diff))
    text(ctx, signed(data.diff), W / 2, y + teamH / 2 + 20, `900 54px ${DISPLAY}`, data.diff === 0 ? C.ink : readable(diffColor(data.diff)), 'center')
  }
  y += teamH + 24

  // Puntos por jugador
  const totalRaces = data.races.length
  const medals = medalRanks(data)
  playersTable(ctx, data.home, PAD, y, rows, totalRaces, labels, true, medals)
  playersTable(ctx, data.away, PAD + COL_W + GAP, y, rows, totalRaces, labels, false, medals)
  y += tableH + 36

  // Gráfico de diferencia acumulada
  y += (NEUTRAL ? raceBoard(ctx, data, y, labels) : runningChart(ctx, data, y, labels)) + 24

  // Pie: bandera a cuadros y dirección de la web (en el elegante, un separador y dos líneas centradas)
  if (ELEGANT) {
    ornament(ctx, W / 2, y + 8, 440)
    spaced(ctx, labels.footer.toUpperCase(), W / 2, y + 44, `500 11px ${SANS}`, C.muted, 4, 'center')
    spaced(ctx, 'MKW-HUB.VERCEL.APP', W / 2, y + 66, `600 12px ${SANS}`, C.accent, 5, 'center')
  } else {
    ctx.fillStyle = C.line
    ctx.fillRect(PAD, y, W - PAD * 2, 2)
    checker(ctx, PAD, y + 18, 64, 16)
    text(ctx, labels.footer, PAD + 80, y + 32, `500 14px ${MONO}`, C.muted)
    text(ctx, 'mkw-hub.vercel.app', W - PAD, y + 32, `700 14px ${MONO}`, C.ink, 'right')
  }

  if (ELEGANT) {
    // Doble marco dorado alrededor de toda la imagen, con un rombo en cada esquina
    ctx.strokeStyle = gold(ctx, 0, H)
    ctx.lineWidth = 2
    ctx.strokeRect(14, 14, W - 28, H - 28)
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = C.accent
    ctx.lineWidth = 1
    ctx.strokeRect(22.5, 22.5, W - 45, H - 45)
    ctx.globalAlpha = 1
    for (const [cx, cy] of [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]] as const) diamond(ctx, cx, cy, 6, C.accent)
  }
  return canvas
}

/** Canvas → PNG */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png'),
  )
}

/** Genera el PNG completo: espera a las fuentes, dibuja y exporta */
/** Foto de fondo ya cargada (null si no hay o no se puede leer); es un data URL propio, así que no contamina el canvas */
export function loadPhoto(dataUrl: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!dataUrl) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

export async function renderWarImage(
  data: WarImageData,
  labels: WarImageLabels,
  logos: WarImageLogos,
  design: WarDesign = DEFAULT_DESIGN,
): Promise<Blob> {
  const sample = [
    data.home.tag,
    data.away.tag,
    data.home.name ?? '',
    data.away.name ?? '',
    ...data.home.players.map((p) => p.name),
    ...data.away.players.map((p) => p.name),
    ...Object.values(labels),
    '0123456789+-–·…',
  ].join('')
  const [photo] = await Promise.all([loadPhoto(design.photo?.dataUrl), waitForFonts(sample, PRESET_STYLE[design.preset] === 'elegant')])
  if (design.neutral) {
    // Equipos por orden alfabético, no según quién suba la war (y cada logo con su equipo)
    const n = neutralizeWarImage(data)
    return canvasToPng(drawWarImage(n.data, labels, n.swapped ? { home: logos.away, away: logos.home } : logos, design, photo))
  }
  return canvasToPng(drawWarImage(data, labels, logos, design, photo))
}
