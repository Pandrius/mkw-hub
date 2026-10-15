/**
 * Recompensas del perfil: hasta 3 insignias destacadas y un título que se muestran junto al nombre.
 * Solo se pueden elegir las que ya se han ganado, y se comprueba en el servidor (api/showcase.ts) con estas mismas funciones.
 * Los logros y las insignias solo cuentan eventos verificados, así que un título nunca depende de datos sin comprobar.
 */
import type { Achievement, AchievementId, Glyph } from './achievements.js'
import type { BadgeSet, Tier } from './badges.js'
import { topPercent } from './lounge.js'

export const MAX_FEATURED = 3

/** Lo que hace falta del Lounge para los títulos de ranking (datos que vienen de la API del Lounge, no del usuario) */
export type LoungeFacts = {
  peakMmr: number | null
  /** Percentil superior (1 = el mejor) en la temporada actual */
  topPercent: number | null
  sqTables: number
}

export type TitleContext = {
  achievements: Achievement[]
  badges: BadgeSet
  /** Pistas dominadas (ver ownedTracks) */
  ownedTracks: string[]
  lounge: LoungeFacts | null
}

// ───────────────────────── Insignias destacadas ─────────────────────────

/** `ach:<logro>`, `badge:races|events|explorer` o `track:<pista>` */
export type FeaturedId = string

export type Featurable = { id: FeaturedId; glyph: Glyph; tier: Tier }

/** Todas las insignias y logros con al menos un nivel (las únicas que se pueden destacar) */
export function featurable(achievements: Achievement[], badges: BadgeSet): Featurable[] {
  return [
    ...achievements.map((a): Featurable => ({ id: `ach:${a.id}`, glyph: a.glyph, tier: a.tier })),
    { id: 'badge:races', glyph: 'bars', tier: badges.races.tier } satisfies Featurable,
    { id: 'badge:events', glyph: 'flag', tier: badges.events.tier } satisfies Featurable,
    { id: 'badge:explorer', glyph: 'ring', tier: badges.explorer.tier } satisfies Featurable,
    ...badges.tracks.map((b): Featurable => ({ id: `track:${b.trackId}`, glyph: 'ring', tier: b.tier })),
  ].filter((f) => f.tier > 0)
}

/** Rayos de los escudos del evento perfecto y de la leyenda absoluta: simples, ramificados o sin rayos */
export type BoltStyle = 'simple' | 'forked' | 'none'
export const BOLT_STYLES: BoltStyle[] = ['simple', 'forked', 'none']
export const DEFAULT_BOLT_STYLE: BoltStyle = 'simple'
export const isBoltStyle = (v: unknown): v is BoltStyle => typeof v === 'string' && (BOLT_STYLES as string[]).includes(v)
/** Premio: solo quien ha conseguido el evento perfecto o la leyenda absoluta puede elegir cómo se ven sus rayos */
export const canPickBolts = (owned: Featurable[]) => owned.some((f) => f.id === 'ach:perfectEvent' || f.id === 'ach:allAchievements')

/** Comprueba una selección de insignias destacadas: sin repetidas, hasta 3 y todas ganadas. Devuelve la lista limpia o null */
export function validateFeatured(ids: unknown, owned: Featurable[]): FeaturedId[] | null {
  if (!Array.isArray(ids) || ids.length > MAX_FEATURED) return null
  const out: FeaturedId[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || out.includes(id) || !owned.some((f) => f.id === id)) return null
    out.push(id)
  }
  return out
}

// ───────────────────────── Títulos ─────────────────────────

export type TitleDef = {
  id: string
  /** Texto del título (clave i18n `title.<id>.name`) o, en los dinámicos, el parámetro que lo completa */
  param?: string
  earned: boolean
  /** Por qué categoría se consigue, para agruparlos */
  group: 'achievement' | 'track' | 'lounge'
}

const tierOf = (ctx: TitleContext, id: AchievementId) => ctx.achievements.find((a) => a.id === id)?.tier ?? 0
const countOf = (ctx: TitleContext, id: AchievementId) => ctx.achievements.find((a) => a.id === id)?.count ?? 0

/** Título estático ← logro y nivel mínimo para conseguirlo */
export const ACHIEVEMENT_TITLES: { id: string; achievement: AchievementId; tier: Tier; /** Cantidad mínima, para logros de un solo nivel */ count?: number }[] = [
  { id: 'perfectionist', achievement: 'perfectEvent', tier: 1 },
  { id: 'untouchable', achievement: 'perfectEvent', tier: 1, count: 3 },
  { id: 'grandMaster', achievement: 'allAchievements', tier: 1 },
  { id: 'natureWinner', achievement: 'wins', tier: 3 },
  { id: 'podiumKing', achievement: 'podiums', tier: 3 },
  { id: 'unstoppable', achievement: 'winStreak', tier: 3 },
  { id: 'ironDriver', achievement: 'top6Streak', tier: 3 },
  { id: 'cleanDriver', achievement: 'cleanEvent', tier: 3 },
  { id: 'comeback', achievement: 'redemption', tier: 3 },
  { id: 'closer', achievement: 'finalRace', tier: 3 },
  { id: 'legend', achievement: 'legendEvent', tier: 1, count: 8 },
  { id: 'allTerrain', achievement: 'podiumEverywhere', tier: 4 },
  { id: 'trackMaster', achievement: 'winEverywhere', tier: 5 },
]

/** Rangos del Lounge de 12 jugadores y el MMR mínimo de cada uno (Iron, por debajo de 2000, no da título) */
export const LOUNGE_RANKS = [
  { key: 'bronze', min: 2000 },
  { key: 'silver', min: 4000 },
  { key: 'gold', min: 6000 },
  { key: 'platinum', min: 8000 },
  { key: 'sapphire', min: 9500 },
  { key: 'ruby', min: 11000 },
  { key: 'diamond', min: 12500 },
  { key: 'master', min: 14000 },
  { key: 'grandmaster', min: 15000 },
] as const
export type LoungeRankKey = (typeof LOUNGE_RANKS)[number]['key']
/** Percentil superior necesario para los títulos de ranking */
export const TOP_PERCENTS = [10, 5, 1]
/** Mesas SQ necesarias para ser «Jugador de SQ» */
export const SQ_TABLES = 25

/** Catálogo completo de títulos con si están ganados. Los de pista y de MMR se generan según los datos del jugador */
export function titleCatalog(ctx: TitleContext): TitleDef[] {
  const list: TitleDef[] = ACHIEVEMENT_TITLES.map((t) => ({ id: t.id, group: 'achievement', earned: tierOf(ctx, t.achievement) >= t.tier && countOf(ctx, t.achievement) >= (t.count ?? 0) }))
  list.push(
    { id: 'veteran', group: 'achievement', earned: ctx.badges.races.tier >= 3 },
    { id: 'globetrotter', group: 'achievement', earned: ctx.badges.explorer.tier >= 4 },
  )
  for (const trackId of ctx.ownedTracks) list.push({ id: `owner:${trackId}`, param: trackId, group: 'track', earned: true })

  const lounge = ctx.lounge
  for (const p of TOP_PERCENTS) list.push({ id: `top:${p}`, param: String(p), group: 'lounge', earned: !!lounge && lounge.topPercent !== null && lounge.topPercent <= p })
  for (const r of LOUNGE_RANKS) list.push({ id: `rank:${r.key}`, param: r.key, group: 'lounge', earned: !!lounge && lounge.peakMmr !== null && lounge.peakMmr >= r.min })
  list.push({ id: 'sqPlayer', group: 'lounge', earned: !!lounge && lounge.sqTables >= SQ_TABLES })
  return list
}

/** Comprueba el título elegido (null = sin título). Devuelve undefined si no es válido */
export function validateTitle(id: unknown, ctx: TitleContext): string | null | undefined {
  if (id === null || id === '') return null
  if (typeof id !== 'string') return undefined
  return titleCatalog(ctx).some((t) => t.id === id && t.earned) ? id : undefined
}

/** Mesas SQ del historial (para el título de SQ) */
export function countSqTables(changes: { reason: string; tier: string | null }[]): number {
  return changes.filter((c) => c.reason === 'Table' && c.tier === 'SQ').length
}

/** Datos del Lounge que piden los títulos, a partir de la cuenta enlazada y su historial de MMR (todas las temporadas) */
export function loungeFactsOf(
  account: { overallRank: number | null; totalPlayers: number | null } | null,
  changes: { reason: string; tier: string | null; newMmr: number }[],
): LoungeFacts | null {
  if (!account) return null
  return {
    peakMmr: changes.length ? Math.max(...changes.map((c) => c.newMmr)) : null,
    topPercent: topPercent(account.overallRank, account.totalPlayers),
    sqTables: countSqTables(changes),
  }
}
