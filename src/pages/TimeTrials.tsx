import { useSearchParams } from 'react-router'
import TimeTrialBoard from '../components/TimeTrialBoard'
import TrackWorldRecord from '../components/TrackWorldRecord'
import WorldRecordsTable from '../components/WorldRecordsTable'
import { PageHeader, Tabs } from '../components/ui'
import { CUPS, getTrack, getTrackImage, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'

type View = 'wr' | 'track'

export default function TimeTrials() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const trackParam = params.get('pista')
  const view: View = trackParam ? 'track' : 'wr'
  const track = getTrack(trackParam ?? '') ?? TRACKS[0]
  const image = getTrackImage(track)

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

          <nav className="hidden max-h-[80vh] overflow-y-auto rounded-2xl border border-line bg-surface p-2 lg:block">
            {TRACKS.map((tr) => (
              <button
                key={tr.id}
                onClick={() => selectTrack(tr.id)}
                className={`flex w-full items-baseline gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${
                  tr.id === track.id ? 'bg-kart-yellow text-bg' : 'hover:bg-surface-2'
                }`}
              >
                <span className="w-11 shrink-0 font-display font-black italic">{tr.abbr}</span>
                <span className="truncate">{tr.name}</span>
              </button>
            ))}
          </nav>

          <section className="min-w-0 space-y-8">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-5 py-6">
              {image && <img src={image} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
              <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-transparent" />
              <p className="relative font-display text-sm font-black italic text-kart-yellow">{track.abbr}</p>
              <h2 className="relative font-display text-2xl font-black italic">{track.name}</h2>
            </div>
            <TrackWorldRecord key={track.id} trackId={track.id} />
            <TimeTrialBoard key={`${track.id}-board`} trackId={track.id} />
          </section>
        </div>
      )}
    </>
  )
}
