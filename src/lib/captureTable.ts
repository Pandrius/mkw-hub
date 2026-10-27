import { newPlayerId, type FreeWar } from './freeTable'
import type { OcrLine } from './ocrRace'
import { cleanPlayerName, extractTag, splitSharedTags, tidyName } from './playerName'
import { alike, firstToken } from './warScreen'

/**
 * De una captura a una tabla de war: lo que el OCR lee de cada fila (nombre y puntos) se convierte en filas editables. El equipo
 * de cada jugador se deduce de su tag (lo que repiten los de un mismo equipo: «[NEB] Ana», «NEB Beto») y, si no hay tags, del color
 * de su fila (rojo contra azul). Todo son funciones puras (con tests); la lectura del texto y del color se hace aparte, en el
 * navegador (ocrImage.ts).
 */
export type Rgb = [number, number, number]
/** Una fila leída: el texto y, si se ha podido, el color medio de su fondo */
/** `column`: 0 = columna izquierda, 1 = derecha, en las pantallas de resultados de dos columnas (un equipo a cada lado) */
export type CaptureLine = OcrLine & { rgb?: Rgb | null; column?: 0 | 1 }
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

/** De dónde sale el equipo de cada fila: de su columna (pantalla de resultados de dos columnas), de los tags, del color de la fila, o de ningún sitio (todas en el equipo 1 y hay que elegir) */
export type SidesFrom = 'column' | 'tag' | 'color' | 'none'

export type CaptureReading = {
  rows: CaptureRow[]
  sidesFrom: SidesFrom
  /** Tag de cada equipo, sacado de los nombres (vacío si no se ha encontrado) */
  tags: { home: string; away: string }
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
function splitRow(text: string, stripPosition = true): { body: string; points: number } | null {
  const trimmed = text.trim()
  const m = /(?:^|[^\p{L}\p{N}])(\d{1,3})[^\p{L}\p{N}]*$/u.exec(trimmed)
  if (!m) return null
  // m.index es el separador que hay justo antes de los puntos (o 0 si la fila empieza por ellos)
  const before = trimmed.slice(0, m.index)
  // La posición del principio (1, 2.º, 3rd…) no es parte del nombre. Solo hasta 24: «92:» es un tag, no una posición
  const body = stripPosition ? before.replace(/^[^\p{L}\p{N}]{0,3}(?:[1-9]|1\d|2[0-4])(?:st|nd|rd|th|º|°|\.|\)|:)?(?=\s|$)/iu, '') : before
  return { body, points: Number(m[1]) }
}

type Parsed = { name: string; points: number; raw: string; color: 'red' | 'blue' | null; tag: string | null }

/** ¿Son el mismo tag? (sin distinguir mayúsculas) */
const sameTag = (a: string | null, b: string | null) => a !== null && b !== null && a.toLowerCase() === b.toLowerCase()

/** Basura corta que el OCR deja al final de un nombre («FFFFFF oo»): una «o» o un cero sueltos detrás de otra palabra */
const dropTrailingJunk = (name: string) => name.replace(/(?<=\S)\s+[oO0]{1,2}$/u, '')

/**
 * Pantalla de resultados de dos columnas (un equipo a cada lado): cada columna es un equipo y su tag es la primera palabra que
 * comparten los jugadores, aunque el OCR la lea con variaciones («92:», «921», «2:»). Un jugador sin nombre (solo el tag) sale con
 * el nombre vacío.
 */
function parseColumns(lines: CaptureLine[]): CaptureReading {
  const rows: CaptureRow[] = []
  const tags = { home: '', away: '' }
  for (const column of [0, 1] as const) {
    const parsed = lines
      .filter((l) => l.column === column)
      .sort((a, b) => a.y - b.y)
      .flatMap((line) => {
        const split = splitRow(line.text, false)
        return split ? [{ body: tidyName(split.body), points: split.points, raw: line.text.trim() }] : []
      })
    // El tag de la columna: la primera palabra que más filas comparten (con una letra de diferencia como mucho)
    const firsts = parsed.map((p) => p.body.split(' ')[0] ?? '')
    let tag = ''
    let support = 1
    for (const first of new Set(firsts.filter((f) => f !== ''))) {
      const n = firsts.filter((f) => alike(firstToken(f), firstToken(first))).length
      if (n > support || (n === support && tag !== '' && first.length > tag.length && alike(firstToken(first), firstToken(tag)))) {
        support = n
        tag = first
      }
    }
    if (column === 0) tags.home = tag
    else tags.away = tag
    for (const p of parsed) {
      const words = p.body.split(' ')
      const tagged = tag !== '' && alike(firstToken(words[0] ?? ''), firstToken(tag))
      const name = dropTrailingJunk((tagged ? words.slice(1).join(' ') : p.body).trim())
      rows.push({ id: newPlayerId(), name, points: String(p.points), side: column === 0 ? 'home' : 'away', include: p.points <= MAX_PLAYER_POINTS, raw: p.raw })
    }
  }
  return { rows, sidesFrom: 'column', tags }
}

/**
 * Filas editables a partir de las líneas leídas. `known` son los tags de equipo ya escritos en el editor (equipo 1 y equipo 2): se
 * reconocen en los nombres y mandan para saber qué equipo es cuál.
 */
export function parseCaptureLines(lines: CaptureLine[], known: string[] = []): CaptureReading {
  // Pantalla de dos columnas: el equipo de cada fila es su columna
  if (lines.some((l) => l.column !== undefined)) return parseColumns(lines)
  const parsed: Parsed[] = [...lines]
    .sort((a, b) => a.y - b.y)
    .flatMap((line) => {
      const split = splitRow(line.text)
      if (!split) return []
      const name = cleanPlayerName(split.body, known)
      return name ? [{ name, points: split.points, raw: line.text.trim(), color: line.rgb ? teamOfColor(line.rgb) : null, tag: extractTag(split.body, known) }] : []
    })

  // Tags sin corchetes que repiten varios jugadores («NEB Ana», «NEB Beto»)
  const loose = parsed.filter((p) => p.tag === null)
  const shared = splitSharedTags(loose.map((p) => p.name))
  loose.forEach((p, i) => {
    p.tag = shared.tags[i]
    if (p.tag) p.name = shared.names[i] || p.name
  })

  // Equipos por tag: los dos tags que más jugadores llevan (con al menos dos cada uno)
  const groups = new Map<string, Parsed[]>()
  for (const p of parsed) if (p.tag) groups.set(p.tag.toLowerCase(), [...(groups.get(p.tag.toLowerCase()) ?? []), p])
  // Los dos equipos con más jugadores, en el orden en que aparecen en la captura (el de arriba, el equipo 1)
  const teams = [...groups.values()]
    .filter((g) => g.length >= 2)
    .sort((x, y) => y.length - x.length)
    .slice(0, 2)
    .sort((x, y) => parsed.indexOf(x[0]) - parsed.indexOf(y[0]))
  const display = (g: Parsed[]) => {
    const counts = new Map<string, number>()
    for (const p of g) counts.set(p.tag!, (counts.get(p.tag!) ?? 0) + 1)
    return [...counts].sort((x, y) => y[1] - x[1])[0][0]
  }

  let sidesFrom: SidesFrom = 'none'
  const sideOfRow = new Map<Parsed, Side>()
  const tags = { home: '', away: '' }

  if (teams.length > 0) {
    sidesFrom = 'tag'
    // El equipo 1 es el del tag ya escrito en el editor si lo hay; si no, el que sale primero en la captura
    const pickFor = (k: string | undefined) => (k ? teams.find((g) => sameTag(g[0].tag, k)) : undefined)
    const home = pickFor(known[0]) ?? teams.find((g) => g !== pickFor(known[1])) ?? teams[0]
    const away = pickFor(known[1]) ?? teams.find((g) => g !== home)
    tags.home = display(home)
    if (away) tags.away = display(away)
    for (const p of home) sideOfRow.set(p, 'home')
    for (const p of away ?? []) sideOfRow.set(p, 'away')

    // El resto (sin tag, o de un tercer tag): por el color de su fila si coincide con el de un equipo, y si no, donde falten jugadores
    const dominant = (g: Parsed[] | undefined) => {
      const red = g?.filter((p) => p.color === 'red').length ?? 0
      const blue = g?.filter((p) => p.color === 'blue').length ?? 0
      return red > blue ? 'red' : blue > red ? 'blue' : null
    }
    const sizes = { home: home.length, away: away?.length ?? 0 }
    for (const p of parsed.filter((x) => !sideOfRow.has(x))) {
      let side: Side
      if (!away) side = 'away'
      else if (p.color && p.color === dominant(home) && p.color !== dominant(away)) side = 'home'
      else if (p.color && p.color === dominant(away) && p.color !== dominant(home)) side = 'away'
      else side = sizes.home <= sizes.away ? 'home' : 'away'
      sideOfRow.set(p, side)
      sizes[side]++
    }
  } else {
    const red = parsed.filter((p) => p.color === 'red').length
    const blue = parsed.filter((p) => p.color === 'blue').length
    if (red >= MIN_COLOR_ROWS && blue >= MIN_COLOR_ROWS) {
      sidesFrom = 'color'
      for (const p of parsed) sideOfRow.set(p, p.color === 'blue' ? 'away' : 'home')
    }
  }

  const rows = parsed.map((p): CaptureRow => ({ id: newPlayerId(), name: p.name, points: String(p.points), side: sideOfRow.get(p) ?? 'home', include: p.points <= MAX_PLAYER_POINTS, raw: p.raw }))
  return { rows, sidesFrom, tags }
}

/** De varias lecturas de la misma imagen (normal e invertida), la que saca más filas válidas */
export function bestReading(readings: CaptureReading[]): CaptureReading {
  const score = (r: CaptureReading) => r.rows.filter((x) => x.include).length * 10 + (r.sidesFrom === 'column' ? 9 : r.sidesFrom === 'tag' ? 8 : r.sidesFrom === 'color' ? 5 : 0)
  return readings.reduce((best, r) => (score(r) > score(best) ? r : best))
}

/** Cambia de equipo a todas las filas (el rojo no tiene por qué ser el equipo 1) */
export const swapSides = (rows: CaptureRow[]): CaptureRow[] => rows.map((r) => ({ ...r, side: r.side === 'home' ? 'away' : 'home' }))

/**
 * Pasa las filas marcadas a la tabla de war: sustituyen a los jugadores de cada equipo y, si se han sacado los tags de los nombres, se
 * ponen como tag de cada equipo (si cambia el tag, el equipo elegido antes del buscador deja de valer).
 */
export function applyCapture(war: FreeWar, rows: CaptureRow[], tags: { home: string; away: string } = { home: '', away: '' }): FreeWar {
  const players = (side: Side) => rows.filter((r) => r.include && r.side === side && (r.name.trim() !== '' || r.points.trim() !== '')).map((r) => ({ id: newPlayerId(), name: r.name.trim(), points: r.points.trim() }))
  const team = (side: Side) => {
    const current = war[side]
    const tag = tags[side].trim()
    const changed = tag !== '' && tag.toLowerCase() !== current.tag.trim().toLowerCase()
    return { ...current, players: players(side), ...(tag !== '' ? { tag } : {}), ...(changed ? { name: '', teamId: null } : {}) }
  }
  return { ...war, home: team('home'), away: team('away') }
}
