/**
 * Enlaza al usuario con su cuenta del Lounge de MKCentral usando su Discord, descarga su historial de MMR y verifica sus
 * eventos (ver src/lib/loungeSync.ts). La web la llama al abrir las estadísticas propias y al finalizar un evento.
 * La API del Lounge no permite llamadas directas desde el navegador por CORS, por eso pasa por aquí.
 */
import { createClient } from '@supabase/supabase-js'
import { LOUNGE_RESYNC_MS, syncLounge } from '../src/lib/loungeSync.js'

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return new Response('Unauthorized', { status: 401 })

  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  const user = auth?.user
  if (!user || authError) return new Response('Unauthorized', { status: 401 })

  // El Discord ID sale SOLO de la identidad de Discord que gestiona Supabase Auth (user_metadata lo edita el usuario)
  const identity = user.identities?.find((i) => i.provider === 'discord')
  const discordId =
    (identity?.identity_data?.provider_id as string | undefined) ||
    (identity?.identity_data?.sub as string | undefined) ||
    (identity?.id as string | undefined)
  if (!discordId) return Response.json({ ok: false, reason: 'no discord identity' }, { status: 403 })

  // Evita machacar al Lounge si se pide varias veces seguidas
  const { data: current } = await admin.from('lounge_players').select('synced_at').eq('profile_id', user.id).maybeSingle()
  const syncedAt = current?.synced_at ? Date.parse(current.synced_at as string) : 0
  if (Date.now() - syncedAt < LOUNGE_RESYNC_MS) return Response.json({ ok: true, skipped: 'recent' })

  try {
    return Response.json(await syncLounge(admin, user.id, discordId))
  } catch (err) {
    console.error('lounge sync', err)
    return Response.json({ ok: false, reason: 'lounge unavailable' }, { status: 502 })
  }
}
