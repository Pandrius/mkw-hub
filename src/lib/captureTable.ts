import { newPlayerId, type FreeWar } from './freeTable'
import type { OcrLine } from './ocrRace'
import { cleanPlayerName, stripSharedTag } from './playerName'

/**
 * De una captura a una tabla de war: lo que el OCR lee de cada fila (nombre y puntos) se convierte en filas editables. El equipo
 * de cada fila se deduce del color de su fondo (rojo contra azul). Todo son funciones puras (con tests); la lectura del texto y
 * del color se hace aparte, en el navegador (ocrImage.ts).
 */
export type Rgb = [number, number, number]
/** Una fila leída: el texto y, si se ha podido, el color medio de su fondo */
export type CaptureLine = OcrLine & { rgb?: Rgb | null }
export type Side = 'home' | 'away'

export type CaptureRow = {
  id: number
  name: string
  /** Puntos como se escriben en el editor de tablas */
  points: string
  side: Side
  /** Si pasa a la tabla (las filas dudosas, como el total de un equipo, salen sin marcar) */
  include: boolean
  /** Texto tal como lo leyó el OCR, para compararlo con la captura */
  raw: string
}

export type CaptureReading = {
  rows: CaptureRow[]
  /** Los dos equipos se han distinguido por el color de las filas (si no, todas salen en el primero y hay que elegir) */
  sidesFromColor: boolean
}

/** Un jugador no puede hacer más puntos que esto en una war (12 carreras × 15); por encima será el total de un equipo */
export const MAX_PLAYER_POINTS = 200
/** Filas con color reconocible de cada equipo, como mínimo, para fiarse del color */
const MIN_COLOR_ROWS = 2

/** Equipo por el color del fondo de la fila: rojo o azul (null si es gris, oscuro o de otro color) */
export function teamOfColor([r, g, b]: Rgb): 'red' | 'blue' | null {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max < 70 || (max - min) / max < 0.3) return null
  const d = max - min
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  hue = (hue * 60 + 360) % 360
  if (hue <= 20 || hue >= 325) return 'red'
  if (hue >= 195 && hue <= 265) return 'blue'
  return null
}

/** El número de puntos al final de la fila (separado del nombre) y el nombre sin la posición del principio */
function splitRow(text: string): { body: string; points: number } | null {
  const trimmed = text.trim()
  const m = /(?:^|[^\p{L}\p{N}])(\d{1,3})[^\p{L}\p{N}]*$/u.exec(trimmed)
  if (!m) return null
  // m.index es el separador que hay justo antes de los puntos (o 0 si la fila empieza por ellos)
  const body = trimmed
    .slice(0, m.index)
    // La posición del principio (1, 2.º, 3rd…) no es parte del nombre
    .replace(/^[^\p{L}\p{N}]{0,3}\d{1,2}(?:st|nd|rd|th|º|°|\.|\)|:)?(?=\s|$)/iu, '')
  return { body, points: Number(m[1]) }
}

/** Filas editables a partir de las líneas leídas; `tags` son los tags de equipo ya escritos en el editor, que se quitan de los nombres */
export function parseCaptureLines(lines: CaptureLine[], tags: string[] = []): CaptureReading {
  const parsed = [...lines]
    .sort((a, b) => a.y - b.y)
    .flatMap((line) => {
      const split = splitRow(line.text)
      if (!split) return []
      const name = cleanPlayerName(split.body, tags)
      return name ? [{ name, points: split.points, raw: line.text.trim(), team: line.rgb ? teamOfColor(line.rgb) : null }] : []
    })

  const red = parsed.filter((p) => p.team === 'red').length
  const blue = parsed.filter((p) => p.team === 'blue').length
  const sidesFromColor = red >= MIN_COLOR_ROWS && blue >= MIN_COLOR_ROWS
  const sideOf = (team: 'red' | 'blue' | null): Side => (sidesFromColor && team === 'blue' ? 'away' : 'home')

  const rows = parsed.map((p): CaptureRow => ({ id: newPlayerId(), name: p.name, points: String(p.points), side: sideOf(p.team), include: p.points <= MAX_PLAYER_POINTS, raw: p.raw }))
  // Tag sin corchetes repetido entre los de un mismo equipo («NEB Ana», «NEB Beto»)
  for (const side of ['home', 'away'] as Side[]) {
    const group = rows.filter((r) => r.side === side)
    const stripped = stripSharedTag(group.map((r) => r.name))
    group.forEach((r, i) => (r.name = stripped[i] || r.name))
  }
  return { rows, sidesFromColor }
}

/** De varias lecturas de la misma imagen (normal e invertida), la que saca más filas válidas */
export function bestReading(readings: CaptureReading[]): CaptureReading {
  const score = (r: CaptureReading) => r.rows.filter((x) => x.include).length * 10 + (r.sidesFromColor ? 5 : 0)
  return readings.reduce((best, r) => (score(r) > score(best) ? r : best))
}

/** Cambia de equipo a todas las filas (el rojo no tiene por qué ser el equipo 1) */
export const swapSides = (rows: CaptureRow[]): CaptureRow[] => rows.map((r) => ({ ...r, side: r.side === 'home' ? 'away' : 'home' }))

/** Pasa las filas marcadas a la tabla de war: sustituyen a los jugadores de cada equipo (los tags y nombres de equipo no se tocan) */
export function applyCapture(war: FreeWar, rows: CaptureRow[]): FreeWar {
  const players = (side: Side) => rows.filter((r) => r.include && r.side === side && r.name.trim() !== '').map((r) => ({ id: newPlayerId(), name: r.name.trim(), points: r.points.trim() }))
  return { ...war, home: { ...war.home, players: players('home') }, away: { ...war.away, players: players('away') } }
}
