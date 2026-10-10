import { penaltyTotals } from './penalties'
import { mean, pct, PHASES, phaseOf, recordOf, round1, type Phase, type Record3 } from './statMath'
import { raceScore, rivalKeyOf, type TeamWar } from './teamStats'

/** Una war resumida desde el punto de vista del equipo */
export type WarSummary = {
  eventId: string
  date: string
  opponent: string
  opponentKey: string
  home: number
  away: number
  diff: number
  result: 'W' | 'L' | 'T'
  /** Diferencia acumulada tras cada carrera (las penalties cuentan en la última) */
  running: number[]
  races: { raceNo: number; trackId: string; diff: number }[]
}

/** Diferencia final máxima para considerar una war "ajustada" */
export const CLOSE_MARGIN = 20
/** Carrera tras la que se mide quién iba por delante (mitad de la war) */
export const HALFTIME_RACE = 6
/** Wars de la forma reciente */
export const RECENT_WARS = 5

export function summarizeWar(war: TeamWar): WarSummary {
  let home = 0
  let away = 0
  const running: number[] = []
  const races = [...war.races]
    .sort((a, b) => a.race_no - b.race_no)
    .map((r) => {
      const s = raceScore(r)
      home += s.home
      away += s.away
      running.push(home - away)
      return { raceNo: r.race_no, trackId: r.track_id, diff: s.home - s.away }
    })
  // Las penalties cuentan al final de la war: afectan al resultado y a la última diferencia acumulada
  const pen = penaltyTotals(war.penalties)
  if (pen.home || pen.away) {
    home += pen.home
    away += pen.away
    if (running.length) running[running.length - 1] = home - away
  }
  const diff = home - away
  return {
    eventId: war.id,
    date: war.finished_at ?? war.created_at,
    opponent: war.opponent_tag?.trim() || war.opponent_name?.trim() || 'Rival',
    opponentKey: rivalKeyOf(war),
    home,
    away,
    diff,
    result: diff > 0 ? 'W' : diff < 0 ? 'L' : 'T',
    running,
    races,
  }
}

export type PhaseLine = { races: number; diffPerRace: number; raceWinRate: number }

export type TeamOverview = {
  wars: number
  record: Record3
  winRate: number
  /** Puntos de media por war, a favor y en contra (con penalties) */
  avgFor: number
  avgAgainst: number
  /** Diferencia media por war */
  avgDiff: number
  races: number
  diffPerRace: number
  raceRecord: Record3
  raceWinRate: number
  biggestWin: WarSummary | null
  biggestLoss: WarSummary | null
  /** Wars decididas por CLOSE_MARGIN puntos o menos */
  close: Record3
  /** Wars que iban perdiendo tras la carrera 6: cuántas se ganaron */
  comebacks: { won: number; of: number }
  /** Wars que iban ganando tras la carrera 6: cuántas se ganaron */
  leadsHeld: { won: number; of: number }
  phases: Record<Phase, PhaseLine | null>
  /** Últimas wars frente al total (diferencia media por war) */
  recent: { wars: number; avgDiff: number } | null
  /** Wars de la más antigua a la más reciente */
  series: WarSummary[]
}

/** Resumen de las wars de un equipo (o de las jugadas contra un rival) — función pura. Null sin wars. */
export function computeTeamOverview(wars: TeamWar[]): TeamOverview | null {
  if (!wars.length) return null
  const series = [...wars].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(summarizeWar)
  const diffs = series.map((w) => w.diff)
  const raceDiffs = series.flatMap((w) => w.races)
  const record = recordOf(diffs)
  const raceRecord = recordOf(raceDiffs.map((r) => r.diff))

  // Situación a mitad de war (solo wars con más de 6 carreras)
  const half = series.filter((w) => w.running.length > HALFTIME_RACE)
  const behind = half.filter((w) => w.running[HALFTIME_RACE - 1] < 0)
  const ahead = half.filter((w) => w.running[HALFTIME_RACE - 1] > 0)

  const phases = Object.fromEntries(
    PHASES.map((ph) => {
      const rs = raceDiffs.filter((r) => phaseOf(r.raceNo) === ph)
      return [ph, rs.length ? { races: rs.length, diffPerRace: round1(mean(rs.map((r) => r.diff))), raceWinRate: pct(rs.filter((r) => r.diff > 0).length, rs.length) } : null]
    }),
  ) as Record<Phase, PhaseLine | null>

  const best = series.reduce((a, b) => (b.diff > a.diff ? b : a))
  const worst = series.reduce((a, b) => (b.diff < a.diff ? b : a))
  const last = series.slice(-RECENT_WARS)

  return {
    wars: series.length,
    record,
    winRate: pct(record.w, series.length),
    avgFor: round1(mean(series.map((w) => w.home))),
    avgAgainst: round1(mean(series.map((w) => w.away))),
    avgDiff: round1(mean(diffs)),
    races: raceDiffs.length,
    diffPerRace: round1(mean(raceDiffs.map((r) => r.diff))),
    raceRecord,
    raceWinRate: pct(raceRecord.w, raceDiffs.length),
    biggestWin: best.diff > 0 ? best : null,
    biggestLoss: worst.diff < 0 ? worst : null,
    close: recordOf(diffs.filter((d) => Math.abs(d) <= CLOSE_MARGIN)),
    comebacks: { won: behind.filter((w) => w.result === 'W').length, of: behind.length },
    leadsHeld: { won: ahead.filter((w) => w.result === 'W').length, of: ahead.length },
    phases,
    recent: series.length > RECENT_WARS ? { wars: last.length, avgDiff: round1(mean(last.map((w) => w.diff))) } : null,
    series,
  }
}
