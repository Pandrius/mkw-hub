import { POINTS } from './scoring.js'

/**
 * Ranking de equipos en cada pista (función pura): qué equipo rinde mejor en cada pista según sus wars finalizadas. Se ordena por
 * la diferencia de puntos por carrera frente al rival (+/-) ajustada: con pocas carreras se acerca a 0, como en el recomendador de
 * picks, para que una sola carrera buena no ponga a un equipo arriba del todo.
 */
export type TeamWarInput = {
  id: string
  teamId: number
  opponentTeamId: number | null
  /** Si es la copia que subió el rival al validar una war, la war original */
  mirrorOf: string | null
  races: { trackId: string; section: boolean; missingHome: number; missingAway: number; positions: number[] }[]
}
export type TeamTrackEntry = { teamId: number; tag: string; name: string; races: number; /** +/- medio por carrera */ avg: number; /** +/- ajustado (con lo que se ordena) */ adj: number }

/** Carreras mínimas de un equipo en la pista para salir en su ranking */
export const TEAM_MIN_RACES = 3
/** Carreras «ficticias» a 0 que se suman al ajustar */
export const TEAM_PRIOR = 3
/** Equipos que se guardan por pista */
export const TEAM_BOARD_SIZE = 30

const round2 = (n: number) => Math.round(n * 100) / 100

/** Puntos del equipo menos los del rival en una carrera: los nuestros son los de nuestras posiciones, los del rival los de las que quedan y cada ausente suma 1 a su equipo */
export function raceDiff(r: { missingHome: number; missingAway: number; positions: number[] }): number {
  const racers = 12 - r.missingHome - r.missingAway
  const taken = new Set(r.positions)
  let home = r.missingHome
  let away = r.missingAway
  for (let p = 1; p <= racers; p++) {
    if (taken.has(p)) home += POINTS[p - 1] ?? 0
    else away += POINTS[p - 1] ?? 0
  }
  return home - away
}

export function buildTeamTrackBoards(wars: TeamWarInput[], teams: Map<number, { tag: string; name: string }>, size = TEAM_BOARD_SIZE): Record<string, TeamTrackEntry[]> {
  // Cada war cuenta para quien la apunta y, si el rival está registrado y no subió su propia copia, también para el rival (al revés)
  const copied = new Set(wars.map((w) => w.mirrorOf).filter((id): id is string => !!id))
  const sums = new Map<string, Map<number, { n: number; diff: number }>>() // pista → equipo → suma
  const credit = (teamId: number, trackId: string, diff: number) => {
    if (!teams.has(teamId)) return
    const byTeam = sums.get(trackId) ?? sums.set(trackId, new Map()).get(trackId)!
    const cur = byTeam.get(teamId) ?? { n: 0, diff: 0 }
    byTeam.set(teamId, { n: cur.n + 1, diff: cur.diff + diff })
  }
  for (const w of wars) {
    const mirrored = w.opponentTeamId !== null && w.opponentTeamId !== w.teamId && w.mirrorOf === null && !copied.has(w.id)
    for (const r of w.races) {
      if (r.section) continue
      const d = raceDiff(r)
      credit(w.teamId, r.trackId, d)
      if (mirrored) credit(w.opponentTeamId!, r.trackId, -d)
    }
  }

  const out: Record<string, TeamTrackEntry[]> = {}
  for (const [trackId, byTeam] of sums) {
    const entries = [...byTeam]
      .filter(([, v]) => v.n >= TEAM_MIN_RACES)
      .map(([teamId, v]): TeamTrackEntry => ({ teamId, tag: teams.get(teamId)!.tag, name: teams.get(teamId)!.name, races: v.n, avg: round2(v.diff / v.n), adj: round2(v.diff / (v.n + TEAM_PRIOR)) }))
      .sort((a, b) => b.adj - a.adj || b.races - a.races || a.teamId - b.teamId)
      .slice(0, size)
    if (entries.length > 0) out[trackId] = entries
  }
  return out
}
