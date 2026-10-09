/*
 * Logos de equipo de Mario Kart Central a través de api/logo.
 *
 * mkcentral.com no envía cabeceras CORS, así que el navegador no deja dibujar sus logos en un
 * canvas (se "contamina" y no se puede exportar el PNG). La función api/logo los descarga y los
 * sirve desde nuestro propio dominio, con el tipo MIME correcto (MKC a veces los manda como
 * binary/octet-stream).
 */

/** Solo se descargan logos alojados en MKC (evita usar la función como proxy abierto) */
const LOGO_HOSTS = new Set(['mkcentral.com', 'www.mkcentral.com'])
export const MAX_LOGO_BYTES = 1_500_000

export function isAllowedLogoUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 300) return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && LOGO_HOSTS.has(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

/** Tipo MIME según los primeros bytes (null si no es PNG, JPEG, GIF ni WebP) */
export function sniffImageMime(b: Uint8Array): string | null {
  const is = (...sig: number[]) => sig.every((v, i) => b[i] === v)
  if (is(0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (is(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (is(0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  if (is(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return null
}

/** URL desde la que el navegador puede cargar el logo para dibujarlo en un canvas */
export const proxiedLogoUrl = (url: string) => (isAllowedLogoUrl(url) ? `/api/logo?u=${encodeURIComponent(url)}` : url)
