/**
 * Vincula al usuario con Mario Kart Central usando su Discord:
 *   - país del jugador (para su bandera)
 *   - equipos de Mario Kart World en los que está (para comparar por equipos y registrar wars)
 *
 * La web la llama al iniciar sesión o registrarse con Discord, y periódicamente si los datos son antiguos.
 * La API de MKC no permite llamadas directas desde el navegador por CORS, por eso pasa por aquí.
 */
import { createClient } from '@supabase/supabase-js'
import { syncPlayerRoster } from '../src/lib/mkc.js'

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return new Response('Unauthorized', { status: 401 })

  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })

  const { data: auth, error: authError } = await admin.auth.getUser(token)
  const user = auth?.user
  if (!user || authError) return new Response('Unauthorized', { status: 401 })
  const userId = user.id

  const { data: profile } = await admin
    .from('profiles')
    .select('id, discord_id, username, mkc_player_id')
    .eq('id', userId)
    .maybeSingle()

  let discordId = profile?.discord_id
  if (!discordId) {
    const discordIdentity = user.identities?.find((i) => i.provider === 'discord')
    discordId =
      (discordIdentity?.identity_data?.provider_id as string | undefined) ||
      (discordIdentity?.id as string | undefined) ||
      (user.user_metadata?.provider_id as string | undefined) ||
      (user.app_metadata?.provider === 'discord' ? (user.user_metadata?.sub as string | undefined) : undefined)
  }

  // Si el usuario acaba de hacer sign-up y el trigger de Supabase aún no ha insertado el perfil,
  // nos aseguramos de que el perfil exista en public.profiles con su discord_id
  if (!profile) {
    const username =
      (user.user_metadata?.custom_claims?.global_name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      'Jugador'
    const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) || null

    await admin.from('profiles').upsert({
      id: userId,
      discord_id: discordId ?? null,
      username,
      avatar_url: avatarUrl,
    })
  } else if (discordId && !profile.discord_id) {
    await admin.from('profiles').update({ discord_id: discordId }).eq('id', userId)
  }

  if (!discordId && !profile?.mkc_player_id) {
    return Response.json({ ok: false, reason: 'no discord id' })
  }

  const result = await syncPlayerRoster(admin, {
    id: userId,
    discord_id: discordId ?? null,
    mkc_player_id: profile?.mkc_player_id ?? null,
  })

  return Response.json(result)
}
