import { supabase } from './supabase'

export type TtCategory = 'race' | 'flap'

export type TimeTrial = {
  id: number
  track_id: string
  category: TtCategory
  nita: boolean
  time_ms: number
  player_name: string
  country_code: string | null
  proof_url: string | null
  achieved_on: string | null
  source: 'manual' | 'mkc'
  /** Usuario de la web al que pertenece el tiempo (si está registrado) */
  profile_id: string | null
}

export type TimeTrialInput = Pick<
  TimeTrial,
  'track_id' | 'category' | 'nita' | 'time_ms' | 'player_name' | 'country_code' | 'proof_url' | 'achieved_on'
>

function client() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

export async function listTimes(trackId: string, category: TtCategory, nita: boolean): Promise<TimeTrial[]> {
  const { data, error } = await client()
    .from('time_trials')
    .select('id, track_id, category, nita, time_ms, player_name, country_code, proof_url, achieved_on, source, profile_id')
    .eq('track_id', trackId)
    .eq('category', category)
    .eq('nita', nita)
    .order('time_ms')
    .limit(500)
  if (error) throw error
  return data as TimeTrial[]
}

export async function addTime(input: TimeTrialInput): Promise<void> {
  const { error } = await client().from('time_trials').insert(input)
  if (error) throw error
}

/** Un jugador añade su propio tiempo (nombre y país salen de su perfil) */
export async function addMyTime(
  input: Pick<TimeTrial, 'track_id' | 'category' | 'nita' | 'time_ms' | 'proof_url' | 'achieved_on'>,
): Promise<void> {
  const { error } = await client().rpc('add_my_time', input)
  if (error) throw error
}

export async function deleteTime(id: number): Promise<void> {
  const { error } = await client().from('time_trials').delete().eq('id', id)
  if (error) throw error
}

/**
 * Ranking: el mejor tiempo de cada jugador, ya ordenado.
 * Se agrupa por usuario registrado; si no lo está, por nombre (sin distinguir mayúsculas).
 */
export function bestPerPlayer(times: TimeTrial[]): TimeTrial[] {
  const best = new Map<string, TimeTrial>()
  for (const t of times) {
    const key = t.profile_id ? `id:${t.profile_id}` : `name:${t.player_name.trim().toLowerCase()}`
    const prev = best.get(key)
    if (!prev || t.time_ms < prev.time_ms) best.set(key, t)
  }
  return [...best.values()].sort((a, b) => a.time_ms - b.time_ms)
}
