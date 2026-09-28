import type { EventKind, PlayerResult } from './events'

export type StatsFilter = 'all' | EventKind

export type TrackStats = { trackId: string; races: number; average: number; best: number }

export type Stats = {
  races: number
  events: number
  average: number | null
  tracks: TrackStats[]
}

/** Carreras mínimas en una pista para que su media cuente como fiable (mejores/peores pistas) */
export const MIN_RACES_RELIABLE = 3

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeStats(results: PlayerResult[], filter: StatsFilter): Stats {
  const rows = filter === 'all' ? results : results.filter((r) => r.kind === filter)
  const byTrack = new Map<string, number[]>()
  for (const r of rows) byTrack.set(r.track_id, [...(byTrack.get(r.track_id) ?? []), r.position])

  const tracks = [...byTrack.entries()]
    .map(([trackId, positions]) => ({
      trackId,
      races: positions.length,
      average: round2(positions.reduce((a, b) => a + b, 0) / positions.length),
      best: Math.min(...positions),
    }))
    .sort((a, b) => a.average - b.average || b.races - a.races)

  return {
    races: rows.length,
    events: new Set(rows.map((r) => r.event_id)).size,
    average: rows.length ? round2(rows.reduce((a, r) => a + r.position, 0) / rows.length) : null,
    tracks,
  }
}

/** Mejores y peores pistas entre las que tienen datos suficientes */
export function bestAndWorst(stats: Stats, n = 3): { best: TrackStats[]; worst: TrackStats[] } {
  const reliable = stats.tracks.filter((t) => t.races >= MIN_RACES_RELIABLE)
  const best = reliable.slice(0, n)
  const worst = reliable
    .slice()
    .reverse()
    .filter((t) => !best.includes(t))
    .slice(0, n)
  return { best, worst }
}
