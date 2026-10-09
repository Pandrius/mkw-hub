import { isAllowedLogoUrl } from './lorenziEmblems'
import { supabase } from './supabase'

export type TeamEmblem = { tag: string; logo: string | null }

/** Logos (URL de MKC) de los equipos indicados, por id; los que no tienen quedan fuera */
export async function fetchTeamLogoUrls(ids: (number | null)[]): Promise<Map<number, string>> {
  const wanted = ids.filter((id): id is number => id !== null)
  const out = new Map<number, string>()
  if (!supabase || wanted.length === 0) return out
  const { data } = await supabase.from('teams').select('id, logo_url').in('id', wanted)
  for (const t of data ?? []) if (isAllowedLogoUrl(t.logo_url)) out.set(t.id as number, t.logo_url as string)
  return out
}

/** Pide a nuestra función la imagen de la tabla con los escudos; lanza error si no se puede */
export async function fetchTableImageWithEmblems(text: string, teams: [TeamEmblem, TeamEmblem]): Promise<Blob> {
  const res = await fetch('/api/war-table', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, teams }),
  })
  if (!res.ok) throw new Error(`war-table ${res.status}`)
  return res.blob()
}
