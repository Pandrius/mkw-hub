/**
 * Editor de tablas de war libre: dos equipos (tag, nombre y jugadores con sus puntos) que salen ordenados dentro de cada equipo.
 * No tiene nada que ver con las wars guardadas: no hace falta cuenta y no cuenta en ninguna estadística, ranking ni logro.
 */
export type FreePlayer = { id: number; name: string; /** Lo escrito en el campo: un número o una suma como 15+12+10 */ points: string }
/** `teamId`: el equipo de la web elegido en el buscador (sirve para sugerir a sus jugadores); sin él, el tag y el nombre son libres */
export type FreeTeam = { tag: string; name: string; players: FreePlayer[]; teamId?: number | null }
export type FreeWar = { title: string; home: FreeTeam; away: FreeTeam }

/** Jugadores de cada equipo al empezar (se pueden añadir y quitar sin límite) */
export const DEFAULT_PLAYERS = 6

let nextId = 1
export const newPlayerId = () => nextId++

export function emptyWar(): FreeWar {
  const team = (): FreeTeam => ({ tag: '', name: '', players: Array.from({ length: DEFAULT_PLAYERS }, () => ({ id: newPlayerId(), name: '', points: '' })) })
  return { title: '', home: team(), away: team() }
}

const SUM = /^[+-]?\d+([.,]\d+)?(\s*\+\s*[+-]?\d+([.,]\d+)?)*$/

/** ¿Es un número o una suma de números (los puntos de cada carrera, como en Lorenzi)? */
export const isPointsExpression = (raw: string) => SUM.test(raw.trim())

/** Puntos de un campo: admite negativos (penalties), decimales y sumas como 15+12+10. Vacío o no válido cuenta 0 */
export function parsePoints(raw: string): number {
  const text = raw.trim()
  if (!SUM.test(text)) return 0
  const total = text.split('+').reduce((sum, part) => sum + (part.trim() === '' ? 0 : Number(part.trim().replace(',', '.'))), 0)
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : 0
}

export type TablePlayer = { name: string; points: number }
export type TableTeam = { tag: string; name: string; total: number; /** De más a menos puntos */ players: TablePlayer[] }
export type TableData = { title: string; home: TableTeam; away: TableTeam; /** Puntos del equipo de la izquierda menos los del de la derecha */ diff: number }

const cleanText = (s: string) => s.replace(/[\r\n[\]]/g, ' ').replace(/\s+/g, ' ').trim()

function buildTeam(team: FreeTeam, fallbackTag: string): TableTeam {
  const players = team.players
    .filter((p) => p.name.trim() !== '' || p.points.trim() !== '')
    .map((p, i) => ({ name: cleanText(p.name) || '—', points: parsePoints(p.points), i }))
    // De más a menos puntos; a igualdad, por orden de entrada
    .sort((a, b) => b.points - a.points || a.i - b.i)
    .map(({ name, points }) => ({ name, points }))
  return { tag: cleanText(team.tag) || fallbackTag, name: cleanText(team.name), total: Math.round(players.reduce((n, p) => n + p.points, 0) * 100) / 100, players }
}

/** La tabla lista para dibujar: jugadores ordenados en cada equipo, totales y diferencia */
export function buildTable(war: FreeWar): TableData {
  const home = buildTeam(war.home, 'Team 1')
  const away = buildTeam(war.away, 'Team 2')
  return { title: war.title.trim(), home, away, diff: Math.round((home.total - away.total) * 100) / 100 }
}

/** ¿Hay algo que enseñar? (si no, se pide rellenar la tabla en vez de dibujar un cartel vacío) */
export const hasContent = (data: TableData) => data.home.players.length > 0 || data.away.players.length > 0

/** Medallas de la tabla: oro, plata y bronce para los tres que más puntos han hecho de los dos equipos; los empates comparten (0, 1, 2) */
export function medalOf(points: number, data: Pick<TableData, 'home' | 'away'>): number | null {
  const all = [...data.home.players, ...data.away.players]
  const rank = all.filter((p) => p.points > points).length
  return rank < 3 && all.length > 1 ? rank : null
}

/** Puesto de un jugador en la sala (de los dos equipos juntos): 1 el que más puntos ha hecho; los empates comparten puesto. null si solo hay uno */
export function placeOf(points: number, data: Pick<TableData, 'home' | 'away'>): number | null {
  const all = [...data.home.players, ...data.away.players]
  return all.length > 1 ? all.filter((p) => p.points > points).length + 1 : null
}

/** Tabla en texto plano para pegar en un chat */
export function tableText(data: TableData): string {
  const team = (t: TableTeam) => [`${t.tag}${t.name ? ` (${t.name})` : ''} — ${t.total}`, ...t.players.map((p, i) => `${i + 1}. ${p.name} — ${p.points}`)].join('\n')
  return [data.title, team(data.home), team(data.away)].filter(Boolean).join('\n\n')
}

/** Tabla en el formato de texto del Table Maker de Lorenzi (gb2.hlorenzi.com/table), el mismo que las wars de la web */
export function lorenziFreeText(war: FreeWar): string {
  const data = buildTable(war)
  const lines = [`#title ${data.title || `${data.home.tag} vs ${data.away.tag}`}`]
  for (const [i, team] of [war.home, war.away].entries()) {
    const built = i === 0 ? data.home : data.away
    if (i > 0) lines.push('')
    lines.push(built.tag)
    for (const p of team.players) {
      if (p.name.trim() === '' && p.points.trim() === '') continue
      const pts = isPointsExpression(p.points) ? p.points.trim().replace(/\s+/g, '').replace(/,/g, '.') : String(parsePoints(p.points))
      lines.push(`${cleanText(p.name) || '—'} ${pts}`)
    }
  }
  return lines.join('\n')
}

// ───────────────────────── Enlace compartible ─────────────────────────

/** Diseño que viaja en el enlace (sin la foto, que pesaría demasiado): el preset y los colores propios, ya validados al leerlo */
export type SharedDesign = { preset: string; colors: Record<string, string> }
export type SharedWar = { war: FreeWar; design: SharedDesign | null }

/** Tamaño máximo de la tabla codificada, para que el enlace siga siendo manejable */
export const MAX_SHARE_LENGTH = 6000

const toBase64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

const used = (p: FreePlayer) => p.name.trim() !== '' || p.points.trim() !== ''

/** Codifica la tabla (sin las filas vacías) para el parámetro `d` del enlace */
export function encodeWar(war: FreeWar, design: SharedDesign | null = null): string {
  const team = (t: FreeTeam) => ({ g: t.tag.trim().slice(0, 12), n: t.name.trim().slice(0, 40), p: t.players.filter(used).map((p) => [p.name.trim().slice(0, 40), p.points.trim().slice(0, 40)]) })
  return toBase64Url(JSON.stringify({ v: 2, t: war.title.trim().slice(0, 60), h: team(war.home), a: team(war.away), ...(design ? { d: { p: design.preset, c: design.colors } } : {}) }))
}

function decodeTeam(raw: unknown): FreeTeam | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as { g?: unknown; n?: unknown; p?: unknown }
  if (!Array.isArray(t.p)) return null
  const players = t.p
    .filter((x): x is [unknown, unknown] => Array.isArray(x) && x.length === 2)
    .slice(0, 60)
    .map(([name, points]) => ({ id: newPlayerId(), name: String(name).slice(0, 40), points: String(points).slice(0, 40) }))
  return { tag: typeof t.g === 'string' ? t.g.slice(0, 12) : '', name: typeof t.n === 'string' ? t.n.slice(0, 40) : '', players }
}

/** Lee el parámetro `d` de un enlace; null si no es una tabla válida */
export function decodeWar(data: string | null | undefined): SharedWar | null {
  if (!data || data.length > MAX_SHARE_LENGTH) return null
  try {
    const raw = JSON.parse(fromBase64Url(data)) as { v?: unknown; t?: unknown; h?: unknown; a?: unknown; d?: { p?: unknown; c?: unknown } }
    if (raw.v !== 2) return null
    const home = decodeTeam(raw.h)
    const away = decodeTeam(raw.a)
    if (!home || !away) return null
    const colors: Record<string, string> = {}
    if (raw.d?.c && typeof raw.d.c === 'object') for (const [k, v] of Object.entries(raw.d.c as Record<string, unknown>)) if (typeof v === 'string') colors[k] = v
    return {
      war: { title: typeof raw.t === 'string' ? raw.t.slice(0, 60) : '', home, away },
      design: typeof raw.d?.p === 'string' ? { preset: raw.d.p, colors } : null,
    }
  } catch {
    return null
  }
}
