import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Flag, PageHeader, Plate, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { getAllTeams, type TeamWithMembers } from '../lib/compare'

export default function Teams() {
  const { t, locale } = useI18n()
  const { profile, syncMkc, enabled } = useAuth()
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'with_members'>('all')
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getAllTeams()
      .then((data) => {
        if (!cancelled) {
          setTeams(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncStatus(null)
    const ok = await syncMkc()
    setSyncing(false)
    if (ok) {
      setSyncStatus(t('teams.syncSuccess'))
      // Recargar equipos para reflejar posibles cambios
      const updated = await getAllTeams().catch(() => [])
      if (updated.length) setTeams(updated)
    } else {
      setSyncStatus(t('teams.syncError'))
    }
  }

  // Equipos del usuario actual
  const myTeams = useMemo(() => {
    if (!profile) return []
    return teams.filter((tm) => tm.members.some((m) => m.id === profile.id))
  }, [teams, profile])

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teams.filter((tm) => {
      const matchQuery = !q || tm.name.toLowerCase().includes(q) || tm.tag.toLowerCase().includes(q)
      const matchFilter = filter === 'all' || tm.members.length > 0
      return matchQuery && matchFilter
    })
  }, [teams, search, filter])

  const countAll = teams.length
  const countWithMembers = teams.filter((t) => t.members.length > 0).length

  return (
    <>
      <PageHeader title={t('nav.teams')} subtitle={t('teams.subtitle')}>
        {profile && (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-yellow text-sm"
            >
              {syncing ? t('teams.syncing') : t('teams.syncMkc')}
            </button>
            {syncStatus && <p className="font-mono text-xs text-kart-yellow">{syncStatus}</p>}
          </div>
        )}
      </PageHeader>

      {profile && myTeams.length > 0 && (
        <section className="mb-8 border-2 border-kart-yellow/60 bg-surface p-5">
          <p className="font-mono text-xs font-bold tracking-widest text-kart-yellow uppercase">{t('teams.myTeam')}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            {myTeams.map((tm) => (
              <div key={tm.id} className="flex items-center gap-3">
                <Plate color="var(--color-kart-yellow)">{tm.tag}</Plate>
                <div>
                  <h3 className="font-display text-lg font-bold">{tm.name}</h3>
                  <Link
                    to={`/tiempos?con=team:${tm.id}`}
                    className="font-mono text-xs font-bold text-kart-yellow hover:underline"
                  >
                    → {t('teams.compare')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Tabs
          tabs={[
            { id: 'all', label: t('teams.all', { n: countAll }) },
            { id: 'with_members', label: t('teams.withMembers', { n: countWithMembers }) },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('teams.search')}
          className="field w-full sm:w-64"
        />
      </div>

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : filteredTeams.length === 0 ? (
        <EmptyState title={t('teams.noTeams')}>
          {!enabled && <p className="text-muted">{t('teams.soonText')}</p>}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((tm) => (
            <div
              key={tm.id}
              className="flex flex-col justify-between border-2 border-line bg-surface p-5 transition-colors hover:border-line/90"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <Plate>{tm.tag}</Plate>
                  <span className="font-mono text-xs font-bold text-muted">
                    {tm.members.length > 0
                      ? t('teams.membersRegistered', { n: tm.members.length })
                      : t('teams.noMembers')}
                  </span>
                </div>
                <Link to={`/equipos/${tm.id}`} className="mt-3 block font-display text-2xl font-black hover:text-kart-yellow">
                  {tm.name}
                </Link>

                {tm.members.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tm.members.map((m) => (
                      <Link
                        key={m.id}
                        to={`/estadisticas/${m.id}`}
                        title={m.username}
                        className="flex items-center gap-1.5 border border-line/60 bg-surface-2 px-2 py-1 text-xs hover:border-kart-yellow"
                      >
                        <Flag code={m.country_code} locale={locale} />
                        <span className="max-w-[120px] truncate font-semibold">{m.username}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-line/50 pt-3">
                <Link
                  to={`/equipos/${tm.id}`}
                  className="font-mono text-xs font-bold text-ink hover:text-kart-yellow"
                >
                  Wars & Stats →
                </Link>
                <Link
                  to={`/tiempos?con=team:${tm.id}`}
                  className="font-mono text-xs font-bold text-kart-yellow hover:underline"
                >
                  {t('teams.compare')} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
