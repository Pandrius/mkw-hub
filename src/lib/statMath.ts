/*
 * Utilidades numéricas compartidas por las estadísticas de jugador, equipo y war (funciones puras).
 */

/** Carreras de un evento: la puntuación "por war" de un jugador se expresa sobre 12 carreras */
export const RACES_PER_WAR = 12

/** Las tres fases de un evento de 12 carreras */
export type Phase = 'open' | 'mid' | 'close'
export const PHASES: Phase[] = ['open', 'mid', 'close']

/** Carreras 1-4 apertura, 5-8 tramo central, 9-12 cierre */
export const phaseOf = (raceNo: number): Phase => (raceNo <= 4 ? 'open' : raceNo <= 8 ? 'mid' : 'close')

export const round1 = (n: number) => Math.round(n * 10) / 10
export const round2 = (n: number) => Math.round(n * 100) / 100

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0)

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Desviación típica (poblacional) */
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

/** Porcentaje entero (0 si no hay total) */
export const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

/**
 * Media de desviaciones "encogida" hacia 0: con pocas muestras se le añaden `prior` muestras
 * ficticias a 0, para que una sola carrera buena no ponga una pista arriba del todo.
 */
export const shrink = (deviationSum: number, n: number, prior = 3) => (n ? deviationSum / (n + prior) : 0)

/** Media móvil de `size` elementos (solo desde que hay `size` elementos) */
export function rolling(xs: number[], size: number): number[] {
  const out: number[] = []
  let acc = 0
  xs.forEach((x, i) => {
    acc += x
    if (i >= size) acc -= xs[i - size]
    if (i >= size - 1) out.push(acc / size)
  })
  return out
}

/** Victorias / derrotas / empates según el signo de cada diferencia */
export type Record3 = { w: number; l: number; t: number }
export function recordOf(diffs: number[]): Record3 {
  return {
    w: diffs.filter((d) => d > 0).length,
    l: diffs.filter((d) => d < 0).length,
    t: diffs.filter((d) => d === 0).length,
  }
}
