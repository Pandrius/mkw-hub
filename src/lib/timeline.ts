import { supabase } from './supabase'
import type { TimedResult } from './form'
import { fetchTimeline } from './timelineQuery'

/** Resultados de un jugador en eventos finalizados con fecha y número de carrera */
export async function getPlayerTimeline(profileId: string): Promise<TimedResult[]> {
  if (!supabase) throw new Error('Supabase no está configurado')
  return fetchTimeline(supabase, profileId)
}
