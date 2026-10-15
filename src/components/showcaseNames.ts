import { getTrack } from '../data/tracks'
import type { MessageKey } from '../i18n/es'
import { LOUNGE_RANKS, type TitleDef } from '../lib/titles'

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

const trackName = (id: string) => getTrack(id)?.abbr ?? getTrack(id)?.name ?? id

/** Nombre de una insignia o logro destacado */
export function featuredName(id: string, t: Translate): string {
  const [kind, key] = id.split(':')
  if (kind === 'ach') return t(`ach.${key}.name` as MessageKey)
  if (kind === 'badge') return t(`badge.${key}` as MessageKey)
  return t('showcase.trackBadge', { track: trackName(key) })
}

/** Nombre de un título (los de pista, MMR y ranking se completan con su parámetro) */
export function titleName(def: Pick<TitleDef, 'id' | 'param'>, t: Translate): string {
  if (def.id.startsWith('owner:')) return t('title.owner.name', { track: trackName(def.param ?? '') })
  if (def.id.startsWith('rank:')) return t(`rank.${def.param}` as MessageKey)
  if (def.id.startsWith('top:')) return t('title.top.name', { pct: def.param ?? '' })
  return t(`title.${def.id}.name` as MessageKey)
}

export function titleHow(def: TitleDef, t: Translate): string {
  if (def.id.startsWith('owner:')) return t('title.owner.how', { track: trackName(def.param ?? '') })
  if (def.id.startsWith('rank:')) {
    const min = LOUNGE_RANKS.find((r) => r.key === def.param)?.min ?? 0
    return t('title.rank.how', { rank: t(`rank.${def.param}` as MessageKey), n: min.toLocaleString('en') })
  }
  if (def.id.startsWith('top:')) return t('title.top.how', { pct: def.param ?? '' })
  return t(`title.${def.id}.how` as MessageKey)
}
