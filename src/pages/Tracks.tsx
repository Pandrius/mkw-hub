import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge, PageHeader } from '../components/ui'
import { CUPS, TRACKS, getTrack, getTrackImage } from '../data/tracks'
import { useI18n } from '../i18n'

export default function Tracks() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? TRACKS.filter((tr) => tr.name.toLowerCase().includes(q) || tr.abbr?.toLowerCase().startsWith(q))
      : TRACKS
  }, [query])

  return (
    <>
      <PageHeader title={t('nav.tracks')} subtitle={t('tracks.subtitle')}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('tracks.search')}
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-kart-yellow sm:w-64"
        />
      </PageHeader>

      <div className="space-y-10">
        {CUPS.map((cup) => {
          const tracks = filtered.filter((tr) => tr.cupId === cup.id)
          if (tracks.length === 0) return null
          return (
            <section key={cup.id}>
              <h2 className="mb-3 flex items-center gap-3 font-display text-lg font-bold">
                <span className="size-3 rounded-full" style={{ background: cup.color }} />
                {t(`cup.${cup.id}`)}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {tracks.map((track) => {
                  const image = getTrackImage(track)
                  const parent = track.parentId ? getTrack(track.parentId) : undefined
                  return (
                    <Link
                      key={track.id}
                      to={`/pistas/${track.id}`}
                      className="group relative flex min-h-36 flex-col justify-end overflow-hidden rounded-2xl border border-line bg-surface p-4 transition-transform hover:-translate-y-0.5 hover:border-[color:var(--c)]"
                      style={{ '--c': cup.color } as React.CSSProperties}
                    >
                      {image && (
                        <img
                          src={image}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 size-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/10" />
                      <div className="absolute inset-y-0 left-0 w-1" style={{ background: cup.color }} />

                      <div className="relative">
                        <p className="font-display text-sm font-black italic drop-shadow" style={{ color: cup.color }}>
                          {track.abbr}
                        </p>
                        <p className="font-display text-lg font-bold leading-tight drop-shadow">{track.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {track.origin ? <Badge color={cup.color}>{track.origin}</Badge> : <Badge>{t('common.new')}</Badge>}
                          {parent && <Badge>{t('tracks.in', { track: parent.name })}</Badge>}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
        {filtered.length === 0 && <p className="text-muted">{t('tracks.noMatch', { query })}</p>}
      </div>
    </>
  )
}
