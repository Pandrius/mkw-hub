import { supabase } from './supabase'

export type WorldRecord = {
  id: number
  track_id: string
  time_ms: number
  player_name: string
  country_code: string | null
  achieved_on: string
  days_held: number | null
  video_url: string | null
  character: string | null
  vehicle: string | null
  splits: string[]
}

const COLUMNS = 'id, track_id, time_ms, player_name, country_code, achieved_on, days_held, video_url, character, vehicle, splits'

function client() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

/** Récord vigente de cada pista */
export async function listCurrentWorldRecords(): Promise<WorldRecord[]> {
  const { data, error } = await client().from('current_world_records').select(COLUMNS)
  if (error) throw error
  return data as WorldRecord[]
}

/** Historial completo de una pista, del más reciente al más antiguo */
export async function listTrackWorldRecords(trackId: string): Promise<WorldRecord[]> {
  const { data, error } = await client()
    .from('world_records')
    .select(COLUMNS)
    .eq('track_id', trackId)
    .order('achieved_on', { ascending: false })
    .order('time_ms', { ascending: true })
  if (error) throw error
  return data as WorldRecord[]
}

/** El récord vigente es el más rápido (en empate, el primero en conseguirse). */
export function currentRecord(history: WorldRecord[]): WorldRecord | null {
  return history.reduce<WorldRecord | null>(
    (best, r) =>
      !best || r.time_ms < best.time_ms || (r.time_ms === best.time_ms && r.achieved_on < best.achieved_on) ? r : best,
    null,
  )
}

/** Días transcurridos desde una fecha (AAAA-MM-DD) hasta hoy */
export function daysSince(date: string, now = new Date()): number {
  const start = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.max(0, Math.round((today - start) / 86_400_000))
}
