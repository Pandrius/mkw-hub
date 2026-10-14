/**
 * Guarda las insignias destacadas y el título del perfil. Solo acepta lo que el usuario ya ha ganado: se recalcula aquí con
 * los eventos verificados (las columnas del perfil no se pueden editar desde el navegador).
 */
import { createClient } from '@supabase/supabase-js'
import { loadTitleContext } from '../src/lib/showcaseServer.js'
import { validateFeatured, validateTitle } from '../src/lib/titles.js'

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return new Response('Unauthorized', { status: 401 })

  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (!auth?.user || authError) return new Response('Unauthorized', { status: 401 })

  let body: { badges?: unknown; title?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ ok: false, reason: 'invalid body' }, { status: 400 })
  }

  try {
    const { ctx, owned } = await loadTitleContext(admin, auth.user.id)
    const badges = validateFeatured(body.badges, owned)
    const title = validateTitle(body.title, ctx)
    if (badges === null) return Response.json({ ok: false, reason: 'invalid badges' }, { status: 422 })
    if (title === undefined) return Response.json({ ok: false, reason: 'invalid title' }, { status: 422 })

    const { error } = await admin.from('profiles').update({ featured_badges: badges, title_id: title }).eq('id', auth.user.id)
    if (error) return Response.json({ ok: false, reason: 'save error' }, { status: 500 })
    return Response.json({ ok: true, badges, title })
  } catch (err) {
    console.error('showcase', err)
    return Response.json({ ok: false, reason: 'unavailable' }, { status: 500 })
  }
}
