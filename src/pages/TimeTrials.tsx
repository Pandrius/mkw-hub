import { useSearchParams } from 'react-router'
import TimeTrialBoard from '../components/TimeTrialBoard'
import { PageHeader } from '../components/ui'
import { CUPS, getTrack, getTrackImage, TRACKS } from '../data/tracks'

export default function TimeTrials() {
  const [params, setParams] = useSearchParams()
  const track = getTrack(params.get('pista') ?? '') ?? TRACKS[0]
  const image = getTrackImage(track)

  return (
    <>
      <PageHeader
        title="Contrarreloj"
        subtitle="Rankings por pista. NITA = No Items Time Attack (sin champiñones). FLAP = vuelta más rápida. El top con items se sincroniza cada día desde Mario Kart Central."
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <label className="block lg:hidden">
          <span className="mb-1 block text-sm text-muted">Pista</span>
          <select
            value={track.id}
            onChange={(e) => setParams({ pista: e.target.value })}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            {CUPS.map((cup) => (
              <optgroup key={cup.id} label={cup.name}>
                {TRACKS.filter((t) => t.cupId === cup.id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.abbr} · {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <nav className="hidden max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-2 lg:block">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              onClick={() => setParams({ pista: t.id })}
              className={`flex w-full items-baseline gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${
                t.id === track.id ? 'bg-kart-yellow text-bg' : 'hover:bg-surface-2'
              }`}
            >
              <span className="w-11 shrink-0 font-display font-black italic">{t.abbr}</span>
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </nav>

        <section className="min-w-0">
          <div className="relative mb-4 overflow-hidden rounded-2xl border border-line bg-surface px-5 py-6">
            {image && <img src={image} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-transparent" />
            <p className="relative font-display text-sm font-black italic text-kart-yellow">{track.abbr}</p>
            <h2 className="relative font-display text-2xl font-black italic">{track.name}</h2>
          </div>
          <TimeTrialBoard key={track.id} trackId={track.id} />
        </section>
      </div>
    </>
  )
}
