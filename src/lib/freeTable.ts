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
