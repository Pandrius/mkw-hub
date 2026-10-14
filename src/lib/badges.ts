import type { TimedResult } from './form.js'

/** 0 = sin insignia; 1 bronce, 2 plata, 3 oro, 4 platino */
export type Tier = 0 | 1 | 2 | 3 | 4

/** Carreras en una misma pista para cada nivel */
export const TRACK_TIERS = [25, 100, 250, 500]
/** Carreras totales para cada nivel */
export const RACE_TIERS = [50, 250, 1000, 2500]
/** Eventos finalizados para cada nivel */
export const EVENT_TIERS = [5, 25, 100, 250]

export type Progress = {
  count: number
  tier: Tier
  /** Cantidad necesaria para el siguiente nivel (null si ya está en el máximo) */
  next: number | null
}

export type TrackBadge = Progress & { trackId: string }

export type BadgeSet = {
  races: Progress
  events: Progress
  /** Pistas distintas jugadas; sus niveles son 25 %, 50 %, 75 % y 100 % de las pistas del juego */
  explorer: Progress
  /** Insignias por pista (solo las que ya tienen nivel), de más a menos carreras */
  tracks: TrackBadge[]
  /** Pista con más carreras, aunque aún no tenga nivel */
  mostPlayed: { trackId: string; races: number } | null
}

/** Nivel alcanzado con `count` y lo que falta para el siguiente */
export function progressOf(count: number, thresholds: number[]): Progress {
  const tier = thresholds.filter((t) => count >= t).length as Tier
  return { count, tier, next: thresholds[tier] ?? null }
}

/**
 * Insignias por volumen de juego a partir de todas las carreras de eventos finalizados (War y Lounge).
 * Premian jugar mucho, no jugar bien: no dependen de las posiciones.
 */
export function computeBadges(timeline: TimedResult[], totalTracks: number): BadgeSet {
  const perTrack = new Map<string, number>()
  const events = new Set<string>()
  for (const r of timeline) {
    perTrack.set(r.trackId, (perTrack.get(r.trackId) ?? 0) + 1)
    events.add(r.eventId)
  }
  const sorted = [...perTrack.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const explorerTiers = [0.25, 0.5, 0.75, 1].map((f) => Math.ceil(totalTracks * f))
  return {
    races: progressOf(timeline.length, RACE_TIERS),
    events: progressOf(events.size, EVENT_TIERS),
    explorer: progressOf(perTrack.size, explorerTiers),
    tracks: sorted.map(([trackId, n]) => ({ trackId, ...progressOf(n, TRACK_TIERS) })).filter((b) => b.tier > 0),
    mostPlayed: sorted[0] ? { trackId: sorted[0][0], races: sorted[0][1] } : null,
  }
}
