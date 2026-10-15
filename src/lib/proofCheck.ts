// Comprobación de la captura de la sala final de una war: los puntos de cada jugador de nuestro equipo en la foto deben ser los
// mismos que los de la war apuntada. Solo lee nuestros jugadores (de los rivales no sabemos los nombres con seguridad).
// Funciones puras: la lectura del texto (OCR) se hace aparte, en el navegador.
import { pairLines, type OcrLine } from './ocrRace'
import { POINTS } from './scoring'

/** Jugadores de nuestro equipo con los puntos que suman en la war apuntada */
export type ProofPlayer = { id: number; name: string; expected: number }

export type ProofRow = {
  name: string
  expected: number
  /** Puntos que se leen en la fila de la captura (null si no se encontró al jugador o no se lee el número) */
  read: number | null
  /** Texto leído de la fila, para que el revisor lo compare */
  text: string | null
}

export type ProofReading = {
  rows: ProofRow[]
  /** Jugadores cuyos puntos se han podido leer */
  read: number
  /** Los que además coinciden */
  agreeing: number
  /** Los que se leen con otros puntos */
  mismatched: number
}

/** Jugadores propios que se tienen que poder leer, como mínimo, para dar la captura por buena sin revisor */
export const MIN_PROOF_READ = 4

/** Puntos de cada jugador en la war a partir de sus posiciones (carreras guardadas) */
export function expectedPoints(players: { id: number; name: string }[], races: { race_results: { player_id: number; position: number }[] }[]): ProofPlayer[] {
  const total = new Map<number, number>()
  for (const race of races) for (const r of race.race_results) total.set(r.player_id, (total.get(r.player_id) ?? 0) + (POINTS[r.position - 1] ?? 0))
  return players.map((p) => ({ id: p.id, name: p.name, expected: total.get(p.id) ?? 0 })).filter((p) => p.expected > 0)
}

/** Puntos al final de la fila (el último número que no sea la posición del principio) */
export function pointsOnLine(text: string): number | null {
  const m = /(\d{1,3})\D*$/.exec(text.trim())
  if (!m || m.index === 0) return null
  const before = text.trim().slice(0, m.index)
  if (!/\p{L}/u.test(before)) return null
  return Number(m[1])
}

/** Empareja a nuestros jugadores con las filas de la captura y compara sus puntos */
export function readProof(lines: OcrLine[], players: ProofPlayer[]): ProofReading {
  const paired = pairLines(lines, players.map((p) => ({ key: String(p.id), name: p.name })))
  const rows = players.map((p): ProofRow => {
    const hit = paired.get(String(p.id))
    const text = hit ? lines[hit.i].text : null
    return { name: p.name, expected: p.expected, read: text === null ? null : pointsOnLine(text), text }
  })
  const read = rows.filter((r) => r.read !== null)
  const agreeing = read.filter((r) => r.read === r.expected).length
  return { rows, read: read.length, agreeing, mismatched: read.length - agreeing }
}

/** ¿Se da por verificada sin esperar a un revisor? Hay que leer a suficientes jugadores y ninguno puede discrepar */
export function proofMatches(reading: ProofReading, players: ProofPlayer[]): boolean {
  const needed = Math.min(MIN_PROOF_READ, players.length)
  return needed > 0 && reading.read >= needed && reading.mismatched === 0
}

/** De varias lecturas de la misma imagen (normal e invertida), la que lee más jugadores y con más coincidencias */
export function bestProof(readings: ProofReading[]): ProofReading {
  const score = (r: ProofReading) => r.read * 10 + r.agreeing
  return readings.reduce((best, r) => (score(r) > score(best) ? r : best))
}
