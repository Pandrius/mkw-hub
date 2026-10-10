import { streakOf, type Streak } from './form'
import { RECENT_WARS, summarizeWar, type WarSummary } from './teamAnalytics'
import type { TeamWar } from './teamStats'

export type TeamForm = {
  /** Wars de la más antigua a la más reciente */
  wars: WarSummary[]
  /** Últimas wars (máx. 5), de la más reciente a la más antigua: al jugar otra, las anteriores se desplazan a la derecha */
  last: WarSummary[]
  /** Racha actual: tipo y longitud */
  current: { result: 'W' | 'L' | 'T'; length: number } | null
  winStreak: Streak
  lossStreak: Streak
  raceWinStreak: Streak
}

/** Forma y rachas de un equipo a partir de sus wars finalizadas (función pura) */
export function computeTeamForm(wars: TeamWar[]): TeamForm | null {
  if (wars.length === 0) return null
  const outcomes = [...wars].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(summarizeWar)

  const lastOutcome = outcomes[outcomes.length - 1]
  let length = 0
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i].result === lastOutcome.result; i--) length++

  return {
    wars: outcomes,
    last: outcomes.slice(-RECENT_WARS).reverse(),
    current: { result: lastOutcome.result, length },
    winStreak: streakOf(outcomes, (o) => o.result === 'W'),
    lossStreak: streakOf(outcomes, (o) => o.result === 'L'),
    raceWinStreak: streakOf(
      outcomes.flatMap((o) => o.races),
      (r) => r.diff > 0,
    ),
  }
}
