import { useSearchParams } from 'react-router'
import TimeTrialBoard from '../components/TimeTrialBoard'
import TrackWorldRecord from '../components/TrackWorldRecord'
import WorldRecordsTable from '../components/WorldRecordsTable'
import { PageHeader, Tabs } from '../components/ui'
import { CUPS, getCup, getTrack, getTrackImage, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'

type View = 'wr' | 'track'

export default function TimeTrials() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const trackParam = params.get('pista')
  const view: View = trackParam ? 'track' : 'wr'
  const track = getTrack(trackParam ?? '') ?? TRACKS[0]
  const image = getTrackImage(track)
  const cupColor = getCup(track.cupId)?.color

  const selectTrack = (id: string) => setParams({ pista: id })

  return (
    <>
      <PageHeader title={t('tt.title')} subtitle={t('tt.subtitle')} />

      <div className="mb-6">
        <Tabs
          tabs={[
            { id: 'wr', label: t('tt.viewWorld') },
            { id: 'track', label: t('tt.viewTrack') },
          ]}
          value={view}
          onChange={(v) => setParams(v === 'wr' ? {} : { pista: track.id })}
        />
      </div>

      {view === 'wr' ? (
        <WorldRecordsTable />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <label className="block lg:hidden">
            <span className="mb-1 block text-sm text-muted">{t('tt.track')}</span>
            <select
              value={track.id}
              onChange={(e) => selectTrack(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5"
            >
              {CUPS.map((cup) => (
                <optgroup key={cup.id} label={t(`cup.${cup.id}`)}>
                  {TRACKS.filter((tr) => tr.cupId === cup.id).map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.abbr} · {tr.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <nav className="hidden max-h-[80vh] overflow-y-auto panel p-2 lg:block">
            {TRACKS.map((tr) => (
              <button
                key={tr.id}
                onClick={() => selectTrack(tr.id)}
                className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm ${
                  tr.id === track.id ? 'bg-kart-yellow font-semibold text-bg' : 'hover:bg-surface-2'
                }`}
              >
                <span className="w-12 shrink-0 font-display text-base font-black">{tr.abbr}</span>
                <span className="truncate">{tr.name}</span>
              </button>
            ))}
          </nav>

          <section className="min-w-0 space-y-8">
            <div className="flex items-end justify-between gap-4 border-b-2 border-line pb-4">
              <div>
                <p className="font-display text-3xl leading-none font-black" style={{ color: cupColor }}>
                  {track.abbr}
                </p>
                <h2 className="font-display text-4xl leading-none font-black sm:text-5xl">{track.name}</h2>
              </div>
              {image && (
                <div className="slant hidden aspect-[16/9] w-48 shrink-0 overflow-hidden sm:block">
                  <img src={image} alt="" className="size-full object-cover" />
                </div>
              )}
            </div>
            <TrackWorldRecord key={track.id} trackId={track.id} />
            <TimeTrialBoard key={`${track.id}-board`} trackId={track.id} />
          </section>
        </div>
      )}
    </>
  )
}
