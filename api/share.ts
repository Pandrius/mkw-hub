/**
 * Enlaces para compartir. Devuelve una página mínima con las etiquetas Open Graph (lo que leen Discord, WhatsApp, Telegram...
 * para la vista previa) y redirige a la web real a quien la abre:
 *   /p/<id>  → perfil      (rewrite a /api/share?kind=profile&id=<id>)
 *   /t?d=…   → tabla libre (rewrite a /api/share?kind=table&d=…)
 */
import { createClient } from '@supabase/supabase-js'
import { en } from '../src/i18n/en.js'
import { es, type MessageKey } from '../src/i18n/es.js'
import { buildTable, decodeWar } from '../src/lib/freeTable.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function page(o: { title: string; description: string; image: string; target: string; canonical: string }): Response {
  const t = escapeHtml(o.title)
  const d = escapeHtml(o.description)
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:site_name" content="MKW Hub"><meta property="og:type" content="website">
<meta property="og:title" content="${t}"><meta property="og:description" content="${d}">
<meta property="og:url" content="${escapeHtml(o.canonical)}">
<meta property="og:image" content="${escapeHtml(o.image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${escapeHtml(o.image)}">
<meta name="theme-color" content="#ffd500">
<meta http-equiv="refresh" content="0;url=${escapeHtml(o.target)}"></head>
<body><a href="${escapeHtml(o.target)}">${t}</a></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } })
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es'
  const t = (key: MessageKey, vars?: Record<string, string>) => (lang === 'en' ? en : es)[key].replace(/\{(\w+)\}/g, (_, k: string) => vars?.[k] ?? '')
  const origin = url.origin
  const kind = url.searchParams.get('kind')

  if (kind === 'profile') {
    const id = url.searchParams.get('id') ?? ''
    if (!UUID.test(id)) return Response.redirect(origin, 302)
    const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
    const { data } = await admin.from('profiles').select('username').eq('id', id).maybeSingle()
    if (!data) return Response.redirect(origin, 302)
    const name = String(data.username ?? '?')
    return page({
      title: `${name} · MKW Hub`,
      description: t('og.profileDesc', { name }),
      image: `${origin}/api/og?kind=profile&id=${id}&lang=${lang}`,
      target: `/estadisticas/${id}`,
      canonical: `${origin}/p/${id}`,
    })
  }

  if (kind === 'table') {
    const d = url.searchParams.get('d')
    const shared = decodeWar(d)
    if (!d || !shared) return Response.redirect(`${origin}/tablas`, 302)
    const table = buildTable(shared.war)
    return page({
      title: `${table.title || `${table.home.tag} ${table.home.total} – ${table.away.total} ${table.away.tag}`} · MKW Hub`,
      description: t('og.tableDesc'),
      image: `${origin}/api/og?kind=table&d=${encodeURIComponent(d)}&lang=${lang}`,
      target: `/tablas?d=${encodeURIComponent(d)}`,
      canonical: `${origin}/t?d=${encodeURIComponent(d)}`,
    })
  }

  return Response.redirect(origin, 302)
}
