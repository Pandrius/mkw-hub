import { getCup, getTrack } from '../data/tracks'
import { RACES_PER_EVENT, type GameEvent } from './events'
import type { WarTable } from './warTable'

/*
 * Datos para la imagen de la war (PNG para compartir en Discord).
 * Aquí solo se prepara la información, sin tocar el DOM: el dibujo está en warImageDraw.ts.
 */

export type WarImagePlayer = {
  name: string
  points: number
  races: number
  /** Posición media en las carreras que corrió (null si no hay posiciones) */
  avgPos: number | null
}

export type WarImageTeam = {
  tag: string
  name: string | null
  total: number
  /** Jugadores de más a menos puntos; vacío si no se conocen (rivales sin nombres) */
  players: WarImagePlayer[]
  /** Puntos por jugadores ausentes (carreras de 11/10) */
  missingPoints: number
  /** Penalties del equipo (puntos negativos), una fila cada una */
  penalties: { label: string; points: number }[]
}

export type WarImageRace = {
  raceNo: number
  /** Abreviatura de la pista (o su id si no está en la lista) */
  abbr: string
  /** Color de la copa, para la placa de la abreviatura */
  color: string
  home: number
  away: number
  diff: number
  /** Diferencia acumulada hasta esta carrera */
  runningDiff: number
}

export type WarImageData = {
  home: WarImageTeam
  away: WarImageTeam
  diff: number
  races: WarImageRace[]
  /** Número de huecos del gráfico (12, o más si alguna vez hubiera más carreras) */
  slots: number
  inProgress: boolean
  /** Fecha del evento (ISO) */
  date: string
  /** Escala simétrica del gráfico de diferencia acumulada */
  scale: { min: number; max: number; step: number }
}

const FALLBACK_COLOR = '#a5a29a'

/** Diferencia con signo: +12, -5, 0 */
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/**
 * Escala "redonda" para el gráfico de diferencia acumulada: va de un múltiplo de un paso cómodo
 * (5, 10, 20, 25, 50, 100…) a otro y siempre incluye el 0. Solo baja de 0 si la war ha ido
 * por debajo en algún momento (así una war cómoda no desperdicia medio gráfico).
 */
export function niceScale(values: number[]): { min: number; max: number; step: number } {
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  if (lo === 0 && hi === 0) return { min: -10, max: 10, step: 10 }
  // Unas 4 divisiones en total
  const raw = Math.max(10, hi - lo) / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((st) => st >= raw) ?? 10 * pow
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step }
}

const avg = (positions: Record<number, number>) => {
  const values = Object.values(positions)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/**
 * Prepara todo lo que necesita la imagen a partir del evento y de su tabla.
 * `showOpponentPlayers`: solo si los rivales tienen nombres reales (si no, la tabla
 * los rellena con nombres automáticos que no aportan nada en la imagen).
 */
export function buildWarImageData(event: GameEvent, table: WarTable, showOpponentPlayers: boolean): WarImageData {
  const races: WarImageRace[] = table.races.map((r) => {
    const track = getTrack(r.race.track_id)
    return {
      raceNo: r.race.race_no,
      abbr: track?.abbr ?? r.race.track_id,
      color: (track && getCup(track.cupId)?.color) || FALLBACK_COLOR,
      home: r.home,
      away: r.away,
      diff: r.diff,
      runningDiff: r.runningDiff,
    }
  })
  const lastRaceNo = races.reduce((m, r) => Math.max(m, r.raceNo), 0)

  return {
    home: {
      tag: event.team_tag?.trim() || '?',
      name: event.team_name?.trim() || null,
      total: table.home,
      players: table.players.map((p) => ({
        name: p.player.name,
        points: p.points,
        races: p.races,
        avgPos: avg(p.positions),
      })),
      missingPoints: table.missingPoints,
      penalties: table.penalties.filter((x) => x.side === 'home').map(({ label, points }) => ({ label, points })),
    },
    away: {
      tag: event.opponent_tag?.trim() || '?',
      name: event.opponent_name?.trim() || null,
      total: table.away,
      players: showOpponentPlayers
        ? table.opponentPlayers.map((p) => ({ name: p.name, points: p.points, races: p.races, avgPos: avg(p.positions) }))
        : [],
      missingPoints: 0,
      penalties: table.penalties.filter((x) => x.side === 'away').map(({ label, points }) => ({ label, points })),
    },
    diff: table.diff,
    races,
    slots: Math.max(RACES_PER_EVENT, lastRaceNo),
    inProgress: event.status === 'open',
    date: event.finished_at ?? event.created_at,
    scale: niceScale(races.map((r) => r.runningDiff)),
  }
}

/** ¿Los rivales tienen nombres de verdad (indicados al crear la war o apuntados en alguna carrera)? */
export function hasRealOpponents(event: GameEvent, races: { opponent_results?: unknown[] | null }[]): boolean {
  return (event.opponent_players?.some((n) => n.trim()) ?? false) || races.some((r) => (r.opponent_results?.length ?? 0) > 0)
}

/** Nombre de archivo seguro: war-NB-vs-RKL-2026-10-05.png */
export function warImageFileName(data: Pick<WarImageData, 'home' | 'away' | 'date'>): string {
  const clean = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[^\w-]+/g, '')
      .slice(0, 20) || 'team'
  return `war-${clean(data.home.tag)}-vs-${clean(data.away.tag)}-${data.date.slice(0, 10)}.png`
}

/**
 * Recorta un texto para que quepa en `maxWidth` añadiendo "…".
 * `measure` devuelve el ancho de un texto (en el canvas, ctx.measureText(s).width).
 */
export function fitText(text: string, maxWidth: number, measure: (s: string) => number): string {
  if (measure(text) <= maxWidth) return text
  const chars = [...text]
  let lo = 0
  let hi = chars.length
  // Búsqueda binaria del prefijo más largo que cabe con la elipsis
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(chars.slice(0, mid).join('') + '…') <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return chars.slice(0, lo).join('').trimEnd() + '…'
}
