import { getTrack } from '../data/tracks'
import type { MessageKey } from '../i18n/es'
import type { Tier } from '../lib/badges'
import { CROWN_TITLES, LOUNGE_RANKS, type TitleDef } from '../lib/titles'
import { ALL_MIN_RACES, WEEK_MIN_RACES } from '../lib/trackBoard'
import { RUBY, TIER_COLOR, tierLabel } from './tiers'

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

/** Identificadores de los títulos de las coronas de la comunidad */
export const CROWN_TITLE_IDS = new Set(Object.values(CROWN_TITLES).flatMap((c) => [c.now, c.ever]))

const trackName = (id: string) => getTrack(id)?.abbr ?? getTrack(id)?.name ?? id

/** Nombre de una insignia o logro destacado */
export function featuredName(id: string, t: Translate, tier = 0): string {
  const [kind, key] = id.split(':')
  // El rango de guerra se llama como su nivel actual (soldado raso, cabo...)
  if (id === 'ach:warWins') return t(`ach.warWins.rank.${tier}` as MessageKey)
  if (kind === 'ach') return t(`ach.${key}.name` as MessageKey)
  if (kind === 'badge') return t(`badge.${key}` as MessageKey)
  return t('showcase.trackBadge', { track: trackName(key) })
}

/** Nombre y color del nivel de una insignia destacada: el evento legendario es «Rubí» (rojo) y la leyenda absoluta «Legendario» (multicolor) */
export function featuredTier(id: string, tier: Tier, t: Translate): { label: string; color: string; multi: boolean } {
  if (id === 'ach:legendEvent') return { label: t('badge.tier.ruby' as MessageKey), color: RUBY, multi: false }
  if (id === 'ach:allAchievements') return { label: t('badge.tier.legendary' as MessageKey), color: TIER_COLOR[tier], multi: true }
  return { label: t(tierLabel(tier)), color: TIER_COLOR[tier], multi: false }
}

/** Nombre de un título (los de pista, MMR y ranking se completan con su parámetro) */
export function titleName(def: Pick<TitleDef, 'id' | 'param'>, t: Translate): string {
  if (def.id.startsWith('owner:')) return t('title.owner.name', { track: trackName(def.param ?? '') })
  if (def.id.startsWith('weekly:')) return t('title.weekly.name', { track: trackName(def.param ?? '') })
  // Los títulos «alguna vez» de las coronas llevan las veces
  if (CROWN_TITLE_IDS.has(def.id)) return t(`title.${def.id}.name` as MessageKey, { n: def.param ?? '' })
  if (def.id.startsWith('rank:')) return t(`rank.${def.param}` as MessageKey)
  if (def.id.startsWith('top:')) return t('title.top.name', { pct: def.param ?? '' })
  return t(`title.${def.id}.name` as MessageKey)
}

export function titleHow(def: TitleDef, t: Translate): string {
  if (def.id.startsWith('owner:')) return t('title.owner.how', { track: trackName(def.param ?? ''), n: ALL_MIN_RACES })
  if (def.id.startsWith('weekly:')) return t('title.weekly.how', { track: trackName(def.param ?? ''), n: WEEK_MIN_RACES })
  if (def.id.startsWith('rank:')) {
    const min = LOUNGE_RANKS.find((r) => r.key === def.param)?.min ?? 0
    return t('title.rank.how', { rank: t(`rank.${def.param}` as MessageKey), n: min.toLocaleString('en') })
  }
  if (def.id.startsWith('top:')) return t('title.top.how', { pct: def.param ?? '' })
  return t(`title.${def.id}.how` as MessageKey)
}
