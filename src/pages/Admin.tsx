import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, PageHeader } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth, type Profile } from '../lib/auth'
import {
  canAssignFullRole,
  canEditPermissions,
  FULL_ROLES,
  FULL_ROLE_LABEL,
  getUserFullRole,
  type FullRole,
} from '../lib/roles'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/time'

type Row = Profile & { created_at: string }

const FULL_ROLE_COLORS: Record<FullRole, string> = {
  admin: 'var(--color-kart-red)',
  moderator: 'var(--color-kart-blue)',
  all_editor: 'var(--color-kart-yellow)',
  strat_editor: 'var(--color-kart-green)',
  tt_editor: 'var(--color-kart-yellow)',
  user: 'var(--color-muted)',
}

const ROLE_RANK: Record<FullRole, number> = {
  admin: 0,
  moderator: 1,
  all_editor: 2,
  tt_editor: 3,
  strat_editor: 4,
  user: 5,
}

/** Orden: admins, moderadores, editores y usuarios */
const rank = (r: Row) => ROLE_RANK[getUserFullRole(r)]

export default function Admin() {
  const { t, locale } = useI18n()
  const { profile, isModerator, loading } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncingMkc, setSyncingMkc] = useState(false)

  const handleSyncMkc = async () => {
    if (!supabase || syncingMkc) return
    setSyncingMkc(true)
    setMessage(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No session')
      const res = await fetch('/api/sync', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (res.ok) {
        setMessage({
          ok: true,
          text: t('admin.syncSuccess', {
            checked: String(json.usersChecked ?? 0),
            updated: String(json.usersUpdated ?? 0),
          }),
        })
        setRows(await fetchRows())
      } else {
        setMessage({
          ok: false,
          text: t('admin.syncError', { error: json.error || res.statusText }),
        })
      }
    } catch (err: unknown) {
      setMessage({
        ok: false,
        text: t('admin.syncError', { error: err instanceof Error ? err.message : String(err) }),
      })
    } finally {
      setSyncingMkc(false)
    }
  }

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase!
      .from('profiles')
      .select('id, discord_id, username, avatar_url, role, tt_editor, strat_editor, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Row[]
  }, [])

  useEffect(() => {
    if (!isModerator) return
    let cancelled = false
    fetchRows().then(
      (data) => !cancelled && setRows(data),
      () => !cancelled && setMessage({ ok: false, text: t('common.loadError') }),
    )
    return () => {
      cancelled = true
    }
  }, [isModerator, fetchRows, t])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows ?? []
    return (q ? list.filter((r) => r.username.toLowerCase().includes(q)) : list).sort((a, b) => rank(a) - rank(b))
  }, [rows, query])

  if (loading) return <p className="text-muted">{t('common.loading')}</p>
  if (!profile || !isModerator) return <EmptyState title={t('admin.only')}>{t('admin.onlyText')}</EmptyState>

  const run = async (action: () => PromiseLike<{ error: { message: string } | null }>, success: string) => {
    const { error } = await action()
    if (error) {
      setMessage({ ok: false, text: t('admin.error', { message: error.message }) })
      return
    }
    setMessage({ ok: true, text: success })
    setRows(await fetchRows())
  }

  const changeFullRole = async (row: Row, newRole: FullRole) => {
    const current = getUserFullRole(row)
    if (newRole === current) return
    if (newRole === 'admin' && !confirm(t('admin.confirmAdmin', { user: row.username }))) return

    if (newRole === 'admin' || newRole === 'moderator') {
      await run(
        () => supabase!.rpc('set_user_role', { target: row.id, new_role: newRole }),
        t('admin.roleChanged', { user: row.username, role: t(FULL_ROLE_LABEL[newRole]) }),
      )
    } else {
      // Si el usuario era admin o moderator, primero se cambia su rol en BD a 'user'
      if (row.role !== 'user') {
        const { error: roleErr } = await supabase!.rpc('set_user_role', { target: row.id, new_role: 'user' })
        if (roleErr) {
          setMessage({ ok: false, text: t('admin.error', { message: roleErr.message }) })
          return
        }
      }
      const tt = newRole === 'tt_editor' || newRole === 'all_editor'
      const strat = newRole === 'strat_editor' || newRole === 'all_editor'
      await run(
        () => supabase!.rpc('set_editor_permissions', { target: row.id, tt, strat }),
        t('admin.roleChanged', { user: row.username, role: t(FULL_ROLE_LABEL[newRole]) }),
      )
    }
  }

  const togglePermission = (row: Row, perm: 'tt' | 'strat') => {
    const tt = perm === 'tt' ? !row.tt_editor : row.tt_editor
    const strat = perm === 'strat' ? !row.strat_editor : row.strat_editor
    run(
      () => supabase!.rpc('set_editor_permissions', { target: row.id, tt, strat }),
      t('admin.permsChanged', { user: row.username }),
    )
  }

  const count = (pred: (r: Row) => boolean) => rows?.filter(pred).length ?? 0
  const cards = [
    { label: t('role.admin'), desc: t('role.adminDesc'), n: count((r) => r.role === 'admin'), color: FULL_ROLE_COLORS.admin },
    { label: t('role.moderator'), desc: t('role.moderatorDesc'), n: count((r) => r.role === 'moderator'), color: FULL_ROLE_COLORS.moderator },
    { label: t('perm.ttEditors'), desc: t('perm.ttDesc'), n: count((r) => (r.role === 'user' && r.tt_editor) || r.role !== 'user'), color: FULL_ROLE_COLORS.tt_editor },
    { label: t('perm.stratEditors'), desc: t('perm.stratDesc'), n: count((r) => (r.role === 'user' && r.strat_editor) || r.role !== 'user'), color: FULL_ROLE_COLORS.strat_editor },
  ]

  return (
    <>
      <PageHeader
        title={t('admin.title')}
        subtitle={profile.role === 'admin' ? t('admin.subtitleAdmin') : t('admin.subtitleMod')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncMkc}
            disabled={syncingMkc}
            className="btn-line text-sm"
          >
            {syncingMkc ? t('admin.syncing') : `↻ ${t('admin.syncMkcRosters')}`}
          </button>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin.search')}
            className="field sm:w-64"
          />
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="panel p-4">
            <p className="font-display text-2xl font-black" style={{ color: c.color }}>
              {c.n}
            </p>
            <p className="text-sm font-semibold">{c.label}</p>
            <p className="text-xs text-muted">{c.desc}</p>
          </div>
        ))}
      </div>

      {message && (
        <p
          className={`mb-4 border-l-4 bg-surface px-4 py-2 text-sm ${message.ok ? 'border-kart-green' : 'border-kart-red'}`}
        >
          {message.text}
        </p>
      )}

      {!rows ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : (
        <ul className="overflow-hidden panel">
          {filtered.map((row) => {
            const isSelf = row.id === profile.id
            const fullRole = getUserFullRole(row)
            const permsEditable = canEditPermissions(profile.role, row.role, isSelf)
            const availableOptions = FULL_ROLES.filter((r) => canAssignFullRole(profile.role, row.role, r, isSelf))
            const canModifyRole = availableOptions.length > 0

            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                {row.avatar_url ? (
                  <img src={row.avatar_url} alt="" className="size-9 rounded-full" />
                ) : (
                  <span className="size-9 rounded-full bg-surface-2" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {row.username}
                    {isSelf && <span className="ml-2 text-xs text-muted">{t('common.you')}</span>}
                  </span>
                  <span className="text-xs text-muted">{t('admin.since', { date: formatDate(row.created_at, locale) })}</span>
                </span>

                {row.role === 'user' ? (
                  <span className="flex gap-2">
                    <PermissionToggle
                      label={t('perm.tt')}
                      on={row.tt_editor}
                      disabled={!permsEditable}
                      color="var(--color-kart-yellow)"
                      onClick={() => togglePermission(row, 'tt')}
                    />
                    <PermissionToggle
                      label={t('perm.strat')}
                      on={row.strat_editor}
                      disabled={!permsEditable}
                      color="var(--color-kart-green)"
                      onClick={() => togglePermission(row, 'strat')}
                    />
                  </span>
                ) : (
                  <span className="text-xs text-muted">{t('admin.allPerms')}</span>
                )}

                {canModifyRole ? (
                  <select
                    value={fullRole}
                    onChange={(e) => changeFullRole(row, e.target.value as FullRole)}
                    className="border-2 border-line bg-bg px-3 py-1.5 text-sm font-semibold"
                    style={{ color: FULL_ROLE_COLORS[fullRole] }}
                  >
                    {availableOptions.map((r) => (
                      <option key={r} value={r}>
                        {t(FULL_ROLE_LABEL[r])}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="w-32 px-3 text-right text-sm font-semibold" style={{ color: FULL_ROLE_COLORS[fullRole] }}>
                    {t(FULL_ROLE_LABEL[fullRole])}
                  </span>
                )}
              </li>
            )
          })}
          {filtered.length === 0 && <li className="px-4 py-6 text-center text-muted">{t('admin.noMatch')}</li>}
        </ul>
      )}
    </>
  )
}

function PermissionToggle({
  label,
  on,
  disabled,
  color,
  onClick,
}: {
  label: string
  on: boolean
  disabled: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className="rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors disabled:cursor-default"
      style={
        on
          ? { borderColor: color, color, background: `color-mix(in srgb, ${color} 15%, transparent)` }
          : { borderColor: 'var(--color-line)', color: 'var(--color-muted)' }
      }
    >
      {on ? '✓ ' : ''}
      {label}
    </button>
  )
}
