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

/** Tiempo mínimo entre dos sincronizaciones del mismo usuario */
const RESYNC_MS = 2 * 60 * 1000

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
    .select('id, discord_id, username, mkc_player_id, mkc_synced_at')
    .eq('id', userId)
    .maybeSingle()

  // El Discord ID sale SOLO de la identidad de Discord que gestiona Supabase Auth.
  // user_metadata lo puede editar el propio usuario, así que nunca se usa para esto.
  const discordIdentity = user.identities?.find((i) => i.provider === 'discord')
  const discordId =
    (discordIdentity?.identity_data?.provider_id as string | undefined) ||
    (discordIdentity?.identity_data?.sub as string | undefined) ||
    (discordIdentity?.id as string | undefined)
  if (!discordId) return Response.json({ ok: false, reason: 'no discord identity' }, { status: 403 })

  // No volver a consultar MKC si se sincronizó hace muy poco (evita usar la web contra MKC)
  const syncedAt = profile?.mkc_synced_at ? Date.parse(profile.mkc_synced_at as string) : 0
  if (profile && Date.now() - syncedAt < RESYNC_MS) return Response.json({ ok: true, skipped: 'recent' })

  // Si el usuario acaba de hacer sign-up y el trigger de Supabase aún no ha insertado el perfil,
  // nos aseguramos de que el perfil exista en public.profiles con su discord_id
  if (!profile) {
    const username =
      (user.user_metadata?.custom_claims?.global_name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      'Jugador'
    const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) || null

    const { error } = await admin.from('profiles').upsert({
      id: userId,
      discord_id: discordId,
      username,
      avatar_url: avatarUrl,
    })
    if (error) return Response.json({ ok: false, reason: 'profile error' }, { status: 409 })
  } else if (profile.discord_id !== discordId) {
    // El perfil tenía otro Discord ID (o ninguno): manda la identidad real, y el jugador de MKC se vuelve a buscar
    const { error } = await admin.from('profiles').update({ discord_id: discordId, mkc_player_id: null }).eq('id', userId)
    if (error) return Response.json({ ok: false, reason: 'profile error' }, { status: 409 })
  }

  const result = await syncPlayerRoster(admin, {
    id: userId,
    discord_id: discordId,
    mkc_player_id: profile?.discord_id === discordId ? (profile?.mkc_player_id ?? null) : null,
  })

  return Response.json(result)
}
