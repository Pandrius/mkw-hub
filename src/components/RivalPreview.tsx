import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getTrack, getTrackColor, getTrackTextColor } from '../data/tracks'
import { useI18n } from '../i18n'
import type { TeamWithMembers } from '../lib/compare'
import { buildPickPlan, type PickRow, type PickSource } from '../lib/picks'
import { computeTeamStats, getTeamWars, rivalKeyOf, type TeamStats, type TeamWar } from '../lib/teamStats'
import { SearchBox } from './SearchBox'
import { EmptyState, Plate } from './ui'

type Rival = { key: string; id: number | null; tag: string; name: string }

const signed = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1))

/** Previa de una war: historial contra el rival y qué pistas pickear o evitar */
export function RivalPreview({
  teamId,
  wars,
  stats,
  allTeams,
}: {
  teamId: number
  wars: TeamWar[]
  stats: TeamStats
  allTeams: TeamWithMembers[]
}) {
  const { t } = useI18n()
  const played: Rival[] = stats.rivals.map((r) => ({ key: r.opponentKey, id: r.opponentId, tag: r.opponentTag, name: r.opponentName }))
  const [rival, setRival] = useState<Rival | null>(played[0] ?? null)
  const [search, setSearch] = useState('')
  const [rivalWars, setRivalWars] = useState<{ key: string; wars: TeamWar[] } | null>(null)

  // Wars del rival registradas en la web (si es un equipo de MKC y tiene alguna)
  const rivalId = rival?.id ?? null
  const rivalKey = rival?.key ?? null
  useEffect(() => {
    if (!rivalId || !rivalKey) return
    let cancelled = false
    getTeamWars(rivalId).then(
      (ws) => !cancelled && setRivalWars({ key: rivalKey, wars: ws }),
      () => !cancelled && setRivalWars({ key: rivalKey, wars: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [rivalId, rivalKey])

  const theirWars = rivalWars && rivalWars.key === rivalKey ? rivalWars.wars : null
  const loadingRival = Boolean(rivalId) && theirWars === null

  const plan = useMemo(() => {
    if (!rival) return null
    const h2hWars = wars.filter((w) => rivalKeyOf(w) === rival.key)
    const h2h = h2hWars.length ? computeTeamStats(teamId, h2hWars).tracks : null
    const theirs = theirWars?.length ? computeTeamStats(rival.id!, theirWars).tracks : null
    return buildPickPlan(stats.tracks, theirs, h2h)
  }, [rival, wars, teamId, stats.tracks, theirWars])

  const record = stats.rivals.find((r) => r.opponentKey === rival?.key)

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    return allTeams
      .filter((tm) => tm.id !== teamId && (tm.tag.toLowerCase().includes(q) || tm.name.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [search, allTeams, teamId])

  const choose = (r: Rival) => {
    setRival(r)
    setSearch('')
  }

  return (
    <section className="space-y-5">
      <p className="max-w-2xl text-sm text-muted">{t('preview.hint')}</p>

      <div className="flex flex-wrap items-start gap-2">
        {played.map((r) => (
          <button
            key={r.key}
            onClick={() => choose(r)}
            className={`border px-3 py-1.5 text-sm font-semibold ${
              rival?.key === r.key ? 'border-kart-yellow bg-kart-yellow text-bg' : 'border-line bg-surface hover:border-kart-yellow'
            }`}
          >
            {r.tag}
          </button>
        ))}
        <SearchBox
          value={search}
          onChange={setSearch}
          suggestions={matches.map((tm) => ({ key: String(tm.id), label: tm.name, icon: <Plate>{tm.tag}</Plate> }))}
          onPick={(s) => {
            const tm = matches.find((m) => String(m.id) === s.key)
            if (tm) choose({ key: `id:${tm.id}`, id: tm.id, tag: tm.tag, name: tm.name })
          }}
          placeholder={t('preview.searchRival')}
          className="field w-full text-sm"
          wrapperClassName="relative w-full sm:w-64"
        />
      </div>

      {!rival ? (
        <EmptyState title={t('preview.pickRival')} />
      ) : (
        <>
          <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-mono text-xs font-bold tracking-widest text-muted uppercase">{t('preview.vs')}</p>
              <p className="font-display text-3xl font-black">
                {rival.id ? (
                  <Link to={`/equipos/${rival.id}`} className="hover:underline">
                    {rival.name}
                  </Link>
                ) : (
                  rival.name
                )}
              </p>
            </div>
            <div className="text-right">
              {record ? (
                <>
                  <p className="time text-2xl font-bold">
                    {record.wins}V - {record.losses}D{record.ties ? ` - ${record.ties}E` : ''}
                  </p>
                  <p className={`font-mono text-xs ${record.diff > 0 ? 'text-kart-green' : record.diff < 0 ? 'text-kart-red' : 'text-muted'}`}>
                    {record.diff > 0 ? `+${record.diff}` : record.diff} pts
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">{t('preview.firstTime')}</p>
              )}
            </div>
            <p className="w-full text-xs text-muted">
              {loadingRival
                ? t('common.loading')
                : theirWars?.length
                  ? t('preview.rivalData', { n: theirWars.length })
                  : t('preview.noRivalData')}
            </p>
          </div>

          {plan && plan.pick.length + plan.avoid.length === 0 ? (
            <EmptyState title={t('preview.noData')} />
          ) : (
            plan && (
              <div className="grid gap-4 md:grid-cols-2">
                <PickList title={t('preview.pick')} rows={plan.pick} color="var(--color-kart-green)" />
                <PickList title={t('preview.avoid')} rows={plan.avoid} color="var(--color-kart-red)" />
              </div>
            )
          )}
        </>
      )}
    </section>
  )
}

function PickList({ title, rows, color }: { title: string; rows: PickRow[]; color: string }) {
  const { t } = useI18n()
  return (
    <div className="panel p-5" style={{ borderTop: `3px solid ${color}` }}>
      <h3 className="font-display text-lg font-bold" style={{ color }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t('preview.none')}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.map((row) => {
            const track = getTrack(row.trackId)
            return (
              <li key={row.trackId}>
                <div className="flex items-center gap-2">
                  <Plate color={getTrackColor(track)} textColor={getTrackTextColor(track)}>{track?.abbr ?? row.trackId}</Plate>
                  <Link to={`/pistas/${row.trackId}`} className="flex-1 truncate font-semibold hover:underline">
                    {track?.name ?? row.trackId}
                  </Link>
                  <span className="time font-bold" style={{ color }}>
                    {signed(row.score)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted">
                  <Source label={t('preview.ours')} src={row.ours} />
                  <Source label={t('preview.theirs')} src={row.theirs} />
                  <Source label={t('preview.h2h')} src={row.h2h} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function Source({ label, src }: { label: string; src: PickSource | null }) {
  if (!src) return null
  return (
    <span>
      {label} <span className={src.diff > 0 ? 'text-kart-green' : src.diff < 0 ? 'text-kart-red' : ''}>{signed(src.diff)}</span> ({src.races}c)
    </span>
  )
}
