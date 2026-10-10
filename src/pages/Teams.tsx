import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { SearchBox } from '../components/SearchBox'
import { EmptyState, Flag, PageHeader, Plate, Tabs } from '../components/ui'
import { TeamLogo } from '../components/TeamLogo'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { getAllTeams, type TeamWithMembers } from '../lib/compare'

export default function Teams() {
  const { t, locale } = useI18n()
  const { profile, syncMkc, enabled } = useAuth()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'with_members'>('all')
  const [search, setSearch] = useState('')
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null)
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

  // Lista ordenada alfabéticamente
  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = teams.filter((tm) => {
      const matchQuery =
        !q ||
        tm.name.toLowerCase().includes(q) ||
        tm.tag.toLowerCase().includes(q) ||
        (tm.parent_name && tm.parent_name.toLowerCase().includes(q))
      const matchFilter = filter === 'all' || tm.members.length > 0
      return matchQuery && matchFilter
    })
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [teams, search, filter])

  // Resultados rápidos en el desplegable del buscador
  const quickSearchMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return teams
      .filter(
        (tm) =>
          tm.name.toLowerCase().includes(q) ||
          tm.tag.toLowerCase().includes(q) ||
          (tm.parent_name && tm.parent_name.toLowerCase().includes(q)),
      )
      .slice(0, 6)
  }, [teams, search])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim().toLowerCase()
    if (!q) return

    // 1. Coincidencia exacta de nombre, tag o club
    let match = teams.find(
      (tm) =>
        tm.name.toLowerCase() === q ||
        tm.tag.toLowerCase() === q ||
        (tm.parent_name && tm.parent_name.toLowerCase() === q),
    )
    // 2. Coincidencia que empiece por la búsqueda
    if (!match) {
      match = teams.find(
        (tm) =>
          tm.name.toLowerCase().startsWith(q) ||
          tm.tag.toLowerCase().startsWith(q) ||
          (tm.parent_name && tm.parent_name.toLowerCase().startsWith(q)),
      )
    }
    // 3. Primer resultado que contenga la búsqueda
    if (!match) {
      match = teams.find(
        (tm) =>
          tm.name.toLowerCase().includes(q) ||
          tm.tag.toLowerCase().includes(q) ||
          (tm.parent_name && tm.parent_name.toLowerCase().includes(q)),
      )
    }

    if (match) {
      navigate(`/equipos/${match.id}`)
    } else {
      setNotFoundQuery(search.trim())
      setTimeout(() => setNotFoundQuery(null), 3500)
    }
  }

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

      {/* Tu equipo: acceso directo y enlace a su perfil */}
      {profile && myTeams.length > 0 && (
        <section className="mb-8 border-2 border-kart-yellow/60 bg-surface p-5">
          <div className="flex items-center justify-between">
            <Link
              to={`/equipos/${myTeams[0].id}`}
              className="group inline-flex items-center gap-2 font-mono text-xs font-bold tracking-widest text-kart-yellow uppercase hover:underline"
            >
              ★ {t('teams.myTeam')}
              <span className="text-[10px] text-muted group-hover:text-kart-yellow">→</span>
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {myTeams.map((tm) => (
              <div
                key={tm.id}
                className="flex items-center justify-between gap-3 rounded border border-line/60 bg-bg p-3.5 transition-colors hover:border-kart-yellow"
              >
                <Link to={`/equipos/${tm.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                  <TeamLogo logoUrl={tm.logo_url} tag={tm.tag} name={tm.name} size="lg" />
                  <Plate color="var(--color-kart-yellow)">{tm.tag}</Plate>
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg font-bold group-hover:text-kart-yellow">
                      {tm.name}
                    </h3>
                    {tm.parent_name && tm.parent_name !== tm.name && (
                      <p className="truncate font-mono text-[11px] text-muted">{tm.parent_name}</p>
                    )}
                    <p className="font-mono text-xs text-muted">
                      {t('teams.membersRegistered', { n: tm.members.length })}
                    </p>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    to={`/equipos/${tm.id}`}
                    className="btn-yellow text-xs font-bold"
                  >
                    {t('teams.viewProfile')}
                  </Link>
                  <Link
                    to={`/tiempos?con=team:${tm.id}`}
                    className="btn-line text-xs font-bold"
                  >
                    ⏱ {t('teams.compare')}
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
        <div className="relative w-full sm:w-80">
          <form onSubmit={handleSearchSubmit} className="flex w-full items-center gap-2">
            <SearchBox
              value={search}
              onChange={(v) => {
                setSearch(v)
                if (notFoundQuery) setNotFoundQuery(null)
              }}
              suggestions={quickSearchMatches.map((tm) => ({
                key: String(tm.id),
                label: tm.name,
                icon: (
                  <>
                    <TeamLogo logoUrl={tm.logo_url} tag={tm.tag} name={tm.name} size="sm" />
                    <Plate>{tm.tag}</Plate>
                  </>
                ),
                detail: tm.parent_name && tm.parent_name !== tm.name ? tm.parent_name : undefined,
              }))}
              onPick={(s) => navigate(`/equipos/${s.key}`)}
              placeholder={t('teams.search')}
            />
            <button
              type="submit"
              disabled={!search.trim()}
              className="btn-yellow shrink-0 px-4 py-2 text-sm font-bold disabled:opacity-50"
              title="Enter para abrir equipo"
            >
              {t('teams.searchBtn')}
            </button>
          </form>
        </div>
      </div>

      {notFoundQuery && (
        <p className="mb-4 border-l-4 border-kart-red bg-surface px-4 py-2 text-sm text-kart-red">
          {t('teams.notFoundQuery', { q: notFoundQuery })}
        </p>
      )}

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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <TeamLogo logoUrl={tm.logo_url} tag={tm.tag} name={tm.name} size="md" />
                    <Plate>{tm.tag}</Plate>
                  </div>
                  <span className="font-mono text-xs font-bold text-muted">
                    {tm.members.length > 0
                      ? t('teams.membersRegistered', { n: tm.members.length })
                      : t('teams.noMembers')}
                  </span>
                </div>
                <div className="mt-3">
                  <Link to={`/equipos/${tm.id}`} className="block font-display text-2xl font-black hover:text-kart-yellow">
                    {tm.name}
                  </Link>
                  {tm.parent_name && tm.parent_name !== tm.name && (
                    <span className="font-mono text-xs text-muted block mt-0.5">{tm.parent_name}</span>
                  )}
                </div>

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
