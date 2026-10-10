import { streakOf, type Badge, type Streak } from './form'
import { penaltyTotals } from './penalties'
import { scoreTeamRace } from './scoring'
import type { TeamWar } from './teamStats'

export type WarOutcome = {
  eventId: string
  date: string
  opponent: string
  home: number
  away: number
  diff: number
  result: 'W' | 'L' | 'T'
  /** Diferencia acumulada tras cada carrera */
  running: number[]
}

export type TeamForm = {
  /** Wars de la más antigua a la más reciente */
  wars: WarOutcome[]
  /** Últimas wars (máx. 5), de la más reciente a la más antigua: al jugar otra, las anteriores se desplazan a la derecha */
  last: WarOutcome[]
  /** Racha actual: tipo y longitud */
  current: { result: 'W' | 'L' | 'T'; length: number } | null
  winStreak: Streak
  lossStreak: Streak
  raceWinStreak: Streak
  badges: Badge[]
}

const round2 = (n: number) => Math.round(n * 100) / 100
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Forma, rachas y curiosidades de un equipo a partir de sus wars finalizadas (función pura) */
export function computeTeamForm(wars: TeamWar[]): TeamForm | null {
  if (wars.length === 0) return null
  const sorted = [...wars].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const raceDiffs: { raceNo: number; diff: number }[] = []
  const outcomes: WarOutcome[] = sorted.map((war) => {
    let home = 0
    let away = 0
    const running: number[] = []
    for (const r of [...war.races].sort((a, b) => a.race_no - b.race_no)) {
      const s = scoreTeamRace(r.positions, r.missing_home, r.missing_away)
      home += s.home
      away += s.away
      running.push(home - away)
      raceDiffs.push({ raceNo: r.race_no, diff: s.home - s.away })
    }
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
      home,
      away,
      diff,
      result: diff > 0 ? 'W' : diff < 0 ? 'L' : 'T',
      running,
    }
  })

  const lastOutcome = outcomes[outcomes.length - 1]
  let length = 0
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i].result === lastOutcome.result; i--) length++

  return {
    wars: outcomes,
    last: outcomes.slice(-5).reverse(),
    current: { result: lastOutcome.result, length },
    winStreak: streakOf(outcomes, (o) => o.result === 'W'),
    lossStreak: streakOf(outcomes, (o) => o.result === 'L'),
    raceWinStreak: streakOf(raceDiffs, (r) => r.diff > 0),
    badges: teamBadges(outcomes, raceDiffs),
  }
}

function teamBadges(wars: WarOutcome[], races: { raceNo: number; diff: number }[]): Badge[] {
  const badges: Badge[] = []
  const halftime = (w: WarOutcome) => (w.running.length >= 12 ? w.running[5] : null)

  // Remontadas: perdiendo a mitad de war (tras la carrera 6) y ganada al final
  const comebacks = wars.filter((w) => (halftime(w) ?? 0) < 0 && w.result === 'W')
  if (comebacks.length) {
    const best = comebacks.reduce((a, b) => (halftime(a)! < halftime(b)! ? a : b))
    badges.push({ id: 'comeback', tone: 'good', vars: { n: comebacks.length, deficit: -halftime(best)!, opp: best.opponent } })
  }
  // Desplomes: ganando a mitad de war y perdida al final
  const collapses = wars.filter((w) => (halftime(w) ?? 0) > 0 && w.result === 'L')
  if (collapses.length) badges.push({ id: 'collapse', tone: 'bad', vars: { n: collapses.length } })

  // Paliza dada y paliza recibida
  const biggest = wars.reduce((a, b) => (b.diff > a.diff ? b : a))
  if (biggest.diff >= 100) badges.push({ id: 'thrashing', tone: 'good', vars: { diff: biggest.diff, opp: biggest.opponent } })
  const worst = wars.reduce((a, b) => (b.diff < a.diff ? b : a))
  if (worst.diff <= -100) badges.push({ id: 'beatdown', tone: 'bad', vars: { diff: -worst.diff, opp: worst.opponent } })

  // Finales de infarto: wars decididas por 10 puntos o menos
  const close = wars.filter((w) => Math.abs(w.diff) <= 10)
  if (close.length >= 2) {
    const won = close.filter((w) => w.result === 'W').length
    badges.push({ id: won * 2 >= close.length ? 'ironNerves' : 'heartAttack', tone: won * 2 >= close.length ? 'good' : 'bad', vars: { won, n: close.length } })
  }

  // Bestia negra: el rival contra el que más se pierde
  const vs = new Map<string, { w: number; l: number }>()
  for (const w of wars) {
    const rec = vs.get(w.opponent) ?? { w: 0, l: 0 }
    if (w.result === 'W') rec.w++
    if (w.result === 'L') rec.l++
    vs.set(w.opponent, rec)
  }
  const nemesis = [...vs.entries()].filter(([, r]) => r.l >= 2 && r.l > r.w).sort((a, b) => b[1].l - a[1].l)[0]
  if (nemesis) badges.push({ id: 'nemesis', tone: 'bad', vars: { opp: nemesis[0], w: nemesis[1].w, l: nemesis[1].l } })
  const victim = [...vs.entries()].filter(([, r]) => r.w >= 2 && r.l === 0).sort((a, b) => b[1].w - a[1].w)[0]
  if (victim) badges.push({ id: 'favouriteVictim', tone: 'weird', vars: { opp: victim[0], n: victim[1].w } })

  // Arranque frente a cierre: diferencia media en las carreras 1-4 y 9-12
  const start = races.filter((r) => r.raceNo <= 4).map((r) => r.diff)
  const end = races.filter((r) => r.raceNo >= 9).map((r) => r.diff)
  if (start.length >= 8 && end.length >= 8) {
    const gap = avg(end) - avg(start)
    if (gap >= 4) badges.push({ id: 'strongFinish', tone: 'good', vars: { start: round2(avg(start)), end: round2(avg(end)) } })
    else if (gap <= -4) badges.push({ id: 'fastStart', tone: 'weird', vars: { start: round2(avg(start)), end: round2(avg(end)) } })
  }

  return badges
}
