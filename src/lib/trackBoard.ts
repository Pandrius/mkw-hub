import type { TimedResult } from './form.js'
import { periodStart } from './communityBoard.js'
import { POINTS } from './scoring.js'

/**
 * Ranking de cada pista (función pura): quién es el mejor en ella según los eventos verificados, en todo el tiempo y en la semana
 * en curso (desde el lunes, UTC). Se ordena por puntos por carrera ajustados: con pocas carreras se acercan a la media de la
 * pista (la de todo el tiempo, entre todos los jugadores), como los puntos ajustados de las estadísticas, así que una racha corta
 * no basta para quitarle la pista a quien lleva mucho tiempo bien. Los tramos no cuentan como pista.
 */
export type TrackEntry = { profileId: string; races: number; /** Puntos por carrera sin ajustar */ avg: number; /** Puntos por carrera ajustados (con lo que se ordena) */ adj: number }
export type TrackBoards = {
  /** Mejores de cada pista en todo el tiempo (con al menos ALL_MIN_RACES carreras en ella) */
  all: Record<string, TrackEntry[]>
  /** Mejores de cada pista esta semana (con al menos WEEK_MIN_RACES carreras en ella esta semana) */
  week: Record<string, TrackEntry[]>
}

/** Carreras mínimas en la pista para entrar en su ranking de todo el tiempo y en el de la semana */
export const ALL_MIN_RACES = 20
export const WEEK_MIN_RACES = 5
/** Carreras «ficticias» a la media de la pista que se suman al ajustar: más peso en todo el tiempo que en la semana */
export const ALL_PRIOR = 10
export const WEEK_PRIOR = 3
/** Jugadores que se guardan por pista */
export const TRACK_BOARD_SIZE = 50

const round2 = (n: number) => Math.round(n * 100) / 100
const pointsOf = (position: number) => POINTS[position - 1] ?? 0

type Sum = { n: number; s: number }
const add = (map: Map<string, Sum>, key: string, pts: number) => {
  const cur = map.get(key) ?? { n: 0, s: 0 }
  map.set(key, { n: cur.n + 1, s: cur.s + pts })
}

export function buildTrackBoards(players: { id: string; timeline: TimedResult[] }[], now: Date, size = TRACK_BOARD_SIZE): TrackBoards {
  const weekFrom = periodStart('week', now)!
  const global = new Map<string, Sum>()
  const allBy = new Map<string, Map<string, Sum>>() // pista → jugador → suma
  const weekBy = new Map<string, Map<string, Sum>>()

  for (const p of players) {
    for (const r of p.timeline) {
      if (r.section) continue
      const pts = pointsOf(r.position)
      add(global, r.trackId, pts)
      add(allBy.get(r.trackId) ?? allBy.set(r.trackId, new Map()).get(r.trackId)!, p.id, pts)
      if (r.date >= weekFrom) add(weekBy.get(r.trackId) ?? weekBy.set(r.trackId, new Map()).get(r.trackId)!, p.id, pts)
    }
  }

  const rank = (by: Map<string, Map<string, Sum>>, minRaces: number, prior: number): Record<string, TrackEntry[]> => {
    const out: Record<string, TrackEntry[]> = {}
    for (const [trackId, perPlayer] of by) {
      const g = global.get(trackId)!
      const mean = g.s / g.n
      const entries = [...perPlayer]
        .filter(([, v]) => v.n >= minRaces)
        .map(([profileId, v]): TrackEntry => ({ profileId, races: v.n, avg: round2(v.s / v.n), adj: round2((v.s + prior * mean) / (v.n + prior)) }))
        .sort((a, b) => b.adj - a.adj || b.races - a.races || a.profileId.localeCompare(b.profileId))
        .slice(0, size)
      if (entries.length > 0) out[trackId] = entries
    }
    return out
  }

  return { all: rank(allBy, ALL_MIN_RACES, ALL_PRIOR), week: rank(weekBy, WEEK_MIN_RACES, WEEK_PRIOR) }
}

/** Pistas en las que un jugador es el primero de la clasificación: de todo el tiempo (Dueño) y de la semana */
export function tracksLedBy(boards: TrackBoards | null | undefined, profileId: string): { owned: string[]; weekly: string[] } {
  const led = (b: Record<string, TrackEntry[]> | undefined) => Object.entries(b ?? {}).filter(([, e]) => e[0]?.profileId === profileId).map(([t]) => t)
  return { owned: led(boards?.all), weekly: led(boards?.week) }
}
