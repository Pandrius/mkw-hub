import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Th } from '../components/StatBlocks'
import { useNum } from '../components/statFormat'
import { EmptyState, Flag, PageHeader, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { allCountries } from '../lib/countries'
import { supabase } from '../lib/supabase'

/** Carreras verificadas mínimas para aparecer en el ranking de la web */
const MIN_RACES = 50

type Tab = 'verified' | 'lounge'
type Kind = 'all' | 'war' | 'lounge'

type VerifiedRow = {
  profile_id: string
  username: string
  avatar_url: string | null
  country_code: string | null
  races: number
  events: number
  avg_pos: number
  avg_points: number
  win_rate: number
  podium_rate: number
}

type LoungeRow = {
  rank: number
  loungeId: number
  name: string
  country: string | null
  mmr: number | null
  maxMmr: number | null
  events: number
  winRate: number | null
}

type LoungePage = { ok: boolean; total: number; skip: number; pageSize: number; players: LoungeRow[] }

export default function Ranking() {
  const { t, locale } = useI18n()
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('verified')
  const [country, setCountry] = useState<string | null>(null)
  const countries = useMemo(() => allCountries(locale), [locale])
  // Por defecto, el país del propio jugador
  const effectiveCountry = country ?? profile?.country_code ?? ''

  return (
    <>
      <PageHeader title={t('rk.title')} subtitle={t('rk.subtitle')} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { id: 'verified' as Tab, label: t('rk.tabVerified') },
            { id: 'lounge' as Tab, label: t('rk.tabLounge') },
          ]}
          value={tab}
          onChange={setTab}
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t('rk.country')}</span>
          <select value={effectiveCountry} onChange={(e) => setCountry(e.target.value)} className="field w-56">
            <option value="">{t('rk.allCountries')}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {tab === 'verified' ? <VerifiedRanking country={effectiveCountry} /> : <LoungeRanking country={effectiveCountry} />}
    </>
  )
}

function VerifiedRanking({ country }: { country: string }) {
  const { t, locale } = useI18n()
  const num = useNum()
  const [kind, setKind] = useState<Kind>('all')
  const [rows, setRows] = useState<VerifiedRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase
      .rpc('verified_ranking', { min_races: MIN_RACES, country: country || null, only_kind: kind === 'all' ? null : kind })
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) setError(true)
        else {
          setError(false)
          setRows(data as VerifiedRow[])
        }
      })
    return () => {
      cancelled = true
    }
  }, [country, kind])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { id: 'all' as Kind, label: t('stats.all') },
            { id: 'war' as Kind, label: t('stats.war') },
            { id: 'lounge' as Kind, label: t('stats.lounge') },
          ]}
          value={kind}
          onChange={setKind}
        />
        <p className="max-w-xl text-xs text-muted">{t('rk.verifiedHint', { n: MIN_RACES })}</p>
      </div>
      {error ? (
        <p className="text-kart-red">{t('common.loadError')}</p>
      ) : !rows ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <EmptyState title={t('rk.empty')}>{t('rk.emptyText', { n: MIN_RACES })}</EmptyState>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg font-display text-xs text-kart-yellow">
              <tr>
                <Th right={false}>#</Th>
                <Th right={false}>{t('rk.player')}</Th>
                <Th hint={t('rk.ptsHint')}>{t('rk.pts')}</Th>
                <Th>{t('an.col.avgPos')}</Th>
                <Th>{t('rk.wins')}</Th>
                <Th>{t('rk.podiums')}</Th>
                <Th>{t('an.col.races')}</Th>
                <Th>{t('rk.events')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.profile_id} className="border-t border-line/60">
                  <td className="px-3 py-2 font-mono text-muted">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold">
                    <Link to={`/estadisticas/${r.profile_id}`} className="flex items-center gap-2 hover:text-kart-yellow">
                      {r.avatar_url && <img src={r.avatar_url} alt="" className="size-6 rounded-full" />}
                      <Flag code={r.country_code} locale={locale} />
                      {r.username}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-kart-yellow">{num(r.avg_points, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(r.avg_pos, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{num(r.win_rate, 1)} %</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{num(r.podium_rate, 1)} %</td>
                  <td className="px-3 py-2 text-right font-mono text-muted">{r.races}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted">{r.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LoungeRanking({ country }: { country: string }) {
  const { t, locale } = useI18n()
  const num = useNum()
  const [state, setState] = useState<{ key: string; rows: LoungeRow[]; total: number; loading: boolean; error: boolean }>({
    key: '',
    rows: [],
    total: 0,
    loading: true,
    error: false,
  })
  const [members, setMembers] = useState<Map<number, string>>(new Map())

  // Jugadores del Lounge que también están en la web (para enlazar a sus estadísticas)
  useEffect(() => {
    if (!supabase) return
    supabase
      .from('lounge_players')
      .select('lounge_id, profile_id')
      .then(({ data }) => setMembers(new Map((data ?? []).map((p) => [p.lounge_id as number, p.profile_id as string]))))
  }, [])

  const load = async (skip: number, replace: boolean) => {
    const key = country
    setState((s) => ({ ...s, loading: true, error: false, ...(replace ? { rows: [], key } : {}) }))
    try {
      const res = await fetch(`/api/lounge-ranking?country=${country}&skip=${skip}`)
      const json = (await res.json()) as LoungePage
      if (!res.ok || !json.ok) throw new Error('lounge')
      setState((s) => (s.key !== key && !replace ? s : { key, rows: replace ? json.players : [...s.rows, ...json.players], total: json.total, loading: false, error: false }))
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }))
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0, true)
    // load solo depende del país elegido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country])

  const { rows, total, loading, error } = state
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-xs text-muted">{t('rk.loungeHint')}</p>
      {error && rows.length === 0 ? (
        <p className="text-kart-red">{t('rk.loungeError')}</p>
      ) : rows.length === 0 && loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : (
        <>
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg font-display text-xs text-kart-yellow">
                <tr>
                  <Th right={false}>#</Th>
                  <Th right={false}>{t('rk.player')}</Th>
                  <Th>{t('lg.mmr')}</Th>
                  <Th>{t('lg.peak')}</Th>
                  <Th>{t('lg.col.tables')}</Th>
                  <Th>{t('rk.winRate')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const member = members.get(r.loungeId)
                  return (
                    <tr key={r.loungeId} className={`border-t border-line/60 ${member ? 'bg-surface-2/60' : ''}`}>
                      <td className="px-3 py-2 font-mono text-muted">{r.rank}</td>
                      <td className="px-3 py-2 font-semibold">
                        <span className="flex items-center gap-2">
                          <Flag code={r.country} locale={locale} />
                          {member ? (
                            <Link to={`/estadisticas/${member}`} className="text-kart-yellow hover:underline" title={t('rk.inSite')}>
                              {r.name}
                            </Link>
                          ) : (
                            r.name
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{r.mmr !== null ? num(r.mmr, 0) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted">{r.maxMmr !== null ? num(r.maxMmr, 0) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted">{r.events}</td>
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{r.winRate !== null ? `${r.winRate} %` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {rows.length < total && (
              <button type="button" disabled={loading} onClick={() => load(rows.length, false)} className="btn-line text-sm">
                {loading ? t('common.loading') : t('rk.more')}
              </button>
            )}
            <span className="font-mono text-xs text-muted">{t('rk.shown', { n: rows.length, total: num(total, 0) })}</span>
            {error && <span className="text-sm text-kart-red">{t('rk.loungeError')}</span>}
          </div>
        </>
      )}
    </div>
  )
}
