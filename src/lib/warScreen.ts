import { levenshtein, normalizeName } from './ocrRace'

/**
 * Pantalla de resultados de una war de Mario Kart World: dos columnas (un equipo a cada lado, con su total grande encima) y, debajo,
 * una barra de color por jugador con su icono, el tag, el nombre y los puntos. Aquí están las funciones puras para encontrar esas
 * barras a partir de un perfil de color por filas; la lectura de la imagen y del texto está en ocrWarScreen.ts (navegador).
 */

/** Una barra de jugador: filas de píxeles [y0, y1) */
export type Bar = { y0: number; y1: number }

/** Rachas seguidas de `true` (una posición por fila de píxeles) como [inicio, fin) */
export function runsOf(flags: boolean[]): [number, number][] {
  const runs: [number, number][] = []
  let start = -1
  flags.forEach((on, i) => {
    if (on && start < 0) start = i
    if (!on && start >= 0) {
      runs.push([start, i])
      start = -1
    }
  })
  if (start >= 0) runs.push([start, flags.length])
  return runs
}

const len = (b: Bar) => b.y1 - b.y0
const center = (b: Bar) => (b.y0 + b.y1) / 2

/**
 * La pila de barras de jugador entre las rachas de color de una columna (función pura). En la captura hay muchas franjas de color (el
 * título, los totales, el fondo borroso), pero las barras son una pila de la misma altura y a distancias iguales: se busca la
 * cadena más larga así. Dentro de ella se rellenan las barras que falten (la fila resaltada tiene otro color) y a sus lados se
 * parten las rachas que son varias barras pegadas.
 */
export function findBarStack(runs: [number, number][], minHeight: number, maxHeight: number): Bar[] {
  const cands = runs.filter(([a, b]) => b - a >= minHeight && b - a <= maxHeight).map(([y0, y1]) => ({ y0, y1 }))
  let best: { bars: Bar[]; real: number; pitch: number } | null = null

  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const tall = Math.max(len(cands[i]), len(cands[j]))
      const pitch = center(cands[j]) - center(cands[i])
      // Mismo tamaño y separación de una barra a la siguiente (la altura más un hueco pequeño)
      if (Math.abs(len(cands[i]) - len(cands[j])) > tall * 0.2 || pitch < tall * 0.95 || pitch > tall * 1.8) continue
      const bars = [cands[i], cands[j]]
      let real = 2
      let expected = center(cands[j]) + pitch
      for (const c of cands.slice(j + 1)) {
        // Si la barra siguiente está más allá de lo esperado, entre medias faltaba alguna: se rellena
        while (center(c) > expected + pitch * 0.2) {
          const h = len(bars[0])
          bars.push({ y0: Math.round(expected - h / 2), y1: Math.round(expected + h / 2) })
          expected += pitch
        }
        if (Math.abs(center(c) - expected) <= pitch * 0.2 && Math.abs(len(c) - len(bars[0])) <= len(bars[0]) * 0.25) {
          bars.push(c)
          real++
          expected = center(c) + pitch
        }
      }
      if (!best || real > best.real || (real === best.real && bars.length > best.bars.length)) best = { bars, real, pitch }
    }
  }
  if (!best) return cands.length === 1 ? cands : []

  // A los lados de la pila: rachas que son varias barras pegadas (el hueco entre dos barras no siempre se distingue)
  const { pitch } = best
  const h = len(best.bars[0])
  const gap = pitch - h
  const bars = [...best.bars]
  const split = (run: [number, number]): Bar[] | null => {
    const l = run[1] - run[0]
    const k = Math.round((l + gap) / pitch)
    if (k < 2 || Math.abs(l - (k * pitch - gap)) > pitch * 0.3) return null
    return Array.from({ length: k }, (_, m) => ({ y0: Math.round(run[0] + m * pitch), y1: Math.round(run[0] + m * pitch + h) }))
  }
  for (let changed = true; changed; ) {
    changed = false
    for (const run of runs) {
      if (bars.some((b) => b.y0 < run[1] && run[0] < b.y1)) continue
      const first = bars[0]
      const last = bars[bars.length - 1]
      const pieces = split(run)
      if (!pieces) continue
      if (run[1] <= first.y0 + pitch * 0.5 && first.y0 - run[1] <= pitch * 0.5) bars.unshift(...pieces)
      else if (run[0] >= last.y1 - pitch * 0.5 && run[0] - last.y1 <= pitch * 0.5) bars.push(...pieces)
      else continue
      changed = true
    }
  }
  return bars
}

/** Extremos [inicio, fin) de la zona con color a lo largo de una fila (la barra): la racha más ancha de `true` */
export function widestRun(flags: boolean[]): [number, number] | null {
  const runs = runsOf(flags)
  return runs.length === 0 ? null : runs.reduce((best, r) => (r[1] - r[0] > best[1] - best[0] ? r : best))
}

/** Lectura de un trozo de texto con la confianza del OCR (0..100) */
export type Candidate = { text: string; confidence: number }

/** Puntuación de una lectura: su confianza y un pequeño premio por cada letra o número leído (una «I» suelta no gana a «92:») */
const score = (c: Candidate) => c.confidence + 3 * Math.min(8, (c.text.match(/[p{L}p{N}]/gu) ?? []).length)

/** La lectura más segura entre varias de la misma zona, ignorando las vacías; null si no hay ninguna */
export function bestCandidate(candidates: Candidate[]): Candidate | null {
  const valid = candidates.filter((c) => c.text.trim() !== '')
  return valid.length === 0 ? null : valid.reduce((best, c) => (score(c) > score(best) ? c : best))
}

/** Confianza del OCR por debajo de la cual una lectura es casi ilegible */
const ILLEGIBLE = 35

/** Primera palabra de una lectura, en la forma comparable del OCR (sin símbolos, con las letras confundibles unificadas) */
export const firstToken = (text: string) => normalizeName(text.trim().split(/\s+/)[0] ?? '')

/** ¿Son la misma palabra salvo un carácter de diferencia? («92», «92:», «921», «2:» para un mismo tag) */
export const alike = (a: string, b: string) => a !== '' && b !== '' && levenshtein(a, b) <= 1

/**
 * De las lecturas de cada fila de una columna, la de cada una (función pura). Todos los jugadores de un equipo llevan el mismo tag
 * delante: se busca la palabra inicial que más filas tienen en alguna de sus lecturas y, en cada fila, gana la lectura que empieza
 * así (la más segura de ellas); si ninguna, la más segura de todas. Así una fila a la que el OCR le ha comido una letra no se pierde
 * por una lectura basura con más confianza. Y si ninguna lectura encaja y la mejor es casi ilegible, se toma por una fila que solo
 * lleva el tag (un jugador sin nombre): sale con el tag y nada más.
 */
export function pickByTag(rows: Candidate[][]): (Candidate | null)[] {
  const tokens = rows.map((cands) => cands.filter((c) => c.text.trim() !== '').map((c) => firstToken(c.text)).filter((t) => t !== ''))
  let dominant = ''
  let support = 1
  for (const token of new Set(tokens.flat())) {
    const n = tokens.filter((ts) => ts.some((t) => alike(t, token))).length
    if (n > support) {
      support = n
      dominant = token
    }
  }
  // El tag tal como lo leyó el OCR en la lectura más segura que lo lleva
  const raw = bestCandidate(rows.flat().filter((c) => dominant !== '' && alike(firstToken(c.text), dominant)))?.text.trim().split(/\s+/)[0] ?? ''
  return rows.map((cands) => {
    const matching = dominant ? cands.filter((c) => alike(firstToken(c.text), dominant)) : []
    if (matching.length > 0) return bestCandidate(matching)
    const best = bestCandidate(cands)
    return best && raw && best.confidence < ILLEGIBLE ? { text: raw, confidence: 0 } : best
  })
}

/** Dónde están, dentro de una barra, el nombre (con su tag) y los puntos, como fracciones de su ancho */
export const NAME_ZONE: [number, number] = [0.128, 0.82]
export const POINTS_ZONE: [number, number] = [0.845, 0.99]
