import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, PageHeader } from '../components/ui'
import { useAuth, type Profile, type Role } from '../lib/auth'
import { assignableRoles, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../lib/roles'
import { supabase } from '../lib/supabase'

type Row = Profile & { created_at: string }

const ROLE_ORDER: Role[] = ['admin', 'moderator', 'editor', 'user']
const ROLE_COLORS: Record<Role, string> = {
  admin: 'var(--color-kart-red)',
  moderator: 'var(--color-kart-blue)',
  editor: 'var(--color-kart-yellow)',
  user: 'var(--color-muted)',
}

export default function Admin() {
  const { profile, isModerator, loading } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase!
      .from('profiles')
      .select('id, discord_id, username, avatar_url, role, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Row[]
  }, [])

  useEffect(() => {
    if (!isModerator) return
    let cancelled = false
    fetchRows().then(
      (data) => !cancelled && setRows(data),
      () => !cancelled && setMessage({ ok: false, text: 'No se han podido cargar los usuarios.' }),
    )
    return () => {
      cancelled = true
    }
  }, [isModerator, fetchRows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows ?? []
    return (q ? list.filter((r) => r.username.toLowerCase().includes(q)) : list).sort(
      (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
    )
  }, [rows, query])

  if (loading) return <p className="text-muted">Cargando…</p>
  if (!profile || !isModerator) {
    return (
      <EmptyState title="Solo para moderadores y admins">
        Esta página sirve para gestionar los roles de los usuarios.
      </EmptyState>
    )
  }

  const changeRole = async (row: Row, role: Role) => {
    if (role === row.role) return
    if (role === 'admin' && !confirm(`¿Seguro que quieres hacer admin a ${row.username}? Tendrá control total.`)) return
    const { error } = await supabase!.rpc('set_user_role', { target: row.id, new_role: role })
    if (error) {
      setMessage({ ok: false, text: error.message })
      return
    }
    setMessage({ ok: true, text: `${row.username} ahora es ${ROLE_LABELS[role]}.` })
    setRows(await fetchRows())
  }

  const counts = ROLE_ORDER.map((r) => [r, rows?.filter((x) => x.role === r).length ?? 0] as const)

  return (
    <>
      <PageHeader
        title="Administración"
        subtitle={
          profile.role === 'admin'
            ? 'Gestiona los roles de todos los usuarios.'
            : 'Como moderador, puedes dar y quitar el rol de editor.'
        }
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar usuario…"
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-kart-yellow sm:w-64"
        />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map(([role, n]) => (
          <div key={role} className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-display text-2xl font-black" style={{ color: ROLE_COLORS[role] }}>
              {n}
            </p>
            <p className="text-sm font-semibold">{ROLE_LABELS[role]}</p>
            <p className="text-xs text-muted">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      {message && (
        <p className={`mb-4 rounded-xl px-4 py-2 text-sm ${message.ok ? 'bg-kart-green/15 text-kart-green' : 'bg-kart-red/15 text-kart-red'}`}>
          {message.text}
        </p>
      )}

      {!rows ? (
        <p className="text-muted">Cargando…</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((row) => {
            const options = assignableRoles(profile.role, row.role, row.id === profile.id)
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
                    {row.id === profile.id && <span className="ml-2 text-xs text-muted">(tú)</span>}
                  </span>
                  <span className="text-xs text-muted">
                    Desde {new Date(row.created_at).toLocaleDateString('es-ES')}
                  </span>
                </span>
                {options.length > 0 ? (
                  <select
                    value={row.role}
                    onChange={(e) => changeRole(row, e.target.value as Role)}
                    className="rounded-lg border border-line bg-bg px-3 py-1.5 text-sm font-semibold"
                    style={{ color: ROLE_COLORS[row.role] }}
                  >
                    {options.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="px-3 text-sm font-semibold" style={{ color: ROLE_COLORS[row.role] }}>
                    {ROLE_LABELS[row.role]}
                  </span>
                )}
              </li>
            )
          })}
          {filtered.length === 0 && <li className="px-4 py-6 text-center text-muted">Ningún usuario coincide.</li>}
        </ul>
      )}
    </>
  )
}
