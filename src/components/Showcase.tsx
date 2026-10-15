import { useState } from 'react'
import { getTrack, getTrackPlateBackground, getTrackTextColor } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import type { Tier } from '../lib/badges'
import { supabase } from '../lib/supabase'
import { MAX_FEATURED, titleCatalog, type Featurable, type TitleContext, type TitleDef } from '../lib/titles'
import { MedalIcon } from './Medal'
import { Plate } from './ui'
import { featuredName, titleHow, titleName } from './showcaseNames'
import { medalKindOf, TIER_COLOR, tierLabel } from './tiers'

/**
 * Un título como se ve en el perfil. «Dueño de …» lleva la placa de la pista (mismo color y letras que su abreviatura; Rainbow Road,
 * con el multicolor animado), «Leyenda absoluta» tiene las letras multicolor que cambian y el resto, el amarillo de la web.
 */
export function TitleChip({ def, size = 'md' }: { def: Pick<TitleDef, 'id' | 'param'>; size?: 'sm' | 'md' }) {
  const { t } = useI18n()
  const name = titleName(def, t)
  const pad = size === 'md' ? { padding: '6px 12px', fontSize: '1rem' } : { padding: '3px 8px', fontSize: '0.8rem' }
  if (def.id.startsWith('owner:')) {
    const track = getTrack(def.param ?? '')
    const rainbow = track?.abbr === 'RR'
    return (
      <Plate
        color={rainbow ? undefined : getTrackPlateBackground(track)}
        textColor={rainbow ? '#16121f' : getTrackTextColor(track)}
        className={rainbow ? 'plate-multi' : ''}
        style={{ ...pad, textTransform: 'uppercase', whiteSpace: 'nowrap' }}
      >
        {name}
      </Plate>
    )
  }
  if (def.id === 'grandMaster') {
    return (
      <span className="inline-block border-2 border-line bg-bg font-display font-extrabold tracking-wide whitespace-nowrap uppercase" style={pad}>
        <span className="title-multi">{name}</span>
      </span>
    )
  }
  return (
    <span className="inline-block bg-kart-yellow font-display font-extrabold tracking-wide whitespace-nowrap text-bg uppercase" style={pad}>
      {name}
    </span>
  )
}

/** Título y hasta 3 insignias destacadas junto al nombre. Solo se muestran las que el jugador tiene ganadas */
export function ProfileShowcase({ featuredIds, titleId, owned, ctx }: { featuredIds: string[]; titleId: string | null; owned: Featurable[]; ctx: TitleContext }) {
  const { t } = useI18n()
  const medals = featuredIds.flatMap((id) => {
    const f = owned.find((o) => o.id === id)
    return f ? [f] : []
  })
  const title = titleId ? titleCatalog(ctx).find((d) => d.id === titleId && d.earned) : undefined
  if (!title && medals.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-3">
      {title && (
        <span title={titleHow(title, t)}>
          <TitleChip def={title} />
        </span>
      )}
      {medals.map((m) => (
        <span key={m.id} title={`${featuredName(m.id, t)} · ${t(tierLabel(m.tier))}`}>
          <MedalIcon glyph={m.glyph} tier={m.tier} size={30} kind={medalKindOf(m.id)} levels={Math.max(4, m.tier)} />
        </span>
      ))}
    </div>
  )
}

/** Editor de las recompensas: elige hasta 3 insignias y un título entre los que ya has ganado */
export function ShowcaseEditor({
  featuredIds,
  titleId,
  owned,
  ctx,
  onSaved,
  onClose,
}: {
  featuredIds: string[]
  titleId: string | null
  owned: Featurable[]
  ctx: TitleContext
  onSaved: (badges: string[], title: string | null) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [badges, setBadges] = useState<string[]>(featuredIds.filter((id) => owned.some((o) => o.id === id)))
  const [title, setTitle] = useState<string | null>(titleId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const catalog = titleCatalog(ctx)

  const toggle = (id: string) => setBadges((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_FEATURED ? [...cur, id] : cur))

  const save = async () => {
    if (!supabase) return
    setSaving(true)
    setError(false)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch('/api/showcase', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ badges, title }),
      })
      if (!res.ok) throw new Error(String(res.status))
      onSaved(badges, title)
      onClose()
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const groups: TitleDef['group'][] = ['achievement', 'track', 'lounge']

  return (
    <div className="panel space-y-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold">{t('showcase.title')}</h3>
          <p className="max-w-2xl text-xs text-muted">{t('showcase.hint')}</p>
        </div>
        <button type="button" onClick={onClose} className="btn-line text-sm">
          {t('common.cancel')}
        </button>
      </div>

      <div>
        <h4 className="font-display text-base font-bold">
          {t('showcase.badges')} <span className="font-mono text-xs text-muted">{badges.length} / {MAX_FEATURED}</span>
        </h4>
        {owned.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('showcase.noBadges')}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {owned.map((f) => {
              const on = badges.includes(f.id)
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => toggle(f.id)}
                    aria-pressed={on}
                    disabled={!on && badges.length >= MAX_FEATURED}
                    className={`flex w-full items-center gap-3 border-2 px-3 py-2 text-left disabled:opacity-40 ${on ? 'border-kart-yellow bg-surface-2' : 'border-line hover:border-muted'}`}
                  >
                    <MedalIcon glyph={f.glyph} tier={f.tier as Tier} size={32} kind={medalKindOf(f.id)} levels={Math.max(4, f.tier)} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{featuredName(f.id, t)}</span>
                      <span className="font-mono text-[11px]" style={{ color: TIER_COLOR[f.tier] }}>
                        {t(tierLabel(f.tier))}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h4 className="font-display text-base font-bold">{t('showcase.titles')}</h4>
        <p className="text-xs text-muted">{t('showcase.titlesHint')}</p>
        <button
          type="button"
          onClick={() => setTitle(null)}
          aria-pressed={title === null}
          className={`mt-3 border-2 px-3 py-1.5 text-sm font-semibold ${title === null ? 'border-kart-yellow bg-surface-2' : 'border-line hover:border-muted'}`}
        >
          {t('showcase.noTitle')}
        </button>
        {groups.map((g) => {
          const defs = catalog.filter((d) => d.group === g)
          if (defs.length === 0) return null
          return (
            <div key={g} className="mt-4">
              <p className="font-mono text-[11px] font-bold tracking-widest text-muted uppercase">{t(`title.group.${g}` as MessageKey)}</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {defs.map((d) => {
                  const on = title === d.id
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        disabled={!d.earned}
                        onClick={() => setTitle(d.id)}
                        aria-pressed={on}
                        className={`w-full border-2 px-3 py-2 text-left ${
                          on ? 'border-kart-yellow bg-surface-2' : d.earned ? 'border-line hover:border-muted' : 'border-line/60 border-dashed opacity-60'
                        }`}
                      >
                        <span className="block">
                          <TitleChip def={d} size="sm" />
                        </span>
                        <span className="mt-1 block text-xs text-muted">{d.earned ? titleHow(d, t) : `${t('showcase.locked')}: ${titleHow(d, t)}`}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn-yellow text-base">
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {error && <p className="text-sm text-kart-red">{t('showcase.error')}</p>}
      </div>
    </div>
  )
}
