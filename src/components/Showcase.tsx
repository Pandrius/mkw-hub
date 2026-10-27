import { useState } from 'react'
import { getTrack, getTrackPlateBackground, getTrackTextColor } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import type { Tier } from '../lib/badges'
import { supabase } from '../lib/supabase'
import { ACHIEVEMENT_TITLES, BOLT_STYLES, canPickBolts, MAX_FEATURED, titleCatalog, type BoltStyle, type Featurable, type TitleContext, type TitleDef } from '../lib/titles'
import { MedalIcon } from './Medal'
import { Plate } from './ui'
import { CROWN_TITLE_IDS, featuredName, featuredTier, titleHow, titleName } from './showcaseNames'
import { medalKindOf, TIER_COLOR } from './tiers'

/** Títulos con aspecto propio (ver .title-chip en index.css); «Leyenda absoluta» tiene el suyo aparte */
const UNIQUE_TITLES = new Set([
  ...ACHIEVEMENT_TITLES.map((t) => t.id).filter((id) => id !== 'grandMaster' && !id.startsWith('warRank')),
  'veteran',
  'globetrotter',
  'top:10',
  'top:5',
  'top:1',
  'sqPlayer',
])

/**
 * Un título como se ve en el perfil. «Dueño de …» lleva la placa de la pista (mismo color y letras que su abreviatura; Rainbow Road,
 * con el multicolor animado), los de rango del Lounge, el material y color de su rango (bronce, plata, oro…), «Leyenda absoluta» tiene las letras multicolor que cambian y el resto, el amarillo de la web.
 */
export function TitleChip({ def, size = 'md' }: { def: Pick<TitleDef, 'id' | 'param'>; size?: 'sm' | 'md' }) {
  const { t } = useI18n()
  const name = titleName(def, t)
  const pad = size === 'md' ? { padding: '6px 12px', fontSize: '1rem' } : { padding: '3px 8px', fontSize: '0.8rem' }
  if (def.id.startsWith('owner:') || def.id.startsWith('weekly:')) {
    const track = getTrack(def.param ?? '')
    const rainbow = track?.abbr === 'RR'
    const plate = (
      <Plate
        color={rainbow ? undefined : getTrackPlateBackground(track)}
        textColor={rainbow ? '#16121f' : getTrackTextColor(track)}
        className={rainbow ? 'plate-multi' : ''}
        style={{ ...pad, textTransform: 'uppercase', whiteSpace: 'nowrap' }}
      >
        {name}
      </Plate>
    )
    // «Dueño de …» (el primero de todo el tiempo) es más exclusivo que el semanal: lleva un marco pegado a la placa, con reflejo
    if (!def.id.startsWith('owner:')) return plate
    return (
      <span className="owner-frame">
        <span className="owner-frame__body">{plate}</span>
      </span>
    )
  }
  if (def.id.startsWith('rank:')) {
    return (
      <span data-rank={def.param} className="rank-chip inline-block font-display font-extrabold tracking-wide whitespace-nowrap uppercase" style={pad}>
        {name}
      </span>
    )
  }
  if (def.id.startsWith('warRank')) {
    // Rango militar: placa del color del nivel (bronce, plata, oro, platino, esmeralda) con tantos galones como el nivel
    const level = Number(def.id.slice(-1))
    return (
      <span data-level={level} className="war-rank font-display font-extrabold tracking-wide whitespace-nowrap uppercase" style={{ ['--wr' as string]: TIER_COLOR[level as Tier], fontSize: pad.fontSize }}>
        <span className="war-rank__stripes" style={{ paddingTop: pad.padding.split(' ')[0], paddingBottom: pad.padding.split(' ')[0] }}>
          <svg width="16" height="22" viewBox="0 0 16 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" aria-hidden>
            {Array.from({ length: level }, (_, k) => (
              <polyline key={k} points={`1,${19 - k * 3.6} 8,${15 - k * 3.6} 15,${19 - k * 3.6}`} />
            ))}
          </svg>
        </span>
        <span className="war-rank__name" style={{ paddingTop: pad.padding.split(' ')[0], paddingBottom: pad.padding.split(' ')[0] }}>
          {name}
        </span>
      </span>
    )
  }
  if (CROWN_TITLE_IDS.has(def.id)) {
    return (
      <span data-crown={def.id} className="crown-title font-display font-extrabold tracking-wide whitespace-nowrap uppercase" style={{ ...pad, paddingLeft: size === 'md' ? 18 : 14, paddingRight: size === 'md' ? 18 : 14 }}>
        {name}
      </span>
    )
  }
  if (def.id === 'grandMaster') {
    return (
      <span className="inline-block border-2 border-line bg-bg font-display font-extrabold tracking-wide whitespace-nowrap uppercase" style={pad}>
        <span className="title-multi">{name}</span>
      </span>
    )
  }
  if (UNIQUE_TITLES.has(def.id)) {
    return (
      <span data-title={def.id.replace(':', '-')} className="title-chip inline-block font-display font-extrabold tracking-wide whitespace-nowrap uppercase" style={pad}>
        {name}
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
        <span key={m.id} title={`${featuredName(m.id, t, m.tier)} · ${featuredTier(m.id, m.tier, t).label}`}>
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
  bolts,
  owned,
  ctx,
  onSaved,
  onClose,
}: {
  featuredIds: string[]
  titleId: string | null
  /** Rayos de los escudos especiales que lleva ahora el perfil */
  bolts: BoltStyle
  owned: Featurable[]
  ctx: TitleContext
  onSaved: (badges: string[], title: string | null, bolts: BoltStyle) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [badges, setBadges] = useState<string[]>(featuredIds.filter((id) => owned.some((o) => o.id === id)))
  const [title, setTitle] = useState<string | null>(titleId)
  const [boltStyle, setBoltStyle] = useState<BoltStyle>(bolts)
  const pickBolts = canPickBolts(owned)
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
        body: JSON.stringify({ badges, title, ...(pickBolts ? { bolts: boltStyle } : {}) }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const saved = (await res.json().catch(() => null)) as { bolts?: BoltStyle } | null
      onSaved(badges, title, saved?.bolts ?? bolts)
      onClose()
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const groups: TitleDef['group'][] = ['achievement', 'track', 'lounge', 'crown']

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
                      <span className="block text-sm leading-tight font-semibold break-words">{featuredName(f.id, t, f.tier)}</span>
                      {(() => {
                        const lv = featuredTier(f.id, f.tier, t)
                        return (
                          <span className={`font-mono text-[11px] ${lv.multi ? 'title-multi font-bold' : ''}`} style={lv.multi ? undefined : { color: lv.color }}>
                            {lv.label}
                          </span>
                        )
                      })()}
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

      {pickBolts && (
        <div>
          <h4 className="font-display text-base font-bold">{t('showcase.bolts')}</h4>
          <p className="max-w-2xl text-xs text-muted">{t('showcase.boltsHint')}</p>
          <ul className="mt-3 flex flex-wrap gap-3">
            {BOLT_STYLES.map((style) => (
              <li key={style}>
                <button
                  type="button"
                  onClick={() => setBoltStyle(style)}
                  aria-pressed={boltStyle === style}
                  className={`flex flex-col items-center gap-2 border-2 px-6 py-4 ${boltStyle === style ? 'border-kart-yellow bg-surface-2' : 'border-line hover:border-muted'}`}
                >
                  <MedalIcon glyph="crown" tier={3} size={56} single kind="ruby" bolts={style} />
                  <span className="text-sm font-semibold">{t(`bolts.${style}` as MessageKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn-yellow text-base">
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {error && <p className="text-sm text-kart-red">{t('showcase.error')}</p>}
      </div>
    </div>
  )
}
