import { supabase } from './supabase'

type OwnerRow = { profile_id: string; track_id: string }

/**
 * Pistas de las que un jugador es «Dueño»: está en el 1 % mejor de la pista según los puntos ajustados de los eventos verificados,
 * con un mínimo de 20 carreras (función track_owners de la base de datos). Cambia si otro jugador lo supera.
 */
export async function getOwnedTracks(profileId: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('track_owners')
  if (error) throw error
  return ((data ?? []) as OwnerRow[]).filter((r) => r.profile_id === profileId).map((r) => r.track_id)
}
