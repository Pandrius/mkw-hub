import { supabase } from './supabase'
import type { TtCategory } from './timeTrials'

/**
 * Historial de récords personales (PB).
 * time_trials guarda TODOS los tiempos de cada jugador, así que la progresión
 * se reconstruye en el cliente: un PB es cada tiempo que mejora a todos los anteriores.
 */

/** Un tiempo de un jugador, con lo necesario para ordenarlo en el tiempo */
export type PlayerTime = {
  id: number
  track_id: string
  category: TtCategory
  nita: boolean
  time_ms: number
  achieved_on: string | null
  created_at: string
  proof_url: string | null
}

/** Un paso de la progresión: el nuevo PB y cuánto mejoró al anterior (null si es el primero) */
export type PbStep = {
  time: PlayerTime
  /** Fecha AAAA-MM-DD en que se consiguió */
  date: string
  /** Milisegundos ganados respecto al PB anterior (positivo = más rápido) */
  improvement_ms: number | null
}

/** Progresión de una pista + categoría + NITA */
export type PbHistory = {
  key: string
  track_id: string
  category: TtCategory
  nita: boolean
  /** PBs en orden cronológico (el último es el PB actual) */
  steps: PbStep[]
  /** Tiempos registrados en total (mejoren o no) */
  attempts: number
  /** Del primer tiempo al PB actual */
  total_improvement_ms: number
}

/** Resultado de comparar un tiempo nuevo con el PB anterior */
export type PbVerdict =
  | { kind: 'first' }
  | { kind: 'pb'; diff_ms: number }
  | { kind: 'tie' }
  | { kind: 'miss'; diff_ms: number }

/** Lo que se muestra al guardar un tiempo propio */
export type PbResult = {
  verdict: PbVerdict
  track_id: string
  category: TtCategory
  nita: boolean
  time_ms: number
  /** PB que tenía antes de guardar (null si era su primer tiempo) */
  previous_ms: number | null
}

export const historyKey =(trackId: string, category: TtCategory, nita: boolean) => `${trackId}|${category}|${nita ? 'nita' : 'items'}`

/** Fecha del tiempo: la que indicó el jugador o, si no hay, el día en que se añadió */
export const timeDate = (t: Pick<PlayerTime, 'achieved_on' | 'created_at'>) => (t.achieved_on ?? t.created_at).slice(0, 10)

/** Orden cronológico: fecha conseguida, luego cuándo se añadió y por último el id */
export function chronological(a: PlayerTime, b: PlayerTime): number {
  return timeDate(a).localeCompare(timeDate(b)) || a.created_at.localeCompare(b.created_at) || a.id - b.id
}

/** Progresión de PBs de una lista de tiempos (todos de la misma pista/categoría/NITA). Función pura. */
export function pbProgression(times: PlayerTime[]): PbStep[] {
  const steps: PbStep[] = []
  let best: number | null = null
  for (const t of [...times].sort(chronological)) {
    if (best !== null && t.time_ms >= best) continue
    steps.push({ time: t, date: timeDate(t), improvement_ms: best === null ? null : best - t.time_ms })
    best = t.time_ms
  }
  return steps
}

/** Agrupa todos los tiempos de un jugador y calcula la progresión de cada grupo. Función pura. */
export function buildHistories(times: PlayerTime[]): PbHistory[] {
  const groups = new Map<string, PlayerTime[]>()
  for (const t of times) {
    const key = historyKey(t.track_id, t.category, t.nita)
    const list = groups.get(key)
    if (list) list.push(t)
    else groups.set(key, [t])
  }
  return [...groups.entries()].map(([key, list]) => {
    const steps = pbProgression(list)
    const first = steps[0].time.time_ms
    const last = steps[steps.length - 1].time.time_ms
    const { track_id, category, nita } = list[0]
    return { key, track_id, category, nita, steps, attempts: list.length, total_improvement_ms: first - last }
  })
}

/** Los PBs más recientes de todas las pistas, del más nuevo al más antiguo. Función pura. */
export function recentPbs(histories: PbHistory[], limit = 6): (PbStep & { history: PbHistory })[] {
  return histories
    .flatMap((h) => h.steps.map((s) => ({ ...s, history: h })))
    .sort((a, b) => chronological(b.time, a.time))
    .slice(0, limit)
}

/** ¿Mejora el tiempo nuevo al PB anterior? previousBest = null si no había ningún tiempo. */
export function pbVerdict(previousBest: number | null, newTime: number): PbVerdict {
  if (previousBest === null) return { kind: 'first' }
  if (newTime < previousBest) return { kind: 'pb', diff_ms: previousBest - newTime }
  if (newTime === previousBest) return { kind: 'tie' }
  return { kind: 'miss', diff_ms: newTime - previousBest }
}

/**
 * Diferencia en segundos con signo y en el formato del idioma:
 * -412 → "−0,412 s" (es-ES) · 1500 → "+1.500 s" (en-GB) · 0 → "±0,000 s"
 */
export function formatDiff(ms: number, locale: string): string {
  const sign = ms < 0 ? '−' : ms > 0 ? '+' : '±'
  const n = new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Math.abs(ms) / 1000)
  return `${sign}${n} s`
}

export type ChartPoint = { x: number; y: number; step: PbStep }

/**
 * Coordenadas del gráfico de evolución (SVG). El eje X es la fecha (o el orden, si
 * todos los PBs son del mismo día) y el eje Y el tiempo: más rápido = más arriba.
 * Devuelve los puntos y un trazado escalonado (el PB se mantiene hasta que llega el siguiente).
 */
export function chartGeometry(
  steps: PbStep[],
  width: number,
  height: number,
  pad = 6,
): { points: ChartPoint[]; path: string } {
  if (steps.length === 0) return { points: [], path: '' }
  const days = steps.map((s) => Date.parse(`${s.date}T00:00:00Z`) / 86400000)
  const byDate = days[days.length - 1] > days[0]
  const xs = byDate ? days : steps.map((_, i) => i)
  const minX = xs[0]
  const spanX = xs[xs.length - 1] - minX
  const times = steps.map((s) => s.time.time_ms)
  const fastest = Math.min(...times)
  const slowest = Math.max(...times)
  const spanY = slowest - fastest

  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const round = (n: number) => Math.round(n * 10) / 10
  const points = steps.map((step, i) => ({
    // Un único PB queda centrado; si no, se reparten de izquierda a derecha
    x: round(spanX === 0 ? width / 2 : pad + ((xs[i] - minX) / spanX) * innerW),
    // Todos iguales (un solo punto): a media altura
    y: round(spanY === 0 ? height / 2 : pad + ((times[i] - fastest) / spanY) * innerH),
    step,
  }))

  const path = points
    .map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `H${p.x} V${p.y}`))
    .join(' ')
  return { points, path }
}

function client() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

/** Todos los tiempos de un jugador registrado (no solo el mejor) */
export async function listPlayerTimes(profileId: string): Promise<PlayerTime[]> {
  const { data, error } = await client()
    .from('time_trials')
    .select('id, track_id, category, nita, time_ms, achieved_on, created_at, proof_url')
    .eq('profile_id', profileId)
    .order('created_at')
    .limit(5000)
  if (error) throw error
  return data as PlayerTime[]
}

/** Mejor tiempo actual de un jugador en una pista/categoría/NITA (null si no tiene ninguno) */
export async function getPersonalBest(profileId: string, trackId: string, category: TtCategory, nita: boolean): Promise<number | null> {
  const { data, error } = await client()
    .from('time_trials')
    .select('time_ms')
    .eq('profile_id', profileId)
    .eq('track_id', trackId)
    .eq('category', category)
    .eq('nita', nita)
    .order('time_ms')
    .limit(1)
  if (error) throw error
  return data.length ? (data[0].time_ms as number) : null
}
