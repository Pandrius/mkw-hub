/**
 * Logos de equipo de Mario Kart Central servidos desde nuestro dominio.
 *
 * GET /api/logo?u=<URL del logo en mkcentral.com> → la imagen, con su tipo MIME real.
 * Así el navegador puede dibujarlos en el canvas de la imagen de la war (MKC no permite CORS).
 *
 * Los imports llevan .js porque Vercel compila cada archivo por separado como ESM.
 */
import { isAllowedLogoUrl, MAX_LOGO_BYTES, sniffImageMime } from '../src/lib/logoProxy.js'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url).searchParams.get('u')
  if (!isAllowedLogoUrl(url)) return new Response('Bad request', { status: 400 })

  try {
    // redirect: 'error' para que un redireccionamiento no saque la petición de mkcentral.com
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return new Response('Not found', { status: 404 })
    const bytes = new Uint8Array(await res.arrayBuffer())
    const mime = sniffImageMime(bytes)
    if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES || !mime) return new Response('Unsupported image', { status: 415 })
    return new Response(bytes, {
      headers: {
        'Content-Type': mime,
        'X-Content-Type-Options': 'nosniff',
        // Los logos casi nunca cambian: un día en el navegador y una semana en la CDN de Vercel
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    })
  } catch {
    return new Response('Bad gateway', { status: 502 })
  }
}
