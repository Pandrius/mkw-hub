/*
 * Escudos de equipo en la imagen de la tabla de Lorenzi.
 *
 * La URL pública (table.png?data=…) no admite estilos, pero su API (POST /table.png) sí:
 * style.emblemTag1 / emblemSrc1 (y 2) sustituyen el tag del equipo por una imagen. El servidor
 * de Lorenzi solo la dibuja si llega como data: URI con un tipo MIME de imagen correcto
 * (los logos de MKC a veces se sirven como binary/octet-stream), así que la petición
 * la hace api/war-table.ts, que descarga los logos y los convierte.
 */

export const LORENZI_TABLE_PNG = 'https://gb2.hlorenzi.com/table.png'

/** Solo se descargan logos alojados en Mario Kart Central (evita usar la función como proxy abierto) */
const LOGO_HOSTS = new Set(['mkcentral.com', 'www.mkcentral.com'])
export const MAX_LOGO_BYTES = 1_500_000
export const MAX_TABLE_TEXT = 4000

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

/** Cuerpo de la petición a Lorenzi: el texto de la tabla y, como estilo, los escudos ya convertidos a data: URI */
export function buildLorenziBody(
  text: string,
  emblems: { tag: string; dataUri: string | null }[],
): { data: string; style?: Record<string, string> } {
  const style: Record<string, string> = {}
  emblems.slice(0, 2).forEach((e, i) => {
    if (!e.dataUri || !e.tag) return
    style[`emblemTag${i + 1}`] = e.tag
    style[`emblemSrc${i + 1}`] = e.dataUri
  })
  return Object.keys(style).length > 0 ? { data: text, style } : { data: text }
}
