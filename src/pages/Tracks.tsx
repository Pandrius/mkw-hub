import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge, PageHeader } from '../components/ui'
import { CUPS, TRACKS, getTrack } from '../data/tracks'

export default function Tracks() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? TRACKS.filter((t) => t.name.toLowerCase().includes(q) || t.abbr?.toLowerCase().startsWith(q))
      : TRACKS
  }, [query])

  return (
    <>
      <PageHeader title="Pistas" subtitle="Elige una pista para ver sus guías, los tiempos de contrarreloj y tus estadísticas.">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar pista o abreviatura…"
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-kart-yellow sm:w-64"
        />
      </PageHeader>

      <div className="space-y-10">
        {CUPS.map((cup) => {
          const tracks = filtered.filter((t) => t.cupId === cup.id)
          if (tracks.length === 0) return null
          return (
            <section key={cup.id}>
              <h2 className="mb-3 flex items-center gap-3 font-display text-lg font-bold">
                <span className="size-3 rounded-full" style={{ background: cup.color }} />
                {cup.name}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {tracks.map((track) => (
                  <Link
                    key={track.id}
                    to={`/pistas/${track.id}`}
                    className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 transition-transform hover:-translate-y-0.5 hover:border-[color:var(--c)]"
                    style={{ '--c': cup.color } as React.CSSProperties}
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ background: cup.color }}
                    />
                    {track.abbr && (
                      <p className="font-display text-sm font-black italic" style={{ color: cup.color }}>
                        {track.abbr}
                      </p>
                    )}
                    <p className="font-display text-lg font-bold leading-tight">{track.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {track.origin ? <Badge color={cup.color}>{track.origin}</Badge> : <Badge>Nueva</Badge>}
                      {track.parentId && <Badge>En {getTrack(track.parentId)?.name}</Badge>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
        {filtered.length === 0 && <p className="text-muted">No hay ninguna pista que coincida con “{query}”.</p>}
      </div>
    </>
  )
}
