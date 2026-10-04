import { supabase } from './supabase'
import { fitText, signed, type WarImageData, type WarImagePlayer, type WarImageTeam } from './warImage'

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
  runningDiff: string
  noOpponents: string
  footer: string
}

/** Logos ya cargados (null si no hay o no se pudieron cargar) */
export type WarImageLogos = { home: HTMLImageElement | null; away: HTMLImageElement | null }

const C = {
  bg: '#141414',
  surface: '#1c1c1b',
  surface2: '#292927',
  line: '#3b3b38',
  ink: '#f4f2ec',
  muted: '#a5a29a',
  yellow: '#ffd500',
  red: '#e8112d',
  green: '#19c15a',
}

const DISPLAY = '"Big Shoulders Display", Barlow, sans-serif'
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
export async function waitForFonts(sample: string): Promise<void> {
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
    const [home, away] = await Promise.all([loadLogo(urlOf(teamId)), loadLogo(urlOf(opponentTeamId))])
    return { home, away }
  } catch {
    return { home: null, away: null }
  }
}

type Ctx = CanvasRenderingContext2D

function text(ctx: Ctx, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left') {
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
  color: string,
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
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x + cut, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w - cut, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()
}

/** Banda de peligro amarilla y negra (.hazard) */
function hazard(ctx: Ctx, y: number, h: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, y, W, h)
  ctx.clip()
  ctx.fillStyle = C.bg
  ctx.fillRect(0, y, W, h)
  ctx.fillStyle = C.yellow
  for (let x = -h; x < W + h; x += 28) {
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
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = C.line
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
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
  const accent = home ? C.yellow : C.ink
  panel(ctx, x, y, COL_W, h)
  // Franja de color del lado exterior
  ctx.fillStyle = home ? C.yellow : C.muted
  ctx.fillRect(home ? x : x + COL_W - 8, y, 8, h)

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
  text(ctx, String(team.total), totalX, y + h / 2 + 40, ctx.font, C.ink, home ? 'right' : 'left')

  const nameX = home ? logoX + logoSize + logoGap : logoX - logoGap
  const nameMax = COL_W - 28 - logoSize - logoGap - 84 - totalW - 20
  const align = home ? 'left' : 'right'
  // Sin nombre, el tag baja para quedar centrado
  fittedText(ctx, team.tag, nameX, y + h / 2 + (team.name ? 8 : 22), nameMax, 900, 60, DISPLAY, accent, align, 32)
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
) {
  const accent = home ? C.yellow : C.ink
  const headH = 34
  panel(ctx, x, y, COL_W, headH + rows * ROW_H + 4)
  ctx.fillStyle = C.bg
  ctx.fillRect(x + 2, y + 2, COL_W - 4, headH - 2)

  const colPts = x + COL_W - 20
  const colAvg = x + COL_W - 110
  const head = `800 15px ${DISPLAY}`
  // Los tags se dejan tal cual (en mayúsculas, ηβ se leería "HB")
  text(ctx, team.tag, x + 20, y + 23, `900 17px ${DISPLAY}`, accent)
  const tagW = ctx.measureText(team.tag).width
  text(ctx, ` · ${labels.player.toUpperCase()}`, x + 20 + tagW, y + 23, head, C.muted)
  text(ctx, labels.avgPos.toUpperCase(), colAvg, y + 23, head, C.muted, 'right')
  text(ctx, labels.points.toUpperCase(), colPts, y + 23, head, C.muted, 'right')

  const list: (WarImagePlayer | 'missing')[] = [...team.players]
  if (team.missingPoints > 0) list.push('missing')

  if (list.length === 0) {
    text(ctx, labels.noOpponents, x + COL_W / 2, y + headH + (rows * ROW_H) / 2 + 6, `500 16px ${SANS}`, C.muted, 'center')
    return
  }

  list.forEach((p, i) => {
    const ry = y + headH + i * ROW_H
    if (i % 2 === 1) {
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
    text(ctx, String(i + 1).padStart(2, '0'), x + 20, base - 1, `500 13px ${MONO}`, C.muted)
    // Si no corrió todas, se indica cuántas carreras hizo
    const partial = p.races < totalRaces ? ` (${p.races})` : ''
    ctx.font = `500 14px ${MONO}`
    const partialW = partial ? ctx.measureText(partial).width : 0
    ctx.font = `600 20px ${SANS}`
    const name = fitText(p.name, colAvg - 70 - (x + 52) - partialW, (t) => ctx.measureText(t).width)
    text(ctx, name, x + 52, base, ctx.font, i === 0 ? accent : C.ink)
    if (partial) text(ctx, partial, x + 52 + ctx.measureText(name).width, base - 1, `500 14px ${MONO}`, C.muted)
    text(ctx, fmtAvg(p.avgPos), colAvg, base - 1, `700 15px ${MONO}`, C.muted, 'right')
    text(ctx, String(p.points), colPts, base + 1, `800 26px ${DISPLAY}`, C.ink, 'right')
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

  slant(ctx, PAD, y, 12, 26, 0, C.yellow)
  text(ctx, labels.runningDiff.toUpperCase(), PAD + 22, y + 22, `900 24px ${DISPLAY}`, C.ink)

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
    slant(ctx, cx - pw / 2, labelsY + 18, pw, 24, 5, r.color)
    text(ctx, abbr, cx, labelsY + 36, ctx.font, C.bg, 'center')
    // Resultado de esa carrera
    text(ctx, signed(r.diff), cx, labelsY + 62, `700 14px ${MONO}`, diffColor(r.diff), 'center')
  }
  return labelsY + 72 - y
}

/** Dibuja la imagen completa en un canvas nuevo (a 2x) */
export function drawWarImage(data: WarImageData, labels: WarImageLabels, logos: WarImageLogos): HTMLCanvasElement {
  const rows = Math.max(1, data.home.players.length + (data.home.missingPoints > 0 ? 1 : 0), data.away.players.length)
  const hazardH = 14
  const headerH = 64
  const teamH = 160
  const tableH = 34 + rows * ROW_H + 4
  const chartH = 40 + 220 + 14 + 72
  const footerH = 56
  const H = hazardH + headerH + teamH + 24 + tableH + 36 + chartH + 24 + footerH

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')
  ctx.scale(SCALE, SCALE)

  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  hazard(ctx, 0, hazardH)

  // Cabecera: marca, estado y fecha
  let y = hazardH
  text(ctx, 'MKW HUB', PAD, y + 42, `900 30px ${DISPLAY}`, C.yellow)
  ctx.font = `900 30px ${DISPLAY}`
  const brandW = ctx.measureText('MKW HUB').width
  slant(ctx, PAD + brandW + 14, y + 20, 64, 28, 7, C.yellow)
  text(ctx, 'WAR', PAD + brandW + 46, y + 41, `900 20px ${DISPLAY}`, C.bg, 'center')

  text(ctx, labels.date, W - PAD, y + 40, `500 15px ${MONO}`, C.muted, 'right')
  ctx.font = `500 15px ${MONO}`
  const dateW = ctx.measureText(labels.date).width
  ctx.font = `900 20px ${DISPLAY}`
  const statusW = ctx.measureText(labels.status).width + 30
  const statusX = W - PAD - dateW - 18 - statusW
  slant(ctx, statusX, y + 20, statusW, 28, 7, data.inProgress ? C.yellow : C.ink)
  text(ctx, labels.status, statusX + statusW / 2, y + 41, ctx.font, C.bg, 'center')
  y += headerH

  // Equipos y marcador
  teamPanel(ctx, data.home, logos.home, PAD, y, teamH, true)
  teamPanel(ctx, data.away, logos.away, PAD + COL_W + GAP, y, teamH, false)
  // Placa central con la diferencia
  const badgeW = 132
  const badgeH = 72
  slant(ctx, W / 2 - badgeW / 2, y + (teamH - badgeH) / 2, badgeW, badgeH, 12, data.diff === 0 ? C.surface2 : diffColor(data.diff))
  text(ctx, signed(data.diff), W / 2, y + teamH / 2 + 20, `900 54px ${DISPLAY}`, data.diff === 0 ? C.ink : C.bg, 'center')
  y += teamH + 24

  // Puntos por jugador
  const totalRaces = data.races.length
  playersTable(ctx, data.home, PAD, y, rows, totalRaces, labels, true)
  playersTable(ctx, data.away, PAD + COL_W + GAP, y, rows, totalRaces, labels, false)
  y += tableH + 36

  // Gráfico de diferencia acumulada
  y += runningChart(ctx, data, y, labels) + 24

  // Pie: bandera a cuadros y dirección de la web
  ctx.fillStyle = C.line
  ctx.fillRect(PAD, y, W - PAD * 2, 2)
  checker(ctx, PAD, y + 18, 64, 16)
  text(ctx, labels.footer, PAD + 80, y + 32, `500 14px ${MONO}`, C.muted)
  text(ctx, 'mkw-hub.vercel.app', W - PAD, y + 32, `700 14px ${MONO}`, C.ink, 'right')

  return canvas
}

/** Canvas → PNG */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png'),
  )
}

/** Genera el PNG completo: espera a las fuentes, dibuja y exporta */
export async function renderWarImage(data: WarImageData, labels: WarImageLabels, logos: WarImageLogos): Promise<Blob> {
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
  await waitForFonts(sample)
  return canvasToPng(drawWarImage(data, labels, logos))
}
