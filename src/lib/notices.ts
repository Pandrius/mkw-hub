import { supabase } from './supabase'

/** Aviso de que alguien te ha apuntado en una war que acaba de subir */
export type Notice = {
  id: number
  event_id: string
  /** Estás apuntado en el lado rival y puedes subir la war desde tu lado */
  can_upload: boolean
  created_at: string
  read_at: string | null
  actor: { username: string } | null
  event: {
    team_tag: string | null
    opponent_tag: string | null
    played_on: string | null
    finished_at: string | null
    /** true cuando ya se ha subido la copia del lado rival */
    opponent_confirmed: boolean | null
  } | null
}

function client() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

/** Avisos del usuario, del más reciente al más antiguo */
export async function listNotices(limit = 50): Promise<Notice[]> {
  const { data, error } = await client()
    .from('notifications')
    .select(
      'id, event_id, can_upload, created_at, read_at, actor:profiles!notifications_actor_id_fkey(username), event:events!notifications_event_id_fkey(team_tag, opponent_tag, played_on, finished_at, opponent_confirmed)',
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as Notice[]
}

/** Cuántos avisos no se han leído */
export async function countUnreadNotices(): Promise<number> {
  const { count, error } = await client().from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markNoticesRead(): Promise<void> {
  const { error } = await client().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (error) throw error
}

/** ¿Puede el usuario validar o subir desde su lado esta war? (equipo rival, apuntado en su lado o admin) */
export async function canValidateWar(eventId: string): Promise<boolean> {
  const { data, error } = await client().rpc('can_validate_war', { target: eventId })
  if (error) throw new Error(error.message)
  return data === true
}
