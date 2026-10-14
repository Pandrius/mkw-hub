import { MIN_TRACK_RACES, type PlayerAnalytics } from './playerAnalytics'
import { round2 } from './statMath'

/** Una pista vista desde los dos jugadores (a = quien mira, b = con quien se compara) */
export type TrackDuel = {
  trackId: string
  aRaces: number
  bRaces: number
  aPoints: number
  bPoints: number
  aPos: number
  bPos: number
  /** Puntos por carrera de a menos los de b: positivo = a es mejor en esta pista */
  diff: number
}

export type PlayerComparison = {
  /** Pistas con carreras suficientes de los dos, de mayor a menor ventaja de a */
  duels: TrackDuel[]
  /** Pistas donde a rinde mejor que b (más ventaja primero) */
  aBetter: TrackDuel[]
  /** Pistas donde b rinde mejor que a (más ventaja primero) */
  bBetter: TrackDuel[]
}

/** Margen (puntos por carrera) por debajo del cual se considera empate */
export const DUEL_TIE = 0.25
/** Pistas que se destacan en cada lado */
export const DUEL_TOP = 5

/** Compara pista a pista a dos jugadores; solo cuentan las pistas con `minRaces` carreras de cada uno. Función pura. */
export function comparePlayers(a: PlayerAnalytics, b: PlayerAnalytics, minRaces = MIN_TRACK_RACES): PlayerComparison {
  const bTracks = new Map(b.tracks.map((tr) => [tr.trackId, tr]))
  const duels: TrackDuel[] = []
  for (const ta of a.tracks) {
    const tb = bTracks.get(ta.trackId)
    if (!tb || ta.races < minRaces || tb.races < minRaces) continue
    duels.push({
      trackId: ta.trackId,
      aRaces: ta.races,
      bRaces: tb.races,
      aPoints: ta.avgPoints,
      bPoints: tb.avgPoints,
      aPos: ta.avgPos,
      bPos: tb.avgPos,
      diff: round2(ta.avgPoints - tb.avgPoints),
    })
  }
  duels.sort((x, y) => y.diff - x.diff || x.trackId.localeCompare(y.trackId))
  return {
    duels,
    aBetter: duels.filter((d) => d.diff >= DUEL_TIE).slice(0, DUEL_TOP),
    bBetter: duels
      .filter((d) => d.diff <= -DUEL_TIE)
      .reverse()
      .slice(0, DUEL_TOP),
  }
}
