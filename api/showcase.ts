/**
 * Guarda las insignias destacadas y el título del perfil. Solo acepta lo que el usuario ya ha ganado: se recalcula aquí con
 * los eventos verificados (las columnas del perfil no se pueden editar desde el navegador).
 */
import { createClient } from '@supabase/supabase-js'
import { loadTitleContext } from '../src/lib/showcaseServer.js'
import { canPickBolts, DEFAULT_BOLT_STYLE, isBoltStyle, validateFeatured, validateTitle, type BoltStyle } from '../src/lib/titles.js'

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return new Response('Unauthorized', { status: 401 })

  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (!auth?.user || authError) return new Response('Unauthorized', { status: 401 })

  let body: { badges?: unknown; title?: unknown; bolts?: unknown }
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

    // Los rayos de los escudos especiales son el premio de quien los ha conseguido; para el resto se ignoran
    if (body.bolts !== undefined && !isBoltStyle(body.bolts)) return Response.json({ ok: false, reason: 'invalid bolts' }, { status: 422 })
    const current = await admin.from('profiles').select('bolt_style').eq('id', auth.user.id).maybeSingle()
    const saved = isBoltStyle(current.data?.bolt_style) ? current.data.bolt_style : DEFAULT_BOLT_STYLE
    const bolts: BoltStyle = canPickBolts(owned) && isBoltStyle(body.bolts) ? body.bolts : saved

    const { error } = await admin.from('profiles').update({ featured_badges: badges, title_id: title, bolt_style: bolts }).eq('id', auth.user.id)
    if (error) return Response.json({ ok: false, reason: 'save error' }, { status: 500 })
    return Response.json({ ok: true, badges, title, bolts })
  } catch (err) {
    console.error('showcase', err)
    return Response.json({ ok: false, reason: 'unavailable' }, { status: 500 })
  }
}
