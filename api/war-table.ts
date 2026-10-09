/**
 * Imagen de la tabla de la war con los escudos de los equipos (Lorenzi, gb2.hlorenzi.com).
 *
 * POST { text, teams: [{ tag, logo }, { tag, logo }] } → image/png
 * `logo` es la URL del logo en Mario Kart Central (solo se aceptan esas); se descarga aquí y se
 * pasa a Lorenzi como data: URI, que es la única forma en que la dibuja. Si un logo falla
 * se genera la tabla igualmente, con el tag de siempre.
 *
 * Los imports llevan .js porque Vercel compila cada archivo por separado como ESM.
 */
import {
  buildLorenziBody,
  isAllowedLogoUrl,
  LORENZI_TABLE_PNG,
  MAX_LOGO_BYTES,
  MAX_TABLE_TEXT,
  sniffImageMime,
} from '../src/lib/lorenziEmblems.js'

async function logoDataUri(url: string | null): Promise<string | null> {
  if (!isAllowedLogoUrl(url)) return null
  try {
    // redirect: 'error' para que un redireccionamiento no saque la petición de mkcentral.com
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null
    const mime = sniffImageMime(bytes)
    return mime ? `data:${mime};base64,${Buffer.from(bytes).toString('base64')}` : null
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: { text?: unknown; teams?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const text = typeof body.text === 'string' ? body.text : ''
  if (!text || text.length > MAX_TABLE_TEXT || !Array.isArray(body.teams) || body.teams.length > 2) {
    return new Response('Bad request', { status: 400 })
  }

  const teams = body.teams as { tag?: unknown; logo?: unknown }[]
  const emblems = await Promise.all(
    teams.map(async (t) => ({
      tag: typeof t?.tag === 'string' ? t.tag.slice(0, 40) : '',
      dataUri: await logoDataUri(typeof t?.logo === 'string' ? t.logo : null),
    })),
  )

  const res = await fetch(LORENZI_TABLE_PNG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildLorenziBody(text, emblems)),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null)
  if (!res?.ok) return new Response('Lorenzi no disponible', { status: 502 })

  return new Response(await res.arrayBuffer(), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' },
  })
}
