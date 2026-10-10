import type { EventKind } from './events'
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

export type Streak = { current: number; best: number }

export function sortTimeline(results: TimedResult[]): TimedResult[] {
  return [...results].sort((a, b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId) || a.raceNo - b.raceNo)
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
