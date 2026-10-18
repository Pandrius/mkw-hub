/** Editor de tablas libre: jugadores y puntos sin límite, sin relación con ninguna estadística. */
export type FreeRow = { id: number; name: string; points: string }

export type RankedRow = { name: string; points: number; rank: number }

/** Número de un campo de puntos (admite negativos, para penalties); vacío o no válido cuenta 0 */
export function parsePoints(raw: string): number {
  const n = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

/** Filas ordenadas por puntos (a igualdad, por orden de entrada). Los empates comparten puesto: 1, 1, 3... Las filas sin nombre ni puntos se ignoran */
export function rankRows(rows: FreeRow[]): RankedRow[] {
  const used = rows.filter((r) => r.name.trim() !== '' || r.points.trim() !== '')
  const sorted = used
    .map((r, i) => ({ name: r.name.trim() || '—', points: parsePoints(r.points), i }))
    .sort((a, b) => b.points - a.points || a.i - b.i)
  const out: RankedRow[] = []
  sorted.forEach((r, k) => {
    const tied = k > 0 && out[k - 1].points === r.points
    out.push({ name: r.name, points: r.points, rank: tied ? out[k - 1].rank : k + 1 })
  })
  return out
}

/** Tabla en texto plano para pegar en un chat */
export function tableText(title: string, rows: RankedRow[]): string {
  const head = title.trim() ? `${title.trim()}\n` : ''
  return head + rows.map((r) => `${r.rank}. ${r.name} — ${r.points}`).join('\n')
}

/** Enlace compartible: la tabla viaja dentro de la dirección (no se guarda en ningún servidor) */
export type SharedTable = { title: string; rows: { name: string; points: string }[] }

/** Tamaño máximo de la tabla codificada, para que el enlace siga siendo manejable */
export const MAX_SHARE_LENGTH = 6000

const toBase64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** Codifica la tabla (sin las filas vacías) para el parámetro `d` del enlace */
export function encodeTable(title: string, rows: FreeRow[]): string {
  const used = rows.filter((r) => r.name.trim() !== '' || r.points.trim() !== '')
  return toBase64Url(JSON.stringify({ t: title.trim().slice(0, 60), r: used.map((r) => [r.name.trim().slice(0, 40), r.points.trim().slice(0, 12)]) }))
}

/** Lee el parámetro `d` de un enlace; null si no es una tabla válida */
export function decodeTable(data: string | null | undefined): SharedTable | null {
  if (!data || data.length > MAX_SHARE_LENGTH) return null
  try {
    const raw = JSON.parse(fromBase64Url(data)) as { t?: unknown; r?: unknown }
    if (!Array.isArray(raw.r)) return null
    const rows = raw.r
      .filter((x): x is [unknown, unknown] => Array.isArray(x) && x.length === 2)
      .map(([name, points]) => ({ name: String(name).slice(0, 40), points: String(points).slice(0, 12) }))
    return { title: typeof raw.t === 'string' ? raw.t.slice(0, 60) : '', rows }
  } catch {
    return null
  }
}
