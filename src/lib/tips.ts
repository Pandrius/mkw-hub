import { supabase } from './supabase'

export type TipKind = 'time_trial' | 'race'

export type Tip = {
  id: number
  track_id: string
  kind: TipKind
  title: string
  content: string
  video_url: string | null
  position: number
  created_at: string
  updated_at: string
}

export type TipInput = Pick<Tip, 'title' | 'content' | 'video_url'>

function client() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

export async function listTips(trackId: string, kind: TipKind): Promise<Tip[]> {
  const { data, error } = await client()
    .from('track_tips')
    .select('*')
    .eq('track_id', trackId)
    .eq('kind', kind)
    .order('position')
    .order('created_at')
  if (error) throw error
  return data as Tip[]
}

export async function createTip(trackId: string, kind: TipKind, input: TipInput, position: number): Promise<void> {
  const { error } = await client()
    .from('track_tips')
    .insert({ track_id: trackId, kind, position, ...input })
  if (error) throw error
}

export async function updateTip(id: number, input: TipInput): Promise<void> {
  const { error } = await client().from('track_tips').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteTip(id: number): Promise<void> {
  const { error } = await client().from('track_tips').delete().eq('id', id)
  if (error) throw error
}

/** Devuelve el id de un vídeo de YouTube a partir de su URL, o null si no lo es. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    // Solo ids de vídeo válidos (11 caracteres) y dominios de YouTube de verdad
    const isId = (id: string | null) => (id && /^[\w-]{11}$/.test(id) ? id : null)
    if (u.hostname === 'youtu.be') return isId(u.pathname.slice(1))
    if (u.hostname === 'youtube.com' || u.hostname.endsWith('.youtube.com')) {
      if (u.pathname === '/watch') return isId(u.searchParams.get('v'))
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/)
      if (m) return isId(m[2])
    }
  } catch {
    // URL no válida
  }
  return null
}
