import { mean, pct, PHASES, phaseOf, recordOf, round1, stdDev, type Phase, type Record3 } from './statMath'
import type { WarTable } from './warTable'

export type WarPlayerLine = {
  name: string
  races: number
  points: number
  /** Puntos llevados a 12 carreras (para quien no las jugó todas) */
  perWar: number
  avgPos: number
  best: number
  worst: number
  /** Desviación típica de sus posiciones */
  sdPos: number
  /** % de los puntos de su equipo en las carreras que corrió */
  share: number
  /** Carreras en las que fue el mejor clasificado de su equipo */
  leads: number
  podiums: number
}

export type WarAnalytics = {
  races: number
  raceRecord: Record3
  /** Mayor ventaja y mayor desventaja durante la war, y tras qué carrera */
  maxLead: { value: number; raceNo: number } | null
  maxDeficit: { value: number; raceNo: number } | null
  /** Veces que cambió el equipo que iba por delante */
  leadChanges: number
  bestRace: { raceNo: number; trackId: string; diff: number } | null
  worstRace: { raceNo: number; trackId: string; diff: number } | null
  phases: Record<Phase, { races: number; diff: number } | null>
  /** Cuántas veces terminó cada equipo en cada posición (índice 0 = 1.º) */
  positions: { home: number[]; away: number[] }
  /** Posición media de cada equipo */
  avgPos: { home: number; away: number }
  /** Media de jugadores propios entre los 6 primeros por carrera */
  top6PerRace: number
  homePlayers: WarPlayerLine[]
  awayPlayers: WarPlayerLine[]
}

function playerLines(
  rows: { name: string; points: number; races: number; positions: Record<number, number> }[],
  teamPointsByRace: Map<number, number>,
  bestByRace: Map<number, number>,
): WarPlayerLine[] {
  return rows
    .filter((p) => p.races > 0)
    .map((p) => {
      const entries = Object.entries(p.positions).map(([raceNo, pos]) => ({ raceNo: Number(raceNo), pos }))
      const ps = entries.map((e) => e.pos)
      const teamPts = entries.reduce((acc, e) => acc + (teamPointsByRace.get(e.raceNo) ?? 0), 0)
      return {
        name: p.name,
        races: p.races,
        points: p.points,
        perWar: Math.round((p.points / p.races) * 12),
        avgPos: round1(mean(ps)),
        best: Math.min(...ps),
        worst: Math.max(...ps),
        sdPos: round1(stdDev(ps)),
        share: teamPts ? round1((p.points / teamPts) * 100) : 0,
        leads: entries.filter((e) => bestByRace.get(e.raceNo) === e.pos).length,
        podiums: ps.filter((x) => x <= 3).length,
      }
    })
    .sort((a, b) => b.points - a.points)
}

/** Análisis interno de una war a partir de su tabla (función pura). Null si aún no hay carreras. */
export function computeWarAnalytics(table: WarTable): WarAnalytics | null {
  const rows = table.races
  if (!rows.length) return null

  let maxLead: WarAnalytics['maxLead'] = null
  let maxDeficit: WarAnalytics['maxDeficit'] = null
  let leadChanges = 0
  let leader = 0
  for (const r of rows) {
    if (r.runningDiff > 0 && (!maxLead || r.runningDiff > maxLead.value)) maxLead = { value: r.runningDiff, raceNo: r.race.race_no }
    if (r.runningDiff < 0 && (!maxDeficit || r.runningDiff < maxDeficit.value)) maxDeficit = { value: r.runningDiff, raceNo: r.race.race_no }
    const sign = Math.sign(r.runningDiff)
    if (sign !== 0 && leader !== 0 && sign !== leader) leadChanges++
    if (sign !== 0) leader = sign
  }

  const toRace = (r: (typeof rows)[number]) => ({ raceNo: r.race.race_no, trackId: r.race.track_id, diff: r.diff })
  const best = rows.reduce((a, b) => (b.diff > a.diff ? b : a))
  const worst = rows.reduce((a, b) => (b.diff < a.diff ? b : a))

  const phases = Object.fromEntries(
    PHASES.map((ph) => {
      const rs = rows.filter((r) => phaseOf(r.race.race_no) === ph)
      return [ph, rs.length ? { races: rs.length, diff: rs.reduce((acc, r) => acc + r.diff, 0) } : null]
    }),
  ) as WarAnalytics['phases']

  // Posiciones de cada equipo: las propias están guardadas; las del rival son las que quedan
  const home = Array<number>(12).fill(0)
  const away = Array<number>(12).fill(0)
  const homeAll: number[] = []
  const awayAll: number[] = []
  let top6 = 0
  const homeBest = new Map<number, number>()
  const awayBest = new Map<number, number>()
  const awayPts = new Map<number, number>()
  const homePts = new Map<number, number>()
  for (const r of rows) {
    const racers = 12 - r.race.missing_home - r.race.missing_away
    const mine = new Set(r.race.race_results.map((x) => x.position))
    const theirs: number[] = []
    for (let p = 1; p <= racers; p++) {
      if (mine.has(p)) {
        home[p - 1]++
        homeAll.push(p)
        if (p <= 6) top6++
      } else {
        away[p - 1]++
        awayAll.push(p)
        theirs.push(p)
      }
    }
    homeBest.set(r.race.race_no, Math.min(...mine))
    awayBest.set(r.race.race_no, Math.min(...theirs))
    homePts.set(r.race.race_no, r.home)
    awayPts.set(r.race.race_no, r.away)
  }

  return {
    races: rows.length,
    raceRecord: recordOf(rows.map((r) => r.diff)),
    maxLead,
    maxDeficit,
    leadChanges,
    bestRace: best.diff > 0 ? toRace(best) : null,
    worstRace: worst.diff < 0 ? toRace(worst) : null,
    phases,
    positions: { home, away },
    avgPos: { home: round1(mean(homeAll)), away: round1(mean(awayAll)) },
    top6PerRace: round1(top6 / rows.length),
    homePlayers: playerLines(
      table.players.map((p) => ({ name: p.player.name, points: p.points, races: p.races, positions: p.positions })),
      homePts,
      homeBest,
    ),
    // Los rivales solo se conocen si se apuntaron sus posiciones (si no, el reparto es automático y no dice nada)
    awayPlayers: rows.every((r) => r.race.opponent_results?.length) ? playerLines(table.opponentPlayers, awayPts, awayBest) : [],
  }
}

/** Porcentaje de carreras ganadas */
export const raceWinRate = (a: WarAnalytics) => pct(a.raceRecord.w, a.races)
