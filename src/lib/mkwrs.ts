/**
 * Récords mundiales de Mario Kart World desde mkwrs.com (la web del canal @MKWorldRecords).
 * Fuente: https://mkwrs.com/data/mkworld_wrs.csv (sin cabecera, 30 columnas).
 */
// Imports con .js: este archivo también lo usa la función de Vercel (api/sync.ts)
import { TRACKS } from '../data/tracks.js'
import { countryCodeFromName } from './countries.js'

export const MKWRS_CSV_URL = 'https://mkwrs.com/data/mkworld_wrs.csv'

export type WorldRecordRow = {
  id: number
  track_id: string
  time_ms: number
  player_name: string
  country_code: string | null
  achieved_on: string
  days_held: number | null
  video_url: string | null
  character: string | null
  vehicle: string | null
  splits: string[]
}

/** Parser CSV mínimo (comillas dobles y comillas escapadas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// Columnas del CSV de mkwrs
const COL = { id: 0, player: 1, date: 2, track: 3, timeMs: 4, nation: 6, video: 7, vehicle: 10, daysHeld: 14, character: 15 }
const SPLIT_COLS = [16, 17, 18, 21, 22, 23, 24]

const trackIdByName = new Map(TRACKS.map((t) => [t.name.toLowerCase(), t.id]))

const clean = (v: string | undefined) => {
  const s = v?.trim()
  return s && s !== '-' && s !== '\\N' && s !== 'N/A' ? s : null
}

/** Convierte una fila del CSV. Devuelve null si la pista no es de las nuestras (p. ej. categorías "Glitch"). */
export function toWorldRecord(cols: string[]): WorldRecordRow | null {
  const trackId = trackIdByName.get(cols[COL.track]?.trim().toLowerCase() ?? '')
  const id = Number(cols[COL.id])
  const timeMs = Number(cols[COL.timeMs])
  const date = clean(cols[COL.date])
  if (!trackId || !Number.isInteger(id) || !Number.isInteger(timeMs) || !date) return null

  const video = clean(cols[COL.video])
  const days = Number(cols[COL.daysHeld])
  return {
    id,
    track_id: trackId,
    time_ms: timeMs,
    player_name: clean(cols[COL.player]) ?? 'Unknown',
    country_code: countryCodeFromName(cols[COL.nation]),
    achieved_on: date,
    days_held: Number.isFinite(days) ? days : null,
    video_url: video?.startsWith('https://') ? video : null,
    character: clean(cols[COL.character]),
    vehicle: clean(cols[COL.vehicle]),
    splits: SPLIT_COLS.map((c) => clean(cols[c])).filter((s): s is string => s !== null),
  }
}

export function parseWorldRecords(csv: string): WorldRecordRow[] {
  return parseCsv(csv)
    .map(toWorldRecord)
    .filter((r): r is WorldRecordRow => r !== null)
}
