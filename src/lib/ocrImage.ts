// Lee el texto de una captura con Tesseract.js, en el propio navegador: sin servidor y sin coste.
// Los ficheros de Tesseract (worker, núcleo wasm e idioma) se sirven desde /tesseract/ (ver vite.config.ts)
// y solo se descargan la primera vez que alguien usa el lector.
import type { CaptureLine, Rgb } from './captureTable'
import { groupRows, type OcrLine } from './ocrRace'

type Worker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>

/** Idiomas del lector: inglés (alfabeto latino) o, además, japonés y griego para los nombres de las capturas de tablas */
export const LATIN_LANGS = 'eng'
export const ALL_LANGS = 'eng+jpn+ell'

/** Un lector por combinación de idiomas: cada uno carga sus datos la primera vez que se usa */
const workerPromises = new Map<string, Promise<Worker>>()

export function getWorker(langs = LATIN_LANGS, onProgress?: (p: number) => void): Promise<Worker> {
  let workerPromise = workerPromises.get(langs)
  workerPromise ??= import('tesseract.js').then(async ({ createWorker, OEM, PSM }) => {
    const base = `${import.meta.env.BASE_URL}tesseract/`
    const worker = await createWorker(langs, OEM.LSTM_ONLY, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') onProgress?.(m.progress)
      },
    })
    // Texto suelto: la pantalla de resultados no son párrafos
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    return worker
  })
  workerPromises.set(langs, workerPromise)
  workerPromise.catch(() => workerPromises.delete(langs))
  return workerPromise
}

/** Escala la imagen y la pasa a grises con más contraste (opcionalmente invertida: texto oscuro sobre claro) */
async function prepare(file: Blob, invert: boolean): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(3, 2000 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    // Contraste: estira alrededor del gris medio
    let v = Math.max(0, Math.min(255, (gray - 128) * 1.6 + 128))
    if (invert) v = 255 - v
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

type TLine = { text: string; confidence: number; bbox: { x0: number; x1: number; y0: number; y1: number } }
type TBlock = { paragraphs?: { lines?: TLine[] }[] }

/** Lee las líneas de la imagen. Dos pasadas (normal e invertida) porque el texto del juego es blanco con borde. */
export async function readImageLines(
  file: Blob,
  onProgress?: (p: number) => void,
): Promise<{ normal: OcrLine[]; inverted: OcrLine[] }> {
  const worker = await getWorker()
  const pass = async (invert: boolean, step: number): Promise<OcrLine[]> => {
    const canvas = await prepare(file, invert)
    const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false })
    onProgress?.(step)
    const blocks = ((data as unknown as { blocks?: TBlock[] }).blocks ?? []) as TBlock[]
    // En modo texto suelto cada "línea" es un trozo (número, nombre, puntos): se juntan por filas
    return groupRows(
      blocks
        .flatMap((b) => b.paragraphs ?? [])
        .flatMap((p) => p.lines ?? [])
        .map((l) => ({
          text: l.text,
          confidence: l.confidence,
          x: l.bbox.x0,
          y: (l.bbox.y0 + l.bbox.y1) / 2,
          height: l.bbox.y1 - l.bbox.y0,
        })),
    )
  }
  onProgress?.(0)
  const inverted = await pass(true, 0.5)
  const normal = await pass(false, 1)
  return { normal, inverted }
}

/** Color medio del fondo de una fila (sin contar el texto blanco ni su borde oscuro); null si no hay píxeles suficientes */
function rowColor(ctx: CanvasRenderingContext2D, width: number, height: number, line: OcrLine): Rgb | null {
  if (line.x0 === undefined || line.x1 === undefined || line.height === undefined) return null
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)))
  const pad = width * 0.12
  const x = clamp(line.x0 - pad, width)
  const y = clamp(line.y - line.height * 0.6, height)
  const w = clamp(line.x1 + pad, width) - x
  const h = clamp(line.y + line.height * 0.6, height) - y
  if (w < 4 || h < 2) return null
  const d = ctx.getImageData(x, y, w, h).data
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i < d.length; i += 4) {
    const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    if (luma > 200 || luma < 45) continue
    r += d[i]
    g += d[i + 1]
    b += d[i + 2]
    n++
  }
  return n < 30 ? null : [r / n, g / n, b / n]
}

/**
 * Lee las filas de una captura de tabla: el texto de cada una (dos pasadas, normal e invertida) y el color de su fondo para saber de
 * qué equipo es. `allScripts` añade el japonés y el griego a los nombres: es más lento y la primera vez se descargan sus datos.
 */
export async function readCaptureLines(file: Blob, allScripts: boolean, onProgress?: (p: number) => void): Promise<{ normal: CaptureLine[]; inverted: CaptureLine[] }> {
  const worker = await getWorker(allScripts ? ALL_LANGS : LATIN_LANGS)
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(3, 2000 / bitmap.width)
  const color = document.createElement('canvas')
  color.width = Math.round(bitmap.width * scale)
  color.height = Math.round(bitmap.height * scale)
  const colorCtx = color.getContext('2d', { willReadFrequently: true })!
  colorCtx.drawImage(bitmap, 0, 0, color.width, color.height)
  bitmap.close()

  const pass = async (invert: boolean, step: number): Promise<CaptureLine[]> => {
    const gray = document.createElement('canvas')
    gray.width = color.width
    gray.height = color.height
    const ctx = gray.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(color, 0, 0)
    const img = ctx.getImageData(0, 0, gray.width, gray.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      let v = Math.max(0, Math.min(255, (g - 128) * 1.6 + 128))
      if (invert) v = 255 - v
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(img, 0, 0)

    const { data } = await worker.recognize(gray, {}, { blocks: true, text: false })
    onProgress?.(step)
    const blocks = ((data as unknown as { blocks?: TBlock[] }).blocks ?? []) as TBlock[]
    const lines = groupRows(
      blocks
        .flatMap((b) => b.paragraphs ?? [])
        .flatMap((p) => p.lines ?? [])
        .map((l) => ({ text: l.text, confidence: l.confidence, x: l.bbox.x0, x1: l.bbox.x1, y: (l.bbox.y0 + l.bbox.y1) / 2, height: l.bbox.y1 - l.bbox.y0 })),
    )
    return lines.map((line) => ({ ...line, rgb: rowColor(colorCtx, color.width, color.height, line) }))
  }
  onProgress?.(0)
  const inverted = await pass(true, 0.5)
  const normal = await pass(false, 1)
  return { normal, inverted }
}
