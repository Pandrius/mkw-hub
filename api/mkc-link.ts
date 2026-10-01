/**
 * Vincula al usuario con Mario Kart Central usando su Discord:
 *   - país del jugador (para su bandera)
 *   - equipos de Mario Kart World en los que está (para comparar por equipos)
 *
 * La web la llama al iniciar sesión (como mucho cada 12 h) con el token de Supabase del usuario.
 * La API de MKC no permite llamadas desde el navegador, por eso pasa por aquí.
 */
import { createClient } from '@supabase/supabase-js'

const MKC = 'https://mkcentral.com/api/registry'

type MkcRoster = { team_id: number; team_name: string; team_tag: string; roster_tag?: string; team_color?: number; game: string }

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return new Response('Unauthorized', { status: 401 })

  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })

  const { data: auth } = await admin.auth.getUser(token)
  const userId = auth.user?.id
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await admin.from('profiles').select('id, discord_id, username').eq('id', userId).maybeSingle()
  let discordId = profile?.discord_id
  if (!discordId) {
    const discordIdentity = auth.user.identities?.find((i) => i.provider === 'discord')
    discordId =
      (auth.user.user_metadata?.provider_id as string | undefined) ||
      (discordIdentity?.id as string | undefined) ||
      (discordIdentity?.identity_data?.provider_id as string | undefined) ||
      (auth.user.user_metadata?.sub as string | undefined)
    if (discordId) {
      await admin.from('profiles').update({ discord_id: discordId }).eq('id', userId)
    }
  }
  if (!discordId) return Response.json({ ok: false, reason: 'no discord id' })

  const now = new Date().toISOString()
  const headers = { 'User-Agent': 'MKW Hub (https://mkw-hub.vercel.app)' }
  const search = await fetch(`${MKC}/players?discord_id=${encodeURIComponent(discordId)}`, { headers })
  if (!search.ok) return Response.json({ ok: false, reason: `MKC ${search.status}` }, { status: 502 })
  const player = ((await search.json()) as { player_list?: { id: number; country_code?: string | null }[] }).player_list?.[0]

  let rosters: MkcRoster[] = []
  if (player) {
    const detail = await fetch(`${MKC}/players/${player.id}`, { headers })
    if (detail.ok) {
      rosters = (((await detail.json()) as { rosters?: MkcRoster[] }).rosters ?? []).filter((r) => r.game === 'mkworld')
    }
  }

  const teams = [...new Map(rosters.map((r) => [r.team_id, r])).values()].map((r) => ({
    id: r.team_id,
    name: r.team_name,
    tag: r.roster_tag || r.team_tag,
    color: r.team_color ?? null,
    updated_at: now,
  }))

  if (teams.length) {
    const { error } = await admin.from('teams').upsert(teams)
    if (error) return Response.json({ ok: false, reason: error.message }, { status: 500 })
  }
  await admin.from('team_members').delete().eq('profile_id', userId)
  if (teams.length) {
    await admin.from('team_members').insert(teams.map((t) => ({ team_id: t.id, profile_id: userId })))
  }

  const country = player?.country_code?.toUpperCase()
  await admin
    .from('profiles')
    .update({
      mkc_player_id: player?.id ?? null,
      country_code: country && /^[A-Z]{2}$/.test(country) ? country : null,
      mkc_synced_at: now,
    })
    .eq('id', userId)

  return Response.json({ ok: true, mkcPlayer: player?.id ?? null, teams: teams.map((t) => t.tag) })
}
