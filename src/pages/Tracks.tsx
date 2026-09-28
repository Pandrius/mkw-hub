import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader, Plate } from '../components/ui'
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
      <PageHeader title={t('nav.tracks')} subtitle={t('tracks.subtitle')} kicker={`${TRACKS.length} · MKW`}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('tracks.search')}
          className="field py-3 text-base sm:w-72"
        />
      </PageHeader>

      <div className="space-y-12">
        {CUPS.map((cup) => {
          const tracks = filtered.filter((tr) => tr.cupId === cup.id)
          if (tracks.length === 0) return null
          return (
            <section key={cup.id}>
              <h2 className="mb-4 flex items-center gap-3 font-display text-3xl font-black">
                <span className="h-7 w-2" style={{ background: cup.color }} />
                {t(`cup.${cup.id}`)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {tracks.map((track) => {
                  const image = getTrackImage(track)
                  const parent = track.parentId ? getTrack(track.parentId) : undefined
                  return (
                    <Link
                      key={track.id}
                      to={`/pistas/${track.id}`}
                      className="group block border-2 border-line bg-surface transition-colors hover:border-[color:var(--c)]"
                      style={{ '--c': cup.color } as React.CSSProperties}
                    >
                      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
                        {image && (
                          <img
                            src={image}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        )}
                        <span className="absolute top-2 left-2">
                          <Plate color={cup.color}>{track.abbr}</Plate>
                        </span>
                        {track.origin && (
                          <span className="absolute top-2 right-2 bg-bg px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink">
                            {track.origin}
                          </span>
                        )}
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="font-display text-xl leading-tight font-extrabold">{track.name}</p>
                        {parent && <p className="mt-0.5 text-xs text-muted">{t('tracks.in', { track: parent.name })}</p>}
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
