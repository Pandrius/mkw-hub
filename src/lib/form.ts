import type { EventKind } from './events'
import type { StatsFilter } from './stats'
import { supabase } from './supabase'

/** Resultado de una carrera con su orden en el tiempo (para forma y rachas) */
export type TimedResult = {
  eventId: string
  kind: EventKind
  trackId: string
  position: number
  raceNo: number
  /** Inicio del evento (ISO) */
  date: string
  /** Jugadores en la carrera (null en lounge: se asume 12) */
  racers: number | null
}

export type Trend = 'fire' | 'up' | 'steady' | 'down' | 'ice'

export type Streak = { current: number; best: number }

export type EventForm = { eventId: string; kind: EventKind; date: string; average: number; races: number }

export type BadgeTone = 'good' | 'bad' | 'weird'

/** Curiosidad o logro; el texto lo pone la interfaz a partir del id y las variables */
export type Badge = { id: string; tone: BadgeTone; vars: Record<string, string | number> }

export type PlayerForm = {
  races: number
  /** Posiciones de las últimas carreras, de la más antigua a la más reciente */
  lastPositions: number[]
  recentAverage: number
  overallAverage: number
  /** recentAverage - overallAverage (negativo = mejor que de costumbre) */
  delta: number
  trend: Trend
  events: EventForm[]
  streaks: { top6: Streak; podium: Streak; win: Streak; bottom: Streak }
  badges: Badge[]
}

/** Carreras que forman la "forma reciente" (un evento) */
export const RECENT_RACES = 12
/** Mínimo de carreras para hablar de forma */
export const MIN_FORM_RACES = 6

const round2 = (n: number) => Math.round(n * 100) / 100
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function sortTimeline(results: TimedResult[]): TimedResult[] {
  return [...results].sort((a, b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId) || a.raceNo - b.raceNo)
}

export function trendOf(delta: number): Trend {
  if (delta <= -1.5) return 'fire'
  if (delta <= -0.5) return 'up'
  if (delta >= 1.5) return 'ice'
  if (delta >= 0.5) return 'down'
  return 'steady'
}

/** Racha actual (al final de la lista) y mejor racha de elementos que cumplen la condición */
export function streakOf<T>(items: T[], test: (item: T) => boolean): Streak {
  let current = 0
  let best = 0
  for (const item of items) {
    current = test(item) ? current + 1 : 0
    best = Math.max(best, current)
  }
  return { current, best }
}

const lastPlace = (r: TimedResult) => r.position >= (r.racers ?? 12)

/** Franja horaria (hora local) en la que empezó el evento */
export function dayPart(iso: string): 'morning' | 'afternoon' | 'night' {
  const h = new Date(iso).getHours()
  if (h >= 6 && h < 14) return 'morning'
  if (h >= 14 && h < 21) return 'afternoon'
  return 'night'
}

function stdDev(xs: number[]): number {
  const m = avg(xs)
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)))
}

/** Forma, rachas y curiosidades de un jugador (función pura). Null si hay pocos datos. */
export function computePlayerForm(all: TimedResult[], filter: StatsFilter): PlayerForm | null {
  const rows = sortTimeline(filter === 'all' ? all : all.filter((r) => r.kind === filter))
  if (rows.length < MIN_FORM_RACES) return null

  const positions = rows.map((r) => r.position)
  const recent = positions.slice(-RECENT_RACES)
  const overallAverage = round2(avg(positions))
  const recentAverage = round2(avg(recent))
  const delta = round2(recentAverage - overallAverage)

  // Media por evento, en orden
  const byEvent = new Map<string, TimedResult[]>()
  for (const r of rows) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r])
  const events: EventForm[] = [...byEvent.entries()].map(([eventId, rs]) => ({
    eventId,
    kind: rs[0].kind,
    date: rs[0].date,
    average: round2(avg(rs.map((r) => r.position))),
    races: rs.length,
  }))

  const streaks = {
    top6: streakOf(rows, (r) => r.position <= 6),
    podium: streakOf(rows, (r) => r.position <= 3),
    win: streakOf(rows, (r) => r.position === 1),
    bottom: streakOf(rows, (r) => r.position >= 7),
  }

  return {
    races: rows.length,
    lastPositions: recent,
    recentAverage,
    overallAverage,
    delta,
    trend: trendOf(delta),
    events,
    streaks,
    badges: playerBadges(rows, [...byEvent.values()], overallAverage, streaks),
  }
}

function playerBadges(
  rows: TimedResult[],
  eventRaces: TimedResult[][],
  overall: number,
  streaks: PlayerForm['streaks'],
): Badge[] {
  const badges: Badge[] = []
  const positions = rows.map((r) => r.position)

  // --- Las típicas ---
  if (streaks.win.best >= 2) badges.push({ id: 'winStreak', tone: 'good', vars: { n: streaks.win.best } })
  const wins = positions.filter((p) => p === 1).length
  if (wins >= 5) badges.push({ id: 'winner', tone: 'good', vars: { n: wins } })

  // --- Las malas (con cariño) ---
  if (streaks.bottom.best >= 4) badges.push({ id: 'blueShell', tone: 'bad', vars: { n: streaks.bottom.best } })
  const lasts = rows.filter(lastPlace).length
  if (lasts >= 2) badges.push({ id: 'redLantern', tone: 'bad', vars: { n: lasts } })
  const fourths = positions.filter((p) => p === 4).length
  if (fourths >= 3 && fourths / positions.length >= 0.12) badges.push({ id: 'almostPodium', tone: 'bad', vars: { n: fourths } })

  // Pista maldita: varias carreras y nunca en el top 6
  const byTrack = new Map<string, number[]>()
  for (const r of rows) byTrack.set(r.trackId, [...(byTrack.get(r.trackId) ?? []), r.position])
  const cursed = [...byTrack.entries()]
    .filter(([, ps]) => ps.length >= 3 && Math.min(...ps) >= 7)
    .sort((a, b) => avg(b[1]) - avg(a[1]))[0]
  if (cursed) badges.push({ id: 'cursedTrack', tone: 'bad', vars: { track: cursed[0], n: cursed[1].length } })

  // Resaca de la victoria: la carrera después de ganar sale mucho peor
  const afterWin: number[] = []
  for (const rs of eventRaces) {
    for (let i = 1; i < rs.length; i++) {
      if (rs[i - 1].position === 1 && rs[i].raceNo === rs[i - 1].raceNo + 1) afterWin.push(rs[i].position)
    }
  }
  if (afterWin.length >= 3 && avg(afterWin) - overall >= 1) {
    badges.push({ id: 'hangover', tone: 'bad', vars: { avg: round2(avg(afterWin)) } })
  }

  // --- Las raras ---
  // Montaña rusa: el mayor salto entre dos carreras seguidas del mismo evento
  let jump = { size: 0, from: 0, to: 0 }
  for (const rs of eventRaces) {
    for (let i = 1; i < rs.length; i++) {
      const size = Math.abs(rs[i].position - rs[i - 1].position)
      if (size > jump.size) jump = { size, from: rs[i - 1].position, to: rs[i].position }
    }
  }
  if (jump.size >= 9) badges.push({ id: 'rollercoaster', tone: 'weird', vars: { from: jump.from, to: jump.to } })

  // Regularidad: desviación típica de las posiciones
  if (positions.length >= 12) {
    const sd = stdDev(positions)
    if (sd <= 2.2) badges.push({ id: 'metronome', tone: 'good', vars: { sd: round2(sd) } })
    else if (sd >= 3.6) badges.push({ id: 'roulette', tone: 'weird', vars: { sd: round2(sd) } })
  }

  // Diésel o fuelle corto: primeras 4 carreras de cada evento frente a las 4 últimas
  const opening = rows.filter((r) => r.raceNo <= 4).map((r) => r.position)
  const closing = rows.filter((r) => r.raceNo >= 9).map((r) => r.position)
  if (opening.length >= 8 && closing.length >= 8) {
    const gap = round2(avg(opening) - avg(closing))
    if (gap >= 1) badges.push({ id: 'diesel', tone: 'weird', vars: { start: round2(avg(opening)), end: round2(avg(closing)) } })
    else if (gap <= -1) badges.push({ id: 'fadeOut', tone: 'bad', vars: { start: round2(avg(opening)), end: round2(avg(closing)) } })
  }

  // Sangre fría: la carrera 12 sale mejor que la media
  const finals = rows.filter((r) => r.raceNo === 12).map((r) => r.position)
  if (finals.length >= 3 && overall - avg(finals) >= 1) badges.push({ id: 'clutch', tone: 'good', vars: { avg: round2(avg(finals)) } })

  // Franja horaria en la que mejor se corre
  const parts = new Map<string, number[]>()
  for (const r of rows) parts.set(dayPart(r.date), [...(parts.get(dayPart(r.date)) ?? []), r.position])
  const enough = [...parts.entries()].filter(([, ps]) => ps.length >= 12)
  if (enough.length >= 2) {
    enough.sort((a, b) => avg(a[1]) - avg(b[1]))
    const [bestPart, bestPs] = enough[0]
    const worstPs = enough[enough.length - 1][1]
    if (avg(worstPs) - avg(bestPs) >= 0.75) badges.push({ id: `part_${bestPart}`, tone: 'weird', vars: { avg: round2(avg(bestPs)) } })
  }

  // War frente a lounge: ¿juega mejor en equipo o en solitario?
  const war = rows.filter((r) => r.kind === 'war').map((r) => r.position)
  const lounge = rows.filter((r) => r.kind === 'lounge').map((r) => r.position)
  if (war.length >= 12 && lounge.length >= 12) {
    const diff = avg(lounge) - avg(war)
    if (diff >= 0.75) badges.push({ id: 'teamPlayer', tone: 'weird', vars: { war: round2(avg(war)), lounge: round2(avg(lounge)) } })
    else if (diff <= -0.75) badges.push({ id: 'loneWolf', tone: 'weird', vars: { war: round2(avg(war)), lounge: round2(avg(lounge)) } })
  }

  // Turista o monotemático: cuántas pistas distintas ha corrido
  const distinct = byTrack.size
  if (rows.length >= 24 && distinct >= 30) badges.push({ id: 'tourist', tone: 'good', vars: { n: distinct } })
  else if (rows.length >= 24 && distinct <= 10) badges.push({ id: 'homebody', tone: 'weird', vars: { n: distinct } })

  return badges
}

/** Resultados de un jugador en eventos finalizados con fecha y número de carrera */
export async function getPlayerTimeline(profileId: string): Promise<TimedResult[]> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase
    .from('race_results')
    .select(
      'position, event_players!inner(profile_id), event_races!inner(race_no, track_id, missing_home, missing_away, events!inner(id, kind, status, created_at))',
    )
    .eq('event_players.profile_id', profileId)
    .eq('event_races.events.status', 'finished')
    .limit(10000)
  if (error) throw error
  type Row = {
    position: number
    event_races: {
      race_no: number
      track_id: string
      missing_home: number
      missing_away: number
      events: { id: string; kind: EventKind; created_at: string }
    }
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    eventId: r.event_races.events.id,
    kind: r.event_races.events.kind,
    trackId: r.event_races.track_id,
    position: r.position,
    raceNo: r.event_races.race_no,
    date: r.event_races.events.created_at,
    racers: r.event_races.events.kind === 'war' ? 12 - r.event_races.missing_home - r.event_races.missing_away : null,
  }))
}
