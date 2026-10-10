import { getTrack, TRACKS, getTrackColor } from '../data/tracks'
import { useI18n } from '../i18n'
import { chartGeometry, formatDiff, recentPbs, type PbHistory, type PbResult, type PbStep } from '../lib/pbHistory'
import { formatDate, formatTime } from '../lib/time'
import { Plate } from './ui'

/** Placa con la abreviatura (o el nombre) de la pista */
function TrackPlate({ trackId }: { trackId: string }) {
  const track = getTrack(trackId)
  return <Plate color={getTrackColor(track)}>{track?.abbr ?? track?.name ?? trackId}</Plate>
}

/** Aviso tras guardar un tiempo propio: ¡nuevo PB!, empate o cuánto faltó. */
export function PbNotice({ result, onClose }: { result: PbResult; onClose: () => void }) {
  const { t, locale } = useI18n()
  const { verdict } = result
  const isPb = verdict.kind === 'pb' || verdict.kind === 'first'
  const track = getTrack(result.track_id)

  const title =
    verdict.kind === 'pb'
      ? t('pb.newPb', { diff: formatDiff(-verdict.diff_ms, locale) })
      : verdict.kind === 'first'
        ? t('pb.first')
        : verdict.kind === 'tie'
          ? t('pb.tie')
          : t('pb.miss', { diff: formatDiff(verdict.diff_ms, locale) })

  const text =
    verdict.kind === 'pb'
      ? t('pb.newPbText', { prev: formatTime(result.previous_ms ?? result.time_ms) })
      : verdict.kind === 'first'
        ? t('pb.firstText')
        : t('pb.missText', { pb: formatTime(result.previous_ms ?? result.time_ms) })

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative overflow-hidden border-2 p-4 pt-5 ${isPb ? 'border-kart-yellow bg-kart-yellow text-bg' : 'border-line bg-surface'}`}
    >
      <div className={`absolute inset-x-0 top-0 h-2 ${isPb ? 'checker opacity-40' : 'hazard opacity-60'}`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-3xl leading-none font-black sm:text-4xl">{title}</p>
          <p className={`mt-2 flex flex-wrap items-center gap-2 text-sm ${isPb ? 'text-bg/80' : 'text-muted'}`}>
            <TrackPlate trackId={result.track_id} />
            <span className="font-semibold">{track?.name}</span>
            <span className="font-mono text-xs font-bold">
              {result.category === 'flap' ? t('tt.flap') : t('tt.race')} · {result.nita ? t('tt.nita') : t('tt.items')}
            </span>
          </p>
          <p className="mt-2 text-sm">
            <span className="time text-lg">{formatTime(result.time_ms)}</span>
            <span className={`ml-2 ${isPb ? 'text-bg/80' : 'text-muted'}`}>{text}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={t('pb.close')}
          className={`px-2 font-mono text-lg font-bold ${isPb ? 'hover:text-ink' : 'text-muted hover:text-kart-yellow'}`}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/** Gráfico escalonado de la evolución del PB, en SVG hecho a mano. */
export function PbChart({
  steps,
  width,
  height,
  label,
  className,
}: {
  steps: PbStep[]
  width: number
  height: number
  label: string
  className?: string
}) {
  const { points, path } = chartGeometry(steps, width, height, 6)
  const last = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label} className={className}>
      <title>{label}</title>
      {/* Línea base: el PB actual */}
      {last && <line x1={0} x2={width} y1={last.y} y2={last.y} stroke="var(--color-line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
      {points.length > 1 && (
        <path d={path} fill="none" stroke="var(--color-kart-yellow)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      )}
      {/* Marcas cuadradas: trazos de longitud cero con extremo cuadrado, que no se deforman al estirar el SVG */}
      {points.map((p, i) => (
        <g key={p.step.time.id}>
          <path d={`M${p.x} ${p.y} h0`} stroke="var(--color-kart-yellow)" strokeWidth={8} strokeLinecap="square" vectorEffect="non-scaling-stroke" />
          {i < points.length - 1 && (
            <path d={`M${p.x} ${p.y} h0`} stroke="var(--color-bg)" strokeWidth={4} strokeLinecap="square" vectorEffect="non-scaling-stroke" />
          )}
        </g>
      ))}
    </svg>
  )
}

/** Resumen con los PBs más recientes del jugador (todas las pistas y categorías). */
export function RecentPbs({ histories, limit = 6 }: { histories: PbHistory[]; limit?: number }) {
  const { t, locale } = useI18n()
  const recent = recentPbs(histories, limit)

  return (
    <section className="mb-6">
      <h2 className="mb-3 font-display text-2xl font-extrabold">{t('pb.recentTitle')}</h2>
      {recent.length === 0 ? (
        <p className="text-sm text-muted">{t('pb.recentEmpty')}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((s) => {
            const track = getTrack(s.history.track_id)
            return (
              <li key={s.time.id} className="panel flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <TrackPlate trackId={s.history.track_id} />
                    <span className="truncate text-sm font-semibold">{track?.name}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] font-bold text-muted">
                    {s.history.category === 'flap' ? t('tt.flap') : t('tt.race')} · {s.history.nita ? t('tt.nita') : t('tt.items')} ·{' '}
                    {formatDate(s.date, locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="time text-base">{formatTime(s.time.time_ms)}</p>
                  <p className="font-mono text-xs font-bold text-kart-green">
                    {s.improvement_ms === null ? t('pb.firstMark') : formatDiff(-s.improvement_ms, locale)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Historial por pista: progresión de PBs con gráfico y lista de mejoras. */
export function PbHistoryList({ histories }: { histories: PbHistory[] }) {
  const { t, locale } = useI18n()
  const order = new Map(TRACKS.map((tr, i) => [tr.id, i]))
  const sorted = [...histories].sort((a, b) => (order.get(a.track_id) ?? 999) - (order.get(b.track_id) ?? 999))

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-extrabold">{t('pb.historyTitle')}</h2>
      <p className="mb-3 text-sm text-muted">{t('pb.historyHint')}</p>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">{t('pb.historyEmpty')}</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((h) => {
            const track = getTrack(h.track_id)
            const name = track?.name ?? h.track_id
            const current = h.steps[h.steps.length - 1]
            const chartLabel = t('pb.chartLabel', { track: name })
            return (
              <details key={h.key} className="panel group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-xs text-muted transition-transform group-open:rotate-90">▶</span>
                  <TrackPlate trackId={h.track_id} />
                  <span className="hidden min-w-0 flex-1 truncate font-semibold sm:block">{name}</span>
                  <span className="flex-1 sm:hidden" />
                  {h.steps.length > 1 && (
                    <PbChart steps={h.steps} width={80} height={24} label={chartLabel} className="h-6 w-16 shrink-0 sm:w-20" />
                  )}
                  <span className="text-right">
                    <span className="time block text-base">{formatTime(current.time.time_ms)}</span>
                    <span className="block font-mono text-[11px] font-bold text-muted">
                      {t('pb.count', { n: h.steps.length })}
                      {h.total_improvement_ms > 0 && (
                        <span className="text-kart-green"> · {formatDiff(-h.total_improvement_ms, locale)}</span>
                      )}
                    </span>
                  </span>
                </summary>

                <div className="border-t-2 border-line px-3 py-3">
                  <p className="mb-2 font-mono text-[11px] font-bold text-muted sm:hidden">{name}</p>
                  {h.steps.length > 1 && (
                    <div className="mb-3 flex gap-2">
                      <div className="flex flex-col justify-between py-0.5 text-right font-mono text-[10px] font-bold text-muted">
                        <span>{formatTime(current.time.time_ms)}</span>
                        <span>{formatTime(h.steps[0].time.time_ms)}</span>
                      </div>
                      <PbChart steps={h.steps} width={600} height={140} label={chartLabel} className="h-28 w-full min-w-0 flex-1 border-2 border-line bg-bg sm:h-36" />
                    </div>
                  )}
                  <ol className="divide-y divide-line/60 text-sm">
                    {[...h.steps].reverse().map((s) => (
                      <li key={s.time.id} className="flex items-center gap-3 py-1.5">
                        <span className="w-24 shrink-0 font-mono text-xs text-muted">{formatDate(s.date, locale)}</span>
                        <span className="time flex-1">{formatTime(s.time.time_ms)}</span>
                        {s.time.proof_url && (
                          <a href={s.time.proof_url} target="_blank" rel="noreferrer" className="text-kart-blue hover:underline" title={t('common.proof')}>
                            ↗
                          </a>
                        )}
                        <span className={`w-24 text-right font-mono text-xs font-bold ${s.improvement_ms === null ? 'text-muted' : 'text-kart-green'}`}>
                          {s.improvement_ms === null ? t('pb.firstMark') : formatDiff(-s.improvement_ms, locale)}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 font-mono text-[11px] font-bold text-muted">
                    {t('pb.attempts', { n: h.attempts })} · {t('pb.total', { diff: formatDiff(-h.total_improvement_ms, locale) })}
                  </p>
                </div>
              </details>
            )
          })}
        </div>
      )}
    </section>
  )
}
