import type { SupabaseClient } from '@supabase/supabase-js'
import type { TimedResult } from './form.js'
import { eventDate } from './playedAt.js'
import { isVerified, type Verifiable } from './verify.js'

/**
 * Consulta de las carreras de un jugador. Va aparte de form.ts porque la usa también el servidor (api/), donde no existe el
 * cliente del navegador de supabase.ts.
 */
/** Resultados de un jugador en eventos finalizados con fecha y número de carrera */
export async function fetchTimeline(client: SupabaseClient, profileId: string): Promise<TimedResult[]> {
  const { data, error } = await client
    .from('race_results')
    .select(
      'position, event_players!inner(profile_id), event_races!inner(race_no, track_id, missing_home, missing_away, events!inner(id, kind, status, created_at, played_on, lounge_change_id, lounge_table_id, lounge_tier, trusted, opponent_confirmed))',
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
      events: Verifiable & { id: string; created_at: string; played_on: string | null; lounge_tier: string | null }
    }
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    eventId: r.event_races.events.id,
    kind: r.event_races.events.kind,
    trackId: r.event_races.track_id,
    position: r.position,
    raceNo: r.event_races.race_no,
    date: eventDate(r.event_races.events.created_at, r.event_races.events.played_on),
    racers: r.event_races.events.kind === 'war' ? 12 - r.event_races.missing_home - r.event_races.missing_away : null,
    verified: isVerified(r.event_races.events),
    tier: r.event_races.events.lounge_tier,
  }))
}
