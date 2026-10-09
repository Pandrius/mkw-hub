// Lee el texto de una captura con Tesseract.js, en el propio navegador: sin servidor y sin coste.
// Los ficheros de Tesseract (worker, núcleo wasm e idioma) se sirven desde /tesseract/ (ver vite.config.ts)
// y solo se descargan la primera vez que alguien usa el lector.
import { groupRows, type OcrLine } from './ocrRace'

type Worker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>

let workerPromise: Promise<Worker> | null = null

function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  workerPromise ??= import('tesseract.js').then(async ({ createWorker, OEM, PSM }) => {
    const base = `${import.meta.env.BASE_URL}tesseract/`
    const worker = await createWorker('eng', OEM.LSTM_ONLY, {
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
  workerPromise.catch(() => {
    workerPromise = null
  })
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

type TLine = { text: string; confidence: number; bbox: { x0: number; y0: number; y1: number } }
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
