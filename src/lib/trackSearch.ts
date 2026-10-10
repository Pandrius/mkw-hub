import { TRACKS, type Track } from '../data/tracks'

/** Sin mayúsculas, tildes ni signos: "Wario's  Stadium" ≈ "wario s stadium" */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Puntuación de una pista para lo que se ha escrito (menor = mejor; null = no coincide) */
function score(track: Track, q: string): number | null {
  const abbr = norm(track.abbr ?? '')
  const name = norm(track.name)
  if (abbr === q) return 0
  if (abbr.startsWith(q)) return 1
  if (name.startsWith(q)) return 2
  if (name.split(' ').some((w) => w.startsWith(q))) return 3
  if (name.includes(q) || norm(track.id).includes(q)) return 4
  // Varias palabras ("ghost 2"): todas deben aparecer en el nombre
  const words = q.split(' ')
  if (words.length > 1 && words.every((w) => name.includes(w) || abbr.includes(w))) return 5
  return null
}

/**
 * Pistas que coinciden con lo escrito, las más probables primero (abreviatura exacta, empieza por…,
 * contiene…). Con el campo vacío devuelve todas en su orden de siempre.
 */
export function searchTracks(query: string, tracks: Track[] = TRACKS): Track[] {
  const q = norm(query)
  if (!q) return tracks
  return tracks
    .map((track, i) => ({ track, i, s: score(track, q) }))
    .filter((x): x is { track: Track; i: number; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.track)
}

/**
 * Filtro de una tabla por pista: las filas cuya pista coincide (en su orden) y las pistas de la
 * tabla que sugerir, por relevancia. Si lo escrito ya es el nombre exacto de una pista, no se
 * sugiere (ya está elegida).
 */
export function filterRowsByTrack<T>(
  rows: T[],
  trackIdOf: (row: T) => string,
  query: string,
): { rows: T[]; suggestions: Track[] } {
  const q = norm(query)
  if (!q) return { rows, suggestions: [] }
  const present = new Set(rows.map(trackIdOf))
  const found = searchTracks(query, TRACKS.filter((tr) => present.has(tr.id)))
  const ids = new Set(found.map((tr) => tr.id))
  return {
    rows: rows.filter((row) => ids.has(trackIdOf(row))),
    suggestions: found.filter((tr) => norm(tr.name) !== q),
  }
}
