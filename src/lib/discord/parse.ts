import { TRACKS, getTrackByAbbr, type Track } from '../../data/tracks.js'
import type { BotMessageKey } from './messages.js'

/** Lógica pura del bot: lectura de las opciones de los comandos (sin red ni base de datos). */

export const RACES_PER_EVENT = 12
const TEAM_SIZE = 6
const MAX_MISSING = 2

export type ParseError = { error: BotMessageKey; vars?: Record<string, string | number> }
export type LineupPlayer = { id: number; name: string }
export type ParsedRace = { results: { player_id: number; position: number }[]; missingHome: number }

export const isParseError = (x: unknown): x is ParseError =>
  typeof x === 'object' && x !== null && 'error' in x

/** "Peckmat = tortelini, Bob; Carl" → ['Peckmat = tortelini', 'Bob', 'Carl'] */
export function parsePlayerList(input: string | undefined): string[] {
  return (input ?? '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Nombre en el juego de una entrada "Usuario = nombre" (igual que resolve_player en la base de datos). */
export function inGameName(entry: string): string {
  const i = entry.indexOf('=')
  return (i >= 0 ? entry.slice(i + 1) : entry).trim()
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Posiciones de una carrera de war.
 *
 * - En orden de alineación: "1 3 5 7 9 11" (también con comas). `x` o `-` = ese jugador no corrió.
 * - Con nombres: "tortelini=1, Bob=3, …" (o "nombre: 1"); sirve para cualquier jugador del evento.
 *
 * Los ausentes del propio equipo se deducen (6 − resultados); los del rival vienen en `missingAway`.
 */
export function parseWarPositions(
  input: string,
  lineup: LineupPlayer[],
  allPlayers: LineupPlayer[],
  missingAway = 0,
): ParsedRace | ParseError {
  const text = input.trim()
  if (!text) return { error: 'posEmpty' }

  const results: ParsedRace['results'] = []
  if (/[=:]/.test(text)) {
    for (const part of text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
      const m = /^(.+?)\s*[=:]\s*(\S+)$/.exec(part)
      if (!m) return { error: 'posBadToken', vars: { token: part } }
      const player = allPlayers.find((p) => sameName(p.name, m[1]))
      if (!player) return { error: 'posUnknownPlayer', vars: { name: m[1].trim() } }
      if (results.some((r) => r.player_id === player.id)) return { error: 'posRepeatedPlayer', vars: { name: player.name } }
      if (!/^\d{1,2}$/.test(m[2])) return { error: 'posBadToken', vars: { token: m[2] } }
      results.push({ player_id: player.id, position: Number(m[2]) })
    }
    if (results.length > TEAM_SIZE) return { error: 'posCount', vars: { n: results.length, lineup: TEAM_SIZE } }
  } else {
    const tokens = text.split(/[\s,;]+/).filter(Boolean)
    if (tokens.length !== lineup.length) return { error: 'posCount', vars: { n: tokens.length, lineup: lineup.length } }
    for (const [i, token] of tokens.entries()) {
      if (/^[xX-]$/.test(token)) continue
      if (!/^\d{1,2}$/.test(token)) return { error: 'posBadToken', vars: { token } }
      results.push({ player_id: lineup[i].id, position: Number(token) })
    }
  }

  const missingHome = TEAM_SIZE - results.length
  if (missingHome > MAX_MISSING) return { error: 'posMissing' }
  if (missingHome + missingAway > MAX_MISSING) return { error: 'posTotalMissing' }

  const racers = TEAM_SIZE * 2 - missingHome - missingAway
  const seen = new Set<number>()
  for (const { position } of results) {
    if (position < 1 || position > racers) return { error: 'posRange', vars: { pos: position, racers } }
    if (seen.has(position)) return { error: 'posRepeated', vars: { pos: position } }
    seen.add(position)
  }
  return { results, missingHome }
}

/** Posición de un lounge: un único número del 1 al 24. */
export function parseLoungePosition(input: string, playerId: number): ParsedRace | ParseError {
  // Admite ordinales: "3.º", "3º", "2nd"
  const text = input.trim().replace(/(st|nd|rd|th)$/i, '').replace(/[.\sºª]+$/, '')
  if (!/^\d{1,2}$/.test(text)) return { error: 'posLounge' }
  const position = Number(text)
  if (position < 1 || position > 24) return { error: 'posLounge' }
  return { results: [{ player_id: playerId, position }], missingHome: 0 }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Pista por abreviatura (rDKP), id (dk-pass) o nombre ("DK Pass"); si no es exacta, la única que contenga el texto. */
export function findTrack(query: string | undefined): Track | undefined {
  const q = (query ?? '').trim()
  if (!q) return undefined
  const exact =
    getTrackByAbbr(q) ?? TRACKS.find((t) => t.id === q.toLowerCase() || norm(t.name) === norm(q))
  if (exact) return exact
  const matches = TRACKS.filter((t) => norm(t.name).includes(norm(q)))
  return matches.length === 1 ? matches[0] : undefined
}

/** Sugerencias de autocompletado (máx. 25, el límite de Discord): primero por abreviatura, luego por nombre. */
export function trackChoices(query: string | undefined, limit = 25): { name: string; value: string }[] {
  const q = (query ?? '').trim().toLowerCase()
  const withAbbr = TRACKS.filter((t): t is Track & { abbr: string } => Boolean(t.abbr))
  const score = (t: Track & { abbr: string }) => {
    if (!q) return 1
    const abbr = t.abbr.toLowerCase()
    if (abbr === q) return 0
    if (abbr.startsWith(q) || abbr.replace(/^r/, '').startsWith(q)) return 1
    if (norm(t.name).includes(norm(q))) return 2
    return -1
  }
  return withAbbr
    .map((t) => ({ t, s: score(t) }))
    .filter(({ s }) => s >= 0)
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map(({ t }) => ({ name: `${t.abbr} · ${t.name}`, value: t.abbr }))
}

/** Siguiente número de carrera libre (el mayor + 1). */
export function nextRaceNo(races: { race_no: number }[]): number {
  return races.reduce((max, r) => Math.max(max, r.race_no), 0) + 1
}

/** Hueco de la alineación por nombre (sin mayúsculas) o por número 1..6; -1 si no está. */
export function findLineupSlot(lineup: LineupPlayer[], query: string): number {
  const q = query.trim()
  if (/^\d$/.test(q)) {
    const i = Number(q) - 1
    return i >= 0 && i < lineup.length ? i : -1
  }
  return lineup.findIndex((p) => sameName(p.name, q) || sameName(p.name, inGameName(q)))
}

/** Alineación guardada (ids) → jugadores; si falta, los 6 primeros jugadores del evento. */
export function lineupPlayers(lineupIds: number[], players: LineupPlayer[]): LineupPlayer[] {
  const byId = new Map(players.map((p) => [p.id, p]))
  const fromIds = lineupIds.map((id) => byId.get(id)).filter((p): p is LineupPlayer => Boolean(p))
  if (fromIds.length > 0) return fromIds
  return [...players].sort((a, b) => a.id - b.id).slice(0, TEAM_SIZE)
}
