import type { Track } from '../data/tracks'
import { supabase } from './supabase'

/*
 * Búsqueda global de la cabecera: jugadores, equipos y pistas.
 * Las pistas se buscan en local (src/data/tracks.ts); jugadores y equipos, en Supabase.
 * Todo lo que ordena y filtra resultados es puro y está en este archivo (ver search.test.ts).
 */

export type SearchKind = 'player' | 'team' | 'track'

export type SearchHit = {
  kind: SearchKind
  /** Id de la ruta: uuid del perfil, id numérico del equipo (como texto) o id de la pista */
  id: string
  /** Texto principal */
  label: string
  /** Texto secundario: tag del equipo, abreviatura de la pista… */
  detail?: string | null
  /** Campos en los que se busca; el primero es el principal y puntúa algo más */
  terms: (string | null | undefined)[]
  /** Avatar del jugador o logo del equipo */
  image?: string | null
  /** Código ISO del país del jugador */
  country?: string | null
}

export type SearchGroup = { kind: SearchKind; hits: SearchHit[] }

/** Orden fijo de los grupos en el desplegable */
export const KIND_ORDER: SearchKind[] = ['player', 'team', 'track']

/** Mínimo de caracteres para consultar la base de datos */
export const REMOTE_MIN_LENGTH = 2

/** Minúsculas y sin tildes, para comparar "Estadísticas" con "estadisticas" */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Limpia el texto para usarlo dentro de un filtro ilike de PostgREST:
 * quita comodines (% _ *), comas, paréntesis, comillas y barras, que romperían el filtro .or().
 */
export function sanitizeTerm(q: string): string {
  return q
    .replace(/[%_*,()"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
}

/**
 * Puntuación de un texto frente a la consulta (0 = no coincide):
 * igual 100, empieza por 80, alguna palabra empieza por 60, contiene 40.
 */
export function matchScore(query: string, text: string | null | undefined): number {
  const q = normalize(query)
  if (!q || !text) return 0
  const t = normalize(text)
  if (!t) return 0
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.split(/[\s\-.'·/]+/).some((w) => w.startsWith(q))) return 60
  if (t.includes(q)) return 40
  return 0
}

/** Mejor puntuación entre los campos; coincidir en el principal suma un poco */
export function scoreHit(query: string, hit: Pick<SearchHit, 'terms'>): number {
  let best = 0
  hit.terms.forEach((term, i) => {
    const s = matchScore(query, term)
    if (s > 0) best = Math.max(best, s + (i === 0 ? 5 : 0))
  })
  return best
}

/** Pistas que coinciden por nombre, abreviatura o juego de origen (sin red) */
export function searchTracks(query: string, tracks: Track[]): SearchHit[] {
  if (!normalize(query)) return []
  return tracks
    .map(
      (track): SearchHit => ({
        kind: 'track',
        id: track.id,
        label: track.name,
        detail: track.abbr ?? null,
        // La "r" de las retro es opcional al buscar: "dkp" también encuentra rDKP
        terms: [track.name, track.abbr, track.abbr?.replace(/^r(?=[A-Z])/, ''), track.origin],
      }),
    )
    .filter((hit) => scoreHit(query, hit) > 0)
}

/**
 * Ordena y agrupa los resultados: descarta los que no coinciden (p. ej. resultados
 * remotos de una consulta anterior), quita duplicados, ordena por puntuación y nombre
 * y se queda con los `limit` mejores de cada tipo.
 */
export function rankHits(query: string, hits: SearchHit[], limit = 5): SearchGroup[] {
  const seen = new Set<string>()
  const scored: { hit: SearchHit; score: number }[] = []
  for (const hit of hits) {
    const key = `${hit.kind}:${hit.id}`
    if (seen.has(key)) continue
    const score = scoreHit(query, hit)
    if (score <= 0) continue
    seen.add(key)
    scored.push({ hit, score })
  }
  scored.sort(
    (a, b) => b.score - a.score || a.hit.label.localeCompare(b.hit.label, undefined, { sensitivity: 'base' }),
  )
  return KIND_ORDER.map((kind) => ({
    kind,
    hits: scored
      .filter((s) => s.hit.kind === kind)
      .slice(0, limit)
      .map((s) => s.hit),
  })).filter((g) => g.hits.length > 0)
}

/** Ruta de cada resultado */
export function hitHref(hit: Pick<SearchHit, 'kind' | 'id'>): string {
  const id = encodeURIComponent(hit.id)
  if (hit.kind === 'player') return `/estadisticas/${id}`
  if (hit.kind === 'team') return `/equipos/${id}`
  return `/pistas/${id}`
}

/** Siguiente opción activa con las flechas, dando la vuelta en los extremos (-1 si no hay opciones) */
export function moveIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return -1
  if (current < 0) return delta > 0 ? 0 : length - 1
  return (((current + delta) % length) + length) % length
}

type ShortcutEvent = {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  target: EventTarget | null
}

/** ¿El foco está en un sitio donde se escribe? (para no robar la "/" a un campo de texto) */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as { tagName?: string; isContentEditable?: boolean }
  const tag = el.tagName?.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}

/** Atajos para abrir el buscador: "/" (fuera de campos de texto) o Ctrl/Cmd + K */
export function isSearchShortcut(e: ShortcutEvent): boolean {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') return true
  return e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)
}

/** Jugadores y equipos que coinciden con la consulta (sin ordenar: eso lo hace rankHits) */
export async function searchRemote(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const q = sanitizeTerm(query)
  if (!supabase || q.length < REMOTE_MIN_LENGTH) return []
  const pattern = `%${q}%`
  const players = supabase.from('profiles').select('id, username, country_code, avatar_url').ilike('username', pattern).limit(20)
  const teams = supabase
    .from('teams')
    .select('id, name, tag, parent_name, logo_url')
    .or(`name.ilike.${pattern},tag.ilike.${pattern},parent_name.ilike.${pattern}`)
    .limit(20)
  const [p, t] = await Promise.all(signal ? [players.abortSignal(signal), teams.abortSignal(signal)] : [players, teams])
  if (p.error) throw p.error
  if (t.error) throw t.error
  return [
    ...(p.data ?? []).map(
      (row): SearchHit => ({
        kind: 'player',
        id: row.id as string,
        label: row.username as string,
        terms: [row.username as string],
        image: row.avatar_url as string | null,
        country: row.country_code as string | null,
      }),
    ),
    ...(t.data ?? []).map((row): SearchHit => {
      const parent = row.parent_name as string | null
      return {
        kind: 'team',
        id: String(row.id),
        label: row.name as string,
        detail: parent && parent !== row.name ? `${row.tag} · ${parent}` : (row.tag as string),
        terms: [row.name as string, row.tag as string, parent],
        image: row.logo_url as string | null,
      }
    }),
  ]
}
