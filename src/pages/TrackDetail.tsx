import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Badge, EmptyState, Tabs } from '../components/ui'
import { getCup, getTrack, TRACKS } from '../data/tracks'
import NotFound from './NotFound'

type TabId = 'tt-guide' | 'race-guide' | 'times' | 'stats'

const TABS: { id: TabId; label: string }[] = [
  { id: 'tt-guide', label: 'Guía de contrarreloj' },
  { id: 'race-guide', label: 'Guía de carreras' },
  { id: 'times', label: 'Tiempos' },
  { id: 'stats', label: 'Estadísticas' },
]

export default function TrackDetail() {
  const { trackId = '' } = useParams()
  const [tab, setTab] = useState<TabId>('tt-guide')
  const track = getTrack(trackId)
  if (!track) return <NotFound />

  const cup = getCup(track.cupId)
  const parent = track.parentId ? getTrack(track.parentId) : undefined
  const variants = TRACKS.filter((t) => t.parentId === track.id)

  return (
    <>
      <Link to="/pistas" className="text-sm text-muted hover:text-ink">
        ← Todas las pistas
      </Link>

      <header
        className="relative mt-4 mb-6 overflow-hidden rounded-3xl border border-line bg-surface px-6 py-8"
        style={{ borderColor: cup?.color }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-25 blur-3xl"
          style={{ background: cup?.color }}
        />
        <p className="text-sm font-semibold uppercase tracking-[0.15em]" style={{ color: cup?.color }}>
          {cup?.name}
        </p>
        <h1 className="mt-1 font-display text-4xl font-black italic tracking-tight">{track.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {track.origin ? <Badge color={cup?.color}>{track.origin}</Badge> : <Badge>Nueva</Badge>}
          {parent && (
            <Link to={`/pistas/${parent.id}`}>
              <Badge>Anidada en {parent.name}</Badge>
            </Link>
          )}
          {variants.map((v) => (
            <Link key={v.id} to={`/pistas/${v.id}`}>
              <Badge>{v.name}</Badge>
            </Link>
          ))}
        </div>
      </header>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === 'tt-guide' && (
          <EmptyState title="Todavía no hay guía de contrarreloj">
            Aquí irán las strats, atajos y líneas de esta pista, con vídeos de ejemplo. Solo los editores pueden
            escribirla.
          </EmptyState>
        )}
        {tab === 'race-guide' && (
          <EmptyState title="Todavía no hay guía de carreras">
            Consejos de posicionamiento y de uso de items para carreras online. Solo los editores pueden escribirla.
          </EmptyState>
        )}
        {tab === 'times' && (
          <EmptyState title="Sin tiempos registrados">
            Rankings de carrera completa y FLAP, con y sin items (NITA). Llegará en la fase de contrarreloj.
          </EmptyState>
        )}
        {tab === 'stats' && (
          <EmptyState title="Estadísticas de la pista">
            Tu posición media en esta pista, filtrable por War y Lounge. Inicia sesión con Discord para registrar tus
            carreras.
          </EmptyState>
        )}
      </div>
    </>
  )
}
