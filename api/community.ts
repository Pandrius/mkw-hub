/**
 * Rankings de logros (todo el tiempo, semana y día), récords y coronas de la comunidad. El cálculo y su instantánea en la base de
 * datos están en communityServer.ts; además se deja en caché unos minutos.
 */
import { createClient } from '@supabase/supabase-js'
import { loadCommunity } from '../src/lib/communityServer.js'

export async function GET(): Promise<Response> {
  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  try {
    return Response.json(await loadCommunity(admin), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } })
  } catch (err) {
    console.error('community', err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
