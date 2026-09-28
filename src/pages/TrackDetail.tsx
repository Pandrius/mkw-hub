import { useState } from 'react'
import { Link, useParams } from 'react-router'
import TimeTrialBoard from '../components/TimeTrialBoard'
import TrackTips from '../components/TrackTips'
import TrackWorldRecord from '../components/TrackWorldRecord'
import { Badge, EmptyState, Tabs } from '../components/ui'
import { getCup, getTrack, getTrackImage, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import NotFound from './NotFound'

type TabId = 'tt-guide' | 'race-guide' | 'times' | 'stats'

export default function TrackDetail() {
  const { t } = useI18n()
  const { trackId = '' } = useParams()
  const [tab, setTab] = useState<TabId>('tt-guide')
  const track = getTrack(trackId)
  if (!track) return <NotFound />

  const cup = getCup(track.cupId)
  const parent = track.parentId ? getTrack(track.parentId) : undefined
  const variants = TRACKS.filter((v) => v.parentId === track.id)
  const image = getTrackImage(track)

  return (
    <>
      <Link to="/pistas" className="text-sm text-muted hover:text-ink">
        {t('tracks.back')}
      </Link>

      <header
        className="relative mt-4 mb-6 overflow-hidden rounded-3xl border border-line bg-surface px-6 py-10 sm:py-14"
        style={{ borderColor: cup?.color }}
      >
        {image && (
          <img src={image} alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-60 sm:w-3/4" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/85 to-surface/10" />
        <p className="relative text-sm font-semibold uppercase tracking-[0.15em]" style={{ color: cup?.color }}>
          {track.abbr && <span className="mr-2 font-display text-base font-black normal-case italic">{track.abbr}</span>}
          {cup && t(`cup.${cup.id}`)}
        </p>
        <h1 className="relative mt-1 font-display text-4xl font-black italic tracking-tight drop-shadow sm:text-5xl">
          {track.name}
        </h1>
        <div className="relative mt-3 flex flex-wrap gap-2">
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
      </header>

      <Tabs
        tabs={[
          { id: 'tt-guide', label: t('tracks.tabTTGuide') },
          { id: 'race-guide', label: t('tracks.tabRaceGuide') },
          { id: 'times', label: t('tracks.tabTimes') },
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
        {tab === 'stats' && <EmptyState title={t('tracks.statsTitle')}>{t('tracks.statsText')}</EmptyState>}
      </div>
    </>
  )
}
