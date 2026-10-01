import { useState } from 'react'
import { Link, useParams } from 'react-router'
import TimeTrialBoard from '../components/TimeTrialBoard'
import TrackStats from '../components/TrackStats'
import TrackTips from '../components/TrackTips'
import TrackWorldRecord from '../components/TrackWorldRecord'
import { Badge, Tabs } from '../components/ui'
import { getCup, getTrack, getTrackImage, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import NotFound from './NotFound'

type TabId = 'tt-guide' | 'race-guide' | 'times' | 'stats'

export default function TrackDetail() {
  const { t } = useI18n()
  const { trackId = '' } = useParams()
  const [tab, setTab] = useState<TabId>('times')
  const track = getTrack(trackId)
  if (!track) return <NotFound />

  const cup = getCup(track.cupId)
  const parent = track.parentId ? getTrack(track.parentId) : undefined
  const variants = TRACKS.filter((v) => v.parentId === track.id)
  const image = getTrackImage(track)
  const imageHd = getTrackImage(track, true)

  return (
    <>
      <Link to="/pistas" className="font-mono text-xs font-bold text-muted hover:text-kart-yellow">
        {t('tracks.back')}
      </Link>

      <header className="mt-4 mb-8 grid gap-6 border-b-2 border-line pb-8 md:grid-cols-[1.5fr_1fr] md:items-end">
        <div>
          <p className="flex items-center gap-3">
            <span
              className="font-display text-5xl leading-none font-black normal-case"
              style={{ color: cup?.color }}
            >
              {track.abbr}
            </span>
            <span className="font-mono text-xs font-bold tracking-widest text-muted">{cup && t(`cup.${cup.id}`)}</span>
          </p>
          <h1 className="mt-2 font-display text-6xl leading-[0.85] font-black sm:text-7xl">{track.name}</h1>
          <div className="mt-3 h-2 w-24" style={{ background: cup?.color }} />
          <div className="mt-4 flex flex-wrap gap-2">
          {track.origin ? <Badge color={cup?.color}>{track.origin}</Badge> : <Badge>{t('common.new')}</Badge>}
          {parent && (
            <Link to={`/pistas/${parent.id}`}>
              <Badge>{t('tracks.nestedIn', { track: parent.name })}</Badge>
            </Link>
          )}
          {variants.map((v) => (
            <Link key={v.id} to={`/pistas/${v.id}`}>
              <Badge>{v.name}</Badge>
            </Link>
          ))}
          </div>
        </div>
        {image && (
          <div className="slant aspect-[16/9] overflow-hidden bg-surface-2 shadow-lg">
            <img
              src={imageHd || image}
              srcSet={imageHd ? `${image} 800w, ${imageHd} 1600w` : undefined}
              sizes="(min-width: 768px) 40vw, 100vw"
              alt={track.name}
              className="thumb"
            />
          </div>
        )}
      </header>

      <Tabs
        tabs={[
          { id: 'times', label: t('tracks.tabTimes') },
          { id: 'tt-guide', label: t('tracks.tabTTGuide') },
          { id: 'race-guide', label: t('tracks.tabRaceGuide') },
          { id: 'stats', label: t('tracks.tabStats') },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-6">
        {/* key: al cambiar de pista se reinicia el estado (lista y formulario) */}
        {tab === 'tt-guide' && <TrackTips key={`${track.id}-tt`} trackId={track.id} kind="time_trial" />}
        {tab === 'race-guide' && <TrackTips key={`${track.id}-race`} trackId={track.id} kind="race" />}
        {tab === 'times' && (
          <div className="space-y-8">
            <TrackWorldRecord key={track.id} trackId={track.id} />
            <TimeTrialBoard key={`${track.id}-board`} trackId={track.id} />
          </div>
        )}
        {tab === 'stats' && <TrackStats key={track.id} trackId={track.id} />}
      </div>
    </>
  )
}
