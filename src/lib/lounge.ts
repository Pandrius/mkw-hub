/**
 * Lounge de MKCentral (https://lounge.mkcentral.com/api): historial de MMR, estadísticas y verificación de eventos.
 * Todo lo de este archivo es puro (sin red): api/lounge.ts descarga los datos y se los pasa.
 *
 * La API del Lounge solo da la puntuación TOTAL de cada mesa del jugador (no las posiciones carrera a carrera), que en 12p
 * es la suma de los puntos 15-12-10-9-8-7-6-5-4-3-2-1 de sus 12 carreras (la misma tabla que la war). Por eso un evento
 * se verifica cuando existe un cambio de MMR del jugador con esa misma puntuación a la hora jugada.
 */
import { POINTS } from './scoring.js'
import { mean, round1 } from './statMath.js'

export const LOUNGE_API = 'https://lounge.mkcentral.com/api/'
/** De momento solo el modo de 12 jugadores (el de 24 se añadirá más adelante) */
export const LOUNGE_GAME = 'mkworld12p'
export const LOUNGE_RACES = 12
/** Puntos totales repartidos en una carrera de 12 jugadores (suma de POINTS) */
export const RACE_POINTS_TOTAL = POINTS.reduce((a, b) => a + b, 0)

export type LoungeChange = {
  changeId: number
  season: number
  /** ISO UTC */
  time: string
  newMmr: number
  delta: number
  /** 'Table' (mesa), 'Bonus', 'Strike', 'TableDelete', ... */
  reason: string
  score: number | null
  partnerScores: number[]
  /** Posición del equipo en la mesa */
  rank: number | null
  /** Q, SQ, A..G (y mezclas como CD, DE, EF) */
  tier: string | null
  numTeams: number | null
  numPlayers: number | null
}

/** Cambio de MMR tal como lo devuelve la API en `player/details` (solo los campos que usamos) */
export type RawChange = {
  changeId?: number
  newMmr?: number
  mmrDelta?: number
  reason?: string
  time?: string
  score?: number
  partnerScores?: number[]
  rank?: number
  tier?: string
  numTeams?: number
  numPlayers?: number
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Convierte la respuesta de la API. Descarta lo que no tiene identificador (p. ej. la colocación inicial) */
export function parseChanges(raw: RawChange[] | null | undefined, season: number): LoungeChange[] {
  const out: LoungeChange[] = []
  for (const c of raw ?? []) {
    if (!isNum(c.changeId) || !isNum(c.newMmr) || !isNum(c.mmrDelta) || typeof c.time !== 'string' || !c.reason) continue
    if (Number.isNaN(Date.parse(c.time))) continue
    out.push({
      changeId: c.changeId,
      season,
      time: c.time,
      newMmr: c.newMmr,
      delta: c.mmrDelta,
      reason: c.reason,
      score: isNum(c.score) ? c.score : null,
      partnerScores: (c.partnerScores ?? []).filter(isNum),
      rank: isNum(c.rank) ? c.rank : null,
      tier: c.tier ?? null,
      numTeams: isNum(c.numTeams) ? c.numTeams : null,
      numPlayers: isNum(c.numPlayers) ? c.numPlayers : null,
    })
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.changeId - b.changeId)
}

// ───────────────────────── Verificación ─────────────────────────

/**
 * Puntuación de un evento de 12 carreras a partir de las posiciones del jugador.
 * null si no son exactamente 12 carreras o hay una posición que no existe en 12p (no se puede cruzar con el Lounge).
 */
export function eventScore(positions: number[]): number | null {
  if (positions.length !== LOUNGE_RACES) return null
  let total = 0
  for (const p of positions) {
    const pts = POINTS[p - 1]
    if (!Number.isInteger(p) || pts === undefined) return null
    total += pts
  }
  return total
}

const MIN = 60_000
const HOUR = 3_600_000

/**
 * Ventanas de tiempo para cruzar un evento con el Lounge. El evento solo declara el DÍA (el bot y la web pueden estar en
 * zonas horarias distintas), así que la ventana cubre ese día en cualquier zona (UTC-14 a UTC+14) más el retraso de la mesa:
 * el cambio de MMR llega al verificarse, entre unos minutos y un día después de jugar.
 */
export const ZONE_SLACK_MS = 14 * HOUR
export const LOUNGE_LAG_MS = 25 * HOUR
/**
 * Eventos sin día declarado: se crean al empezar a jugar, así que la mesa se verifica después de crearse el evento. Un margen
 * mayor por detrás daba falsos positivos (la misma puntuación en una mesa de días antes).
 */
export const LEGACY_BACK_MS = 6 * HOUR
/** Mesas SQ 6v6: se crean al empezar, así que el retraso es corto */
export const TABLE_LAG_MS = 3 * HOUR

export type LoungeCandidate = {
  id: string
  /** Puntuación total del jugador (ver eventScore) */
  score: number
  /** Día jugado declarado (AAAA-MM-DD); null en los eventos antiguos */
  playedOn: string | null
  createdAt: string
}

/** Instante de referencia y ventana [desde, hasta] (ms) en la que debe caer la hora de la mesa */
function windowOf(playedOn: string | null, createdAt: string, lag: number): [ref: number, from: number, to: number] {
  if (playedOn) {
    const start = Date.parse(`${playedOn}T00:00:00Z`)
    return [start + 12 * HOUR, start - ZONE_SLACK_MS, start + 24 * HOUR + ZONE_SLACK_MS + lag]
  }
  const ref = Date.parse(createdAt)
  return [ref, ref - LEGACY_BACK_MS, ref + lag]
}

/**
 * Asocia cada evento Lounge con el cambio de MMR que lo respalda: misma puntuación, dentro de la ventana de tiempo, y
 * cada cambio sirve para un solo evento. Se prefiere el más cercano a la hora de referencia. `taken` = cambios ya usados.
 */
export function matchLoungeEvents(
  candidates: LoungeCandidate[],
  changes: LoungeChange[],
  taken: Iterable<number> = [],
): Map<string, LoungeChange> {
  const used = new Set(taken)
  const tables = changes.filter((c) => c.reason === 'Table' && c.score !== null)
  const out = new Map<string, LoungeChange>()
  const ordered = [...candidates].sort((a, b) => Date.parse(a.playedOn ?? a.createdAt) - Date.parse(b.playedOn ?? b.createdAt))
  for (const cand of ordered) {
    const [ref, from, to] = windowOf(cand.playedOn, cand.createdAt, LOUNGE_LAG_MS)
    let best: LoungeChange | null = null
    let bestDist = Infinity
    for (const c of tables) {
      if (used.has(c.changeId) || c.score !== cand.score) continue
      const at = Date.parse(c.time)
      if (at < from || at > to) continue
      const dist = Math.abs(at - ref)
      if (dist < bestDist) {
        best = c
        bestDist = dist
      }
    }
    if (best) {
      used.add(best.changeId)
      out.set(cand.id, best)
    }
  }
  return out
}

export type LoungeTable = {
  id: number
  createdOn: string
  verifiedOn?: string | null
  tier: string | null
  numTeams: number
  numPlayers: number
  teams: { rank: number; scores: { score: number; playerId?: number }[] }[]
}

/** Imagen oficial de una mesa del Lounge */
export const loungeTableImage = (tableId: number) => `https://lounge.mkcentral.com/TableImage/${tableId}.png`

/** Margen entre la hora del cambio de MMR y la verificación de la mesa */
const TABLE_CHANGE_TOLERANCE_MS = 10 * MIN

/**
 * La mesa de la que salió un cambio de MMR: la que tiene al jugador con esa misma puntuación y se verificó a la hora del
 * cambio (el MMR se aplica al verificar la mesa).
 */
export function findTableForChange(change: LoungeChange, playerId: number, tables: LoungeTable[]): LoungeTable | null {
  const at = Date.parse(change.time)
  let best: LoungeTable | null = null
  let bestDist = Infinity
  for (const t of tables) {
    if (!t.teams.some((tm) => tm.scores.some((s) => s.playerId === playerId && s.score === change.score))) continue
    const dist = Math.abs(Date.parse(t.verifiedOn ?? t.createdOn) - at)
    if (dist <= TABLE_CHANGE_TOLERANCE_MS && dist < bestDist) {
      best = t
      bestDist = dist
    }
  }
  return best
}

export type WarCandidate = {
  id: string
  /** Puntuación total de cada uno de los 6 jugadores de nuestro equipo */
  playerScores: number[]
  playedOn: string | null
  createdAt: string
}

const sortedKey = (xs: number[]) => [...xs].sort((a, b) => a - b).join(',')

/**
 * Asocia una war con una mesa SQ 6v6 del Lounge (dos equipos de 6): alguno de los dos equipos tiene exactamente las
 * mismas puntuaciones individuales que nuestros 6 jugadores, y la mesa se creó a la hora jugada.
 */
export function matchWars(candidates: WarCandidate[], tables: LoungeTable[]): Map<string, LoungeTable> {
  const sixVsSix = tables.filter((t) => t.numTeams === 2 && t.numPlayers === 12 && t.teams.every((tm) => tm.scores.length === 6))
  const out = new Map<string, LoungeTable>()
  for (const cand of candidates) {
    if (cand.playerScores.length !== 6) continue
    const key = sortedKey(cand.playerScores)
    const [ref, from, to] = windowOf(cand.playedOn, cand.createdAt, TABLE_LAG_MS)
    let best: LoungeTable | null = null
    let bestDist = Infinity
    for (const t of sixVsSix) {
      if (!t.teams.some((tm) => sortedKey(tm.scores.map((s) => s.score)) === key)) continue
      const at = Date.parse(t.createdOn)
      if (at < from || at > to) continue
      const dist = Math.abs(at - ref)
      if (dist < bestDist) {
        best = t
        bestDist = dist
      }
    }
    if (best) {
      out.set(cand.id, best)
    }
  }
  return out
}

// ───────────────────────── Estadísticas ─────────────────────────

export type LoungeFormat = 'ffa' | 'duo' | 'trio' | 'squad' | 'war'

/** Formato de la mesa según el número de equipos de una mesa de 12 jugadores */
export function formatOf(numTeams: number | null): LoungeFormat | null {
  switch (numTeams) {
    case 12:
      return 'ffa'
    case 6:
      return 'duo'
    case 4:
      return 'trio'
    case 3:
      return 'squad'
    case 2:
      return 'war'
    default:
      return null
  }
}

export const FORMATS: LoungeFormat[] = ['ffa', 'duo', 'trio', 'squad', 'war']

/** Mínimo de mesas para sacar conclusiones de un grupo (mejor hora, mejor día...) */
export const MIN_GROUP = 5

export type Group = { key: string; tables: number; avgScore: number; avgDelta: number; winRate: number }

export type PartnerStats = { tables: number; avgScore: number; avgPartnerScore: number; diff: number }

/** Tu media frente a la de tus compañeros en las mesas por equipos de la lista (null si no hay ninguna) */
function partnerOf(rows: LoungeChange[]): PartnerStats | null {
  const team = rows.filter((t) => t.score !== null && t.partnerScores.length > 0)
  if (team.length === 0) return null
  const own = mean(team.map((t) => t.score as number))
  const partner = mean(team.map((t) => mean(t.partnerScores)))
  return { tables: team.length, avgScore: round1(own), avgPartnerScore: round1(partner), diff: round1(own - partner) }
}

export type LoungeStats = {
  tables: number
  mmr: number
  peak: { mmr: number; time: string }
  low: { mmr: number; time: string }
  /** MMR ganado o perdido en total (suma de todos los cambios del periodo) */
  net: number
  wins: number
  losses: number
  winRate: number
  avgScore: number
  /** Media sin contar las SQ (como en la web del Lounge) */
  noSqAvgScore: number | null
  sqAvgScore: number | null
  bestScore: { score: number; time: string } | null
  worstScore: { score: number; time: string } | null
  bestGain: LoungeChange | null
  worstLoss: LoungeChange | null
  /** Rachas de mesas ganando MMR */
  streak: { current: number; best: number }
  lastTen: { wins: number; losses: number; gain: number; avgScore: number } | null
  /** Tu puntuación frente a la media de tus compañeros de equipo (solo mesas por equipos) */
  /** Tu puntuación frente a la media de tus compañeros en las mesas por equipos: todas juntas, solo SQ y solo Lounge (sin SQ) */
  partnerSplit: { all: PartnerStats | null; sq: PartnerStats | null; lounge: PartnerStats | null }
  byFormat: Group[]
  byTier: Group[]
  /** Mesas por semana (lunes UTC) de las últimas 12 semanas con actividad */
  weekly: { week: string; tables: number; delta: number }[]
  byWeekday: Group[]
  byHour: Group[]
  /** Posición media en la mesa (1 = primero) */
  avgRank: number | null
}

function group(key: string, rows: LoungeChange[]): Group {
  const scored = rows.filter((r) => r.score !== null)
  return {
    key,
    tables: rows.length,
    avgScore: round1(mean(scored.map((r) => r.score as number))),
    avgDelta: round1(mean(rows.map((r) => r.delta))),
    winRate: rows.length ? Math.round((rows.filter((r) => r.delta > 0).length / rows.length) * 100) : 0,
  }
}

const byKey = (rows: LoungeChange[], keyOf: (c: LoungeChange) => string | null) => {
  const m = new Map<string, LoungeChange[]>()
  for (const r of rows) {
    const k = keyOf(r)
    if (k !== null) m.set(k, [...(m.get(k) ?? []), r])
  }
  return m
}

/** Lunes (UTC) de la semana de una fecha, como YYYY-MM-DD */
export function weekStart(iso: string): string {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

/**
 * Estadísticas de un periodo del historial de MMR. `changes` = cambios ya filtrados (una temporada o todas); solo las
 * mesas (reason 'Table') cuentan como partidas. `tzOffsetMin` = minutos que hay que sumar a UTC para la hora local.
 */
export function computeLoungeStats(changes: LoungeChange[], tzOffsetMin = 0): LoungeStats | null {
  const sorted = [...changes].sort((a, b) => a.time.localeCompare(b.time) || a.changeId - b.changeId)
  const tables = sorted.filter((c) => c.reason === 'Table')
  if (tables.length === 0) return null

  const scored = tables.filter((t) => t.score !== null)
  const sq = scored.filter((t) => t.tier === 'SQ')
  const noSq = scored.filter((t) => t.tier !== 'SQ')
  const peak = sorted.reduce((a, c) => (c.newMmr > a.newMmr ? c : a), sorted[0])
  const low = sorted.reduce((a, c) => (c.newMmr < a.newMmr ? c : a), sorted[0])
  const wins = tables.filter((t) => t.delta > 0).length

  let current = 0
  let best = 0
  for (const t of tables) {
    current = t.delta > 0 ? current + 1 : 0
    best = Math.max(best, current)
  }

  const last = tables.slice(-10)
  const lastScored = last.filter((t) => t.score !== null)
  const bestScore = scored.reduce<LoungeChange | null>((a, c) => (!a || (c.score as number) > (a.score as number) ? c : a), null)
  const worstScore = scored.reduce<LoungeChange | null>((a, c) => (!a || (c.score as number) < (a.score as number) ? c : a), null)
  const ranked = tables.filter((t) => t.rank !== null)

  const weeks = [...byKey(tables, (t) => weekStart(t.time))].sort(([a], [b]) => a.localeCompare(b)).slice(-12)
  const local = (iso: string) => new Date(Date.parse(iso) + tzOffsetMin * MIN)

  return {
    tables: tables.length,
    mmr: sorted[sorted.length - 1].newMmr,
    peak: { mmr: peak.newMmr, time: peak.time },
    low: { mmr: low.newMmr, time: low.time },
    net: sorted.reduce((a, c) => a + c.delta, 0),
    wins,
    losses: tables.length - wins,
    winRate: Math.round((wins / tables.length) * 100),
    avgScore: round1(mean(scored.map((t) => t.score as number))),
    noSqAvgScore: noSq.length ? round1(mean(noSq.map((t) => t.score as number))) : null,
    sqAvgScore: sq.length ? round1(mean(sq.map((t) => t.score as number))) : null,
    bestScore: bestScore ? { score: bestScore.score as number, time: bestScore.time } : null,
    worstScore: worstScore ? { score: worstScore.score as number, time: worstScore.time } : null,
    bestGain: tables.reduce<LoungeChange | null>((a, c) => (c.delta > 0 && (!a || c.delta > a.delta) ? c : a), null),
    worstLoss: tables.reduce<LoungeChange | null>((a, c) => (c.delta < 0 && (!a || c.delta < a.delta) ? c : a), null),
    streak: { current, best },
    lastTen:
      last.length >= 3
        ? {
            wins: last.filter((t) => t.delta > 0).length,
            losses: last.filter((t) => t.delta <= 0).length,
            gain: last.reduce((a, t) => a + t.delta, 0),
            avgScore: round1(mean(lastScored.map((t) => t.score as number))),
          }
        : null,
    partnerSplit: {
      all: partnerOf(tables),
      sq: partnerOf(tables.filter((t) => t.tier === 'SQ')),
      lounge: partnerOf(tables.filter((t) => t.tier !== 'SQ')),
    },
    byFormat: FORMATS.flatMap((f) => {
      const rows = tables.filter((t) => formatOf(t.numTeams) === f)
      return rows.length ? [group(f, rows)] : []
    }),
    byTier: [...byKey(tables, (t) => t.tier)].map(([k, rows]) => group(k, rows)).sort((a, b) => b.tables - a.tables),
    weekly: weeks.map(([week, rows]) => ({ week, tables: rows.length, delta: rows.reduce((a, r) => a + r.delta, 0) })),
    byWeekday: [...byKey(tables, (t) => String(local(t.time).getUTCDay()))].map(([k, rows]) => group(k, rows)).sort((a, b) => Number(a.key) - Number(b.key)),
    byHour: [...byKey(tables, (t) => String(local(t.time).getUTCHours()))].map(([k, rows]) => group(k, rows)).sort((a, b) => Number(a.key) - Number(b.key)),
    avgRank: ranked.length ? round1(mean(ranked.map((t) => t.rank as number))) : null,
  }
}

/** Mejor grupo (con suficientes mesas) por variación media de MMR */
export function bestGroup(groups: Group[]): Group | null {
  return groups.filter((g) => g.tables >= MIN_GROUP).reduce<Group | null>((a, g) => (!a || g.avgDelta > a.avgDelta ? g : a), null)
}

export type MmrPoint = { time: string; mmr: number; season: number; delta: number }

/** Puntos de la gráfica de MMR: un punto por cambio, en orden cronológico */
export function mmrSeries(changes: LoungeChange[]): MmrPoint[] {
  return [...changes]
    .sort((a, b) => a.time.localeCompare(b.time) || a.changeId - b.changeId)
    .map((c) => ({ time: c.time, mmr: c.newMmr, season: c.season, delta: c.delta }))
}

/** Percentil superior (1 = el mejor) a partir del puesto y el total de jugadores */
export function topPercent(rank: number | null, total: number | null): number | null {
  if (!rank || !total || rank > total) return null
  return Math.max(0.1, Math.round((rank / total) * 1000) / 10)
}
