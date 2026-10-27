// Lector de la pantalla de resultados de una war de Mario Kart World (dos columnas de barras de color, una por jugador), en el navegador.
// El texto de las barras es del mismo color que ellas pero más oscuro (solo la fila resaltada va en blanco): se aísla lo que se
// diferencia del fondo de la barra y se lee cada nombre y cada número por separado. Funciones puras en warScreen.ts.
import type { CaptureLine, Rgb } from './captureTable'
import { ALL_LANGS, getWorker, LATIN_LANGS } from './ocrImage'
import { bestCandidate, findBarStack, NAME_ZONE, pickByTag, POINTS_ZONE, runsOf, widestRun, type Bar, type Candidate } from './warScreen'

/** Ancho al que se trabaja con la imagen (las capturas más grandes se reducen para ir rápido) */
const WORK_WIDTH = 1600
/** Zona horizontal de cada columna, como fracción del ancho de la imagen */
const COLUMNS: [number, number][] = [
  [0.08, 0.5],
  [0.5, 0.92],
]
/** Altura de una barra respecto al ancho de la imagen (en la captura de referencia, 44 de 1280) */
const BAR_HEIGHT: [number, number] = [0.02, 0.06]
/** Barras mínimas en una columna para fiarse de que es una pantalla de resultados */
const MIN_BARS = 3
/** Umbrales «más oscuro que el fondo de la barra» probados, de más a menos estricto */
const RATIOS = [0.55, 0.7]

type Worker = Awaited<ReturnType<typeof getWorker>>

/** ¿Es un píxel de color vivo (las barras rojas y azules) y no del fondo borroso? */
const colorful = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b)
  return max >= 100 && (max - Math.min(r, g, b)) / max > 0.45
}

/**
 * Quita de la máscara lo que no es texto: las manchas muy pequeñas (ruido) y las muy altas (los iconos y los bordes de la barra, que
 * ocupan casi toda la altura del recorte; las letras miden poco más de la mitad). Componentes conexos con un relleno por pila.
 */
function dropBlobs(bin: Uint8Array, w: number, h: number): void {
  const seen = new Uint8Array(bin.length)
  const stack: number[] = []
  for (let start = 0; start < bin.length; start++) {
    if (!bin[start] || seen[start]) continue
    const cells: number[] = []
    let top = h
    let bottom = 0
    stack.push(start)
    seen[start] = 1
    while (stack.length > 0) {
      const i = stack.pop()!
      cells.push(i)
      const x = i % w
      const y = (i - x) / w
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && bin[j] && !seen[j]) {
          seen[j] = 1
          stack.push(j)
        }
      }
    }
    if (cells.length < 8 || bottom - top + 1 > h * 0.72) for (const i of cells) bin[i] = 0
  }
}

/**
 * Recorte de una zona preparado para el OCR: ampliado, con solo el texto en negro sobre blanco. El texto es lo que se diferencia
 * del fondo de la barra (más oscuro; o más claro en la fila resaltada) y el fondo es la mediana de la zona.
 */
function textMask(work: HTMLCanvasElement, x: number, y: number, w: number, h: number, scale: number, ratio: number): HTMLCanvasElement {
  const pad = 14
  const crop = document.createElement('canvas')
  crop.width = Math.max(1, Math.round(w * scale))
  crop.height = Math.max(1, Math.round(h * scale))
  const cg = crop.getContext('2d', { willReadFrequently: true })!
  cg.drawImage(work, x, y, w, h, 0, 0, crop.width, crop.height)
  const img = cg.getImageData(0, 0, crop.width, crop.height)
  const p = img.data
  const luma: number[] = []
  for (let i = 0; i < p.length; i += 4) luma.push(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2])
  const median = [...luma].sort((a, b) => a - b)[Math.floor(luma.length / 2)]
  const darkFraction = luma.filter((l) => l < median * ratio).length / luma.length
  // Texto oscuro sobre la barra; si apenas hay píxeles más oscuros, es la fila resaltada: texto blanco
  const dark = darkFraction > 0.02
  const bin = new Uint8Array(luma.length)
  luma.forEach((l, k) => (bin[k] = (dark ? l < median * ratio : l > Math.min(250, median * 1.45)) ? 1 : 0))
  dropBlobs(bin, crop.width, crop.height)
  bin.forEach((text, k) => {
    p[k * 4] = p[k * 4 + 1] = p[k * 4 + 2] = text ? 0 : 255
  })
  cg.putImageData(img, 0, 0)

  const out = document.createElement('canvas')
  out.width = crop.width + pad * 2
  out.height = crop.height + pad * 2
  const og = out.getContext('2d')!
  og.fillStyle = '#fff'
  og.fillRect(0, 0, out.width, out.height)
  og.drawImage(crop, pad, pad)
  return out
}

async function readLine(worker: Worker, canvas: HTMLCanvasElement, digits: boolean): Promise<Candidate> {
  const { PSM } = await import('tesseract.js')
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: digits ? '0123456789' : '' })
  const { data } = await worker.recognize(canvas)
  return { text: data.text.trim(), confidence: data.confidence }
}

/**
 * Lee la pantalla de resultados de una war: una línea por jugador («92: Ines 113») con su columna (0 = izquierda, 1 = derecha).
 * Devuelve null si la imagen no tiene esa forma (para que se use el lector general). `allScripts` añade japonés y griego a los nombres.
 */
export async function readWarScreen(file: Blob, allScripts: boolean, onProgress?: (p: number) => void): Promise<CaptureLine[] | null> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, WORK_WIDTH / bitmap.width)
  const W = Math.round(bitmap.width * scale)
  const H = Math.round(bitmap.height * scale)
  const work = document.createElement('canvas')
  work.width = W
  work.height = H
  const wg = work.getContext('2d', { willReadFrequently: true })!
  wg.drawImage(bitmap, 0, 0, W, H)
  bitmap.close()
  const px = wg.getImageData(0, 0, W, H).data
  const isColor = (x: number, y: number) => {
    const i = (y * W + x) * 4
    return colorful(px[i], px[i + 1], px[i + 2])
  }

  // Barras de cada columna: filas de la imagen donde casi toda la columna es de color vivo, con la altura de una barra
  const layout = COLUMNS.map(([a, b]) => {
    const xa = Math.round(W * a)
    const xb = Math.round(W * b)
    const flags: boolean[] = []
    for (let y = 0; y < H; y++) {
      let n = 0
      let total = 0
      for (let x = xa; x < xb; x += 2) {
        total++
        if (isColor(x, y)) n++
      }
      flags.push(n / total > 0.6)
    }
    // Un par de filas sueltas sin color (por el texto) no parten una barra
    for (let y = 1; y < H - 1; y++) if (!flags[y] && flags[y - 1] && flags[y + 1]) flags[y] = true
    return { xa, xb, bars: findBarStack(runsOf(flags), W * BAR_HEIGHT[0], W * BAR_HEIGHT[1]) }
  }).map((col) => ({
    ...col,
    // Extremos horizontales de cada barra: la racha ancha de color a su altura
    bars: col.bars.map((bar: Bar) => {
      const flags: boolean[] = []
      for (let x = col.xa; x < col.xb; x++) {
        let n = 0
        for (let y = bar.y0; y < bar.y1; y++) if (isColor(x, Math.min(H - 1, y))) n++
        flags.push(n / (bar.y1 - bar.y0) > 0.5)
      }
      const run = widestRun(flags)
      return run ? { ...bar, x0: col.xa + run[0], x1: col.xa + run[1] } : null
    }),
  }))
  if (layout.every((c) => c.bars.filter(Boolean).length < MIN_BARS)) return null
  // Todas las barras de una columna miden lo mismo: su extensión es la mediana (el icono del personaje corta el color en algunas
  // filas y, sola, la de cada barra saldría recortada por la izquierda)
  for (const col of layout) {
    const found = col.bars.filter((bar): bar is NonNullable<typeof bar> => bar !== null)
    if (found.length === 0) continue
    const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
    const [x0, x1, h] = [med(found.map((b) => b.x0)), med(found.map((b) => b.x1)), med(found.map((b) => b.y1 - b.y0))]
    for (const bar of found) Object.assign(bar, { x0, x1, y1: bar.y0 + h })
  }

  const nameWorker = await getWorker(allScripts ? ALL_LANGS : LATIN_LANGS)
  const digitsWorker = await getWorker(LATIN_LANGS)
  const total = layout.reduce((n, c) => n + c.bars.filter(Boolean).length, 0)
  let done = 0
  onProgress?.(0)

  const lines: CaptureLine[] = []
  for (const [column, col] of layout.entries()) {
    const bars = col.bars.filter((bar): bar is NonNullable<typeof bar> => bar !== null)
    if (bars.length < MIN_BARS) continue
    const rows: { names: Candidate[]; points: Candidate | null; y: number; rgb: Rgb | null }[] = []
    for (const bar of bars) {
      const barW = bar.x1 - bar.x0
      const barH = bar.y1 - bar.y0
      const ocrScale = Math.max(2, Math.min(5, 130 / barH))
      const y = Math.max(0, bar.y0 - barH * 0.1)
      const h = Math.min(H - y, barH * 1.2)
      const crop = ([from, to]: [number, number], ratio: number) => textMask(work, bar.x0 + barW * from, y, barW * (to - from), h, ocrScale, ratio)

      // Cada zona se lee con dos umbrales; la lectura de cada nombre se elige después, con el tag de toda la columna
      const names: Candidate[] = []
      const points: Candidate[] = []
      for (const ratio of RATIOS) {
        names.push(await readLine(nameWorker, crop(NAME_ZONE, ratio), false))
        points.push(await readLine(digitsWorker, crop(POINTS_ZONE, ratio), true))
      }
      rows.push({ names, points: bestCandidate(points), y: (bar.y0 + bar.y1) / 2, rgb: barColor(px, W, bar) })
      done++
      onProgress?.(done / total)
    }
    const chosen = pickByTag(rows.map((r) => r.names))
    rows.forEach((r, i) => {
      const name = chosen[i]
      if (name || r.points) {
        lines.push({ text: [name?.text, r.points?.text].filter(Boolean).join(' '), y: r.y, confidence: Math.min(name?.confidence ?? 0, r.points?.confidence ?? 0), column: column as 0 | 1, rgb: r.rgb })
      }
    })
  }
  return lines.length >= MIN_BARS ? lines : null
}

/** Color medio de una barra, para el plan B de los equipos por color */
export function barColor(px: Uint8ClampedArray, W: number, bar: { x0: number; x1: number; y0: number; y1: number }): Rgb | null {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = bar.y0; y < bar.y1; y += 2) {
    for (let x = bar.x0; x < bar.x1; x += 4) {
      const i = (y * W + x) * 4
      if (!colorful(px[i], px[i + 1], px[i + 2])) continue
      r += px[i]
      g += px[i + 1]
      b += px[i + 2]
      n++
    }
  }
  return n < 20 ? null : [r / n, g / n, b / n]
}
