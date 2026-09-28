import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, PageHeader } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth, type Profile } from '../lib/auth'
import { ASSIGNABLE_ROLES, canChangeRole, canEditPermissions, ROLE_LABEL, type AssignableRole } from '../lib/roles'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/time'

type Row = Profile & { created_at: string }

const ROLE_ORDER = ['admin', 'moderator', 'user', 'editor']
const ROLE_COLORS: Record<string, string> = {
  admin: 'var(--color-kart-red)',
  moderator: 'var(--color-kart-blue)',
  user: 'var(--color-muted)',
}

/** Orden: admins, moderadores, editores y, al final, usuarios sin permisos */
const rank = (r: Row) => ROLE_ORDER.indexOf(r.role) * 3 + (r.tt_editor || r.strat_editor ? 0 : 1)

export default function Admin() {
  const { t, locale } = useI18n()
  const { profile, isModerator, loading } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

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

  const changeRole = (row: Row, role: AssignableRole) => {
    if (role === row.role) return
    if (role === 'admin' && !confirm(t('admin.confirmAdmin', { user: row.username }))) return
    run(
      () => supabase!.rpc('set_user_role', { target: row.id, new_role: role }),
      t('admin.roleChanged', { user: row.username, role: t(ROLE_LABEL[role]) }),
    )
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
    { label: t('role.admin'), desc: t('role.adminDesc'), n: count((r) => r.role === 'admin'), color: ROLE_COLORS.admin },
    { label: t('role.moderator'), desc: t('role.moderatorDesc'), n: count((r) => r.role === 'moderator'), color: ROLE_COLORS.moderator },
    { label: t('perm.ttEditors'), desc: t('perm.ttDesc'), n: count((r) => r.role === 'user' && r.tt_editor), color: 'var(--color-kart-yellow)' },
    { label: t('perm.stratEditors'), desc: t('perm.stratDesc'), n: count((r) => r.role === 'user' && r.strat_editor), color: 'var(--color-kart-green)' },
  ]

  return (
    <>
      <PageHeader
        title={t('admin.title')}
        subtitle={profile.role === 'admin' ? t('admin.subtitleAdmin') : t('admin.subtitleMod')}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.search')}
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-kart-yellow sm:w-64"
        />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-surface p-4">
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
          className={`mb-4 rounded-xl px-4 py-2 text-sm ${message.ok ? 'bg-kart-green/15 text-kart-green' : 'bg-kart-red/15 text-kart-red'}`}
        >
          {message.text}
        </p>
      )}

      {!rows ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((row) => {
            const isSelf = row.id === profile.id
            const roleEditable = canChangeRole(profile.role, isSelf)
            const permsEditable = canEditPermissions(profile.role, row.role, isSelf)
            const role = (ASSIGNABLE_ROLES as readonly string[]).includes(row.role) ? (row.role as AssignableRole) : 'user'
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

                {role === 'user' ? (
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

                {roleEditable ? (
                  <select
                    value={role}
                    onChange={(e) => changeRole(row, e.target.value as AssignableRole)}
                    className="rounded-lg border border-line bg-bg px-3 py-1.5 text-sm font-semibold"
                    style={{ color: ROLE_COLORS[role] }}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(ROLE_LABEL[r])}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="w-24 px-3 text-right text-sm font-semibold" style={{ color: ROLE_COLORS[role] }}>
                    {t(ROLE_LABEL[role])}
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
