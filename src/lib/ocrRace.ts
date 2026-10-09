// Lectura de la pantalla de resultados de una carrera a partir del texto que devuelve el OCR.
// No hace falta leer los nombres perfectos: ya sabemos quiénes corren la war, así que cada línea
// se empareja con el nombre conocido que más se le parece. Todo son funciones puras (con tests).

/** Una línea de texto reconocida, con su posición vertical en la imagen */
export type OcrLine = { text: string; y: number; confidence: number }

export type OcrPlayer = { key: string; name: string }

export type OcrMatch = {
  key: string
  position: number
  /** Parecido entre el nombre y el texto leído (0..1) */
  score: number
  /** De dónde sale la posición: número leído en la fila, o deducida por la altura de la fila */
  source: 'number' | 'row'
  text: string
}

export type OcrRaceResult = { matches: OcrMatch[]; unmatched: string[] }

/** Trozo de texto suelto que devuelve el OCR, con su caja */
export type OcrFragment = { text: string; x: number; y: number; height: number; confidence: number }

/**
 * Junta los trozos que están a la misma altura en una fila, de izquierda a derecha
 * (el OCR suele devolver por separado el número de posición, el nombre y los puntos).
 */
export function groupRows(fragments: OcrFragment[]): OcrLine[] {
  const list = fragments.filter((f) => f.text.trim()).sort((a, b) => a.y - b.y)
  if (list.length === 0) return []
  const heights = list.map((f) => f.height).sort((a, b) => a - b)
  const tolerance = heights[Math.floor(heights.length / 2)] * 0.5
  const rows: OcrFragment[][] = []
  for (const f of list) {
    const row = rows[rows.length - 1]
    const rowY = row && row.reduce((s, x) => s + x.y, 0) / row.length
    if (row && Math.abs(f.y - rowY) <= tolerance) row.push(f)
    else rows.push([f])
  }
  return rows.map((row) => ({
    text: [...row].sort((a, b) => a.x - b.x).map((f) => f.text.trim()).join(' '),
    y: row.reduce((s, x) => s + x.y, 0) / row.length,
    confidence: Math.min(...row.map((f) => f.confidence)),
  }))
}

/** De varias lecturas de la misma imagen, la que reconoce más jugadores (y con más parecido) */
export function bestResult(results: OcrRaceResult[]): OcrRaceResult {
  const total = (r: OcrRaceResult) => r.matches.length * 10 + r.matches.reduce((s, m) => s + m.score, 0)
  return results.reduce((best, r) => (total(r) > total(best) ? r : best))
}

/** Similitud mínima para aceptar que una línea es de un jugador */
export const MIN_SCORE = 0.55

// Letras y números que el OCR suele confundir; solo se usa para comparar, nunca se muestra
const CONFUSABLES: Record<string, string> = { '0': 'o', '1': 'l', i: 'l', '|': 'l', '5': 's', '8': 'b', '2': 'z', '6': 'g' }

export function normalizeName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}|]/gu, '')
    .replace(/./g, (c) => CONFUSABLES[c] ?? c)
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Parecido (0..1) entre un nombre y el trozo de la línea que mejor encaja con él */
export function nameScore(name: string, line: string): number {
  const n = normalizeName(name)
  const l = normalizeName(line)
  if (!n || !l) return 0
  if (l.includes(n)) return 1
  let best = 0
  for (let len = Math.max(1, n.length - 2); len <= n.length + 2; len++) {
    for (let start = 0; start + len <= Math.max(l.length, len); start++) {
      const piece = l.slice(start, start + len)
      const sim = 1 - levenshtein(n, piece) / Math.max(n.length, piece.length)
      if (sim > best) best = sim
    }
  }
  return best
}

/** Número de posición (1..12) al principio de la línea, si lo hay */
export function leadingPosition(text: string): number | null {
  const m = /^\W{0,3}(\d{1,2})(?:st|nd|rd|th|º|°|\.)?(?!\d)/i.exec(text.trim())
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 12 ? n : null
}

/**
 * Empareja las líneas con los jugadores y saca la posición de cada uno.
 * - Si en la fila se lee el número de posición, se usa.
 * - Si no, se deduce por la altura: con las filas que sí tienen número se calcula cuánto mide cada fila.
 */
export function matchRaceLines(lines: OcrLine[], players: OcrPlayer[]): OcrRaceResult {
  // Mejor pareja jugador-línea, de la más parecida a la menos (cada línea y cada jugador una sola vez)
  const pairs = players
    .flatMap((p) => lines.map((line, i) => ({ p, i, score: nameScore(p.name, line.text) })))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)

  const usedLines = new Set<number>()
  const assigned = new Map<string, { i: number; score: number }>()
  for (const x of pairs) {
    if (usedLines.has(x.i) || assigned.has(x.p.key)) continue
    usedLines.add(x.i)
    assigned.set(x.p.key, { i: x.i, score: x.score })
  }

  // Altura de fila a partir de las líneas con número (recta y = a + b·posición)
  const numbered = lines
    .map((l) => ({ y: l.y, pos: leadingPosition(l.text) }))
    .filter((x): x is { y: number; pos: number } => x.pos !== null)
  const fit = fitRows(numbered)

  const matches: OcrMatch[] = []
  const takenPositions = new Set<number>()
  // Primero las que tienen número leído, luego las deducidas, para no pisar posiciones seguras
  const entries = [...assigned.entries()].map(([key, a]) => ({ key, ...a, num: leadingPosition(lines[a.i].text) }))
  for (const e of entries.filter((e) => e.num !== null)) {
    if (takenPositions.has(e.num!)) continue
    takenPositions.add(e.num!)
    matches.push({ key: e.key, position: e.num!, score: e.score, source: 'number', text: lines[e.i].text })
  }
  for (const e of entries.filter((e) => !matches.some((m) => m.key === e.key))) {
    let pos: number | null = null
    if (fit) pos = Math.round((lines[e.i].y - fit.a) / fit.b)
    if (pos === null || pos < 1 || pos > 12 || takenPositions.has(pos)) continue
    takenPositions.add(pos)
    matches.push({ key: e.key, position: pos, score: e.score, source: 'row', text: lines[e.i].text })
  }

  // Sin números en ninguna fila: si se reconocieron los 12, la posición es el orden de arriba a abajo
  if (!fit && matches.length === 0 && assigned.size === 12) {
    const byY = [...assigned.entries()].sort((a, b) => lines[a[1].i].y - lines[b[1].i].y)
    byY.forEach(([key, a], idx) =>
      matches.push({ key, position: idx + 1, score: a.score, source: 'row', text: lines[a.i].text }),
    )
  }

  return {
    matches: matches.sort((a, b) => a.position - b.position),
    unmatched: players.filter((p) => !matches.some((m) => m.key === p.key)).map((p) => p.key),
  }
}

/** Ajuste por mínimos cuadrados; necesita al menos 2 filas con número distinto */
function fitRows(points: { y: number; pos: number }[]): { a: number; b: number } | null {
  if (new Set(points.map((p) => p.pos)).size < 2) return null
  const n = points.length
  const mx = points.reduce((s, p) => s + p.pos, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  const sxx = points.reduce((s, p) => s + (p.pos - mx) ** 2, 0)
  const sxy = points.reduce((s, p) => s + (p.pos - mx) * (p.y - my), 0)
  const b = sxy / sxx
  if (!(b > 0)) return null
  return { a: my - b * mx, b }
}
