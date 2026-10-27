import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import CaptureTablePanel from '../components/CaptureTablePanel'
import PlayerInput from '../components/PlayerInput'
import { SearchBox } from '../components/SearchBox'
import { PageHeader, Plate } from '../components/ui'
import WarDesignPanel from '../components/WarDesignPanel'
import { useWarDesign } from '../components/useWarDesign'
import { useI18n } from '../i18n'
import { applyCapture } from '../lib/captureTable'
import { ordinal } from '../lib/ordinal'
import { copyText } from '../lib/clipboard'
import { getAllTeams, type TeamWithMembers } from '../lib/compare'
import { rankTeams } from '../lib/search'
import { buildTable, decodeWar, emptyWar, encodeWar, hasContent, lorenziFreeText, matchKnownTeams, MAX_SHARE_LENGTH, newPlayerId, tableText, type FreePlayer, type FreeTeam, type FreeWar } from '../lib/freeTable'
import { renderTableImage, tableFileName, MIN_TABLE_DIM } from '../lib/tableImageDraw'
import { DEFAULT_DESIGN, parseDesign, type WarDesign } from '../lib/warDesign'
import { lorenziEditorUrl } from '../lib/warTable'

const STORE = 'mkw-free-war'

const validTeam = (t: unknown): t is FreeTeam =>
  !!t && typeof t === 'object' && typeof (t as FreeTeam).tag === 'string' && typeof (t as FreeTeam).name === 'string' && Array.isArray((t as FreeTeam).players) &&
  (t as FreeTeam).players.every((p) => typeof p?.name === 'string' && typeof p?.points === 'string' && typeof p?.id === 'number')

/** Lo último que se estaba editando en este navegador (solo local: la tabla no se guarda en ningún servidor) */
function loadSaved(): FreeWar | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? 'null') as FreeWar | null
    if (raw && typeof raw.title === 'string' && validTeam(raw.home) && validTeam(raw.away)) {
      // Los ids siguientes empiezan por encima de los guardados
      const top = Math.max(0, ...raw.home.players.map((p) => p.id), ...raw.away.players.map((p) => p.id))
      while (newPlayerId() <= top);
      return raw
    }
  } catch {
    // sin almacenamiento o datos rotos: se empieza de cero
  }
  return null
}

type Side = 'home' | 'away'

/** Editor de tablas de war libre: dos equipos con sus jugadores, ordenados, con los diseños de la web. Sin cuenta y sin guardar nada en la web */
export default function FreeTable() {
  const { t, lang } = useI18n()
  const [params] = useSearchParams()
  const shared = useMemo(() => decodeWar(params.get('d')), [params])
  const [initial] = useState<FreeWar>(() => shared?.war ?? loadSaved() ?? emptyWar())
  const opened = useRef(shared !== null)
  const [war, setWar] = useState<FreeWar>(initial)
  const [stored, setStored] = useWarDesign()
  // El diseño que trae un enlace se usa sin tocar el guardado hasta que lo cambies
  const [linkDesign, setLinkDesign] = useState<WarDesign | null>(() => (shared?.design ? parseDesign({ preset: shared.design.preset, colors: shared.design.colors, photo: null }) : null))
  const design = linkDesign ?? stored ?? DEFAULT_DESIGN
  const [designOpen, setDesignOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  // Ctrl+V con una captura en cualquier punto de la página abre el panel y la lee (con el panel abierto, lo recoge él)
  const [pasted, setPasted] = useState<File | null>(null)
  useEffect(() => {
    if (captureOpen) return
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return
      const image = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile()
      if (!image) return
      e.preventDefault()
      setPasted(image)
      setCaptureOpen(true)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [captureOpen])
  const [note, setNote] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ key: string; url: string } | null>(null)
  const [failed, setFailed] = useState(false)
  // Equipos de la web para el buscador (si no se pueden leer, el tag y el nombre se escriben a mano)
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [queries, setQueries] = useState<Record<Side, string>>({ home: '', away: '' })
  useEffect(() => {
    let cancelled = false
    getAllTeams().then(
      (list) => !cancelled && setTeams(list),
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [])

  const data = useMemo(() => buildTable(war), [war])
  const ready = hasContent(data)

  useEffect(() => {
    // Una tabla recién abierta desde un enlace no pisa la que tenías guardada hasta que la toques
    if (opened.current && war === initial) return
    try {
      localStorage.setItem(STORE, JSON.stringify(war))
    } catch {
      // almacenamiento no disponible: la tabla sigue funcionando
    }
  }, [war, initial])

  const labels = useMemo(() => ({ player: t('event.player'), points: t('event.points'), war: 'WAR', place: (n: number) => ordinal(n, lang) }), [t, lang])
  const designKey = useMemo(() => JSON.stringify(design), [design])
  const key = JSON.stringify({ data, labels }) + designKey

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    let objectUrl: string | null = null
    setFailed(false)
    // Un momento de espera: al escribir o arrastrar un color no se redibuja en cada pulsación
    const timer = setTimeout(() => {
      renderTableImage(data, design, labels).then(
        (blob) => {
          objectUrl = URL.createObjectURL(blob)
          if (cancelled) URL.revokeObjectURL(objectUrl)
          else setPreview({ key, url: objectUrl })
        },
        () => !cancelled && setFailed(true),
      )
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // data, design y labels ya van en key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  useEffect(() => {
    const url = preview?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [preview])

  const patchTeam = (side: Side, patch: Partial<FreeTeam>) => setWar((w) => ({ ...w, [side]: { ...w[side], ...patch } }))
  const patchPlayer = (side: Side, id: number, patch: Partial<FreePlayer>) =>
    setWar((w) => ({ ...w, [side]: { ...w[side], players: w[side].players.map((p) => (p.id === id ? { ...p, ...patch } : p)) } }))
  const addPlayer = (side: Side) => setWar((w) => ({ ...w, [side]: { ...w[side], players: [...w[side].players, { id: newPlayerId(), name: '', points: '' }] } }))
  const removePlayer = (side: Side, id: number) => setWar((w) => ({ ...w, [side]: { ...w[side], players: w[side].players.filter((p) => p.id !== id) } }))

  const flash = (msg: string, ms = 2500) => {
    setNote(msg)
    setTimeout(() => setNote(null), ms)
  }
  const blob = async () => renderTableImage(data, design, labels)

  const copyImage = async () => {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return flash(t('warImg.fallback'))
    try {
      // La promesa se crea ya: Safari exige crear el ClipboardItem dentro del clic
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob() })])
      flash(t('warImg.copied'))
    } catch {
      flash(t('warImg.error'))
    }
  }
  const download = async () => {
    try {
      const url = URL.createObjectURL(await blob())
      const a = document.createElement('a')
      a.href = url
      a.download = tableFileName(data)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      flash(t('warImg.downloaded'))
    } catch {
      flash(t('warImg.error'))
    }
  }
  const copyLorenzi = async () => flash((await copyText(lorenziFreeText(war))) ? t('free.copied') : t('warImg.error'))
  const copyPlain = async () => flash((await copyText(tableText(data))) ? t('free.copied') : t('warImg.error'))
  const copyLink = async () => {
    const code = encodeWar(war, { preset: design.preset, colors: design.colors })
    if (code.length > MAX_SHARE_LENGTH) return flash(t('share.tooLong'))
    flash((await copyText(`${window.location.origin}/t?d=${code}&lang=${lang}`)) ? t('share.copied') : t('warImg.error'))
  }
  const clear = () => {
    if (!window.confirm(t('free.clearConfirm'))) return
    setWar(emptyWar())
  }

  const pickTeam = (side: Side, tm: TeamWithMembers) => {
    patchTeam(side, { tag: tm.tag, name: tm.name, teamId: tm.id })
    setQueries((q) => ({ ...q, [side]: '' }))
  }
  const clearTeam = (side: Side) => patchTeam(side, { tag: '', name: '', teamId: null })

  const teamEditor = (side: Side) => {
    const team = war[side]
    const label = side === 'home' ? t('free.team1') : t('free.team2')
    const picked = team.teamId ? teams.find((tm) => tm.id === team.teamId) : undefined
    const other = war[side === 'home' ? 'away' : 'home'].teamId
    const found = rankTeams(queries[side], teams.filter((tm) => tm.id !== other)).slice(0, 6)
    const members = picked?.members.map((m) => m.username) ?? []
    return (
      <section key={side} className="panel space-y-3 p-4">
        <h2 className="font-display text-lg font-black text-kart-yellow uppercase">{label}</h2>
        {picked ? (
          <div className="flex items-center justify-between border-2 border-kart-yellow bg-surface p-3">
            <div className="flex items-center gap-2">
              <Plate>{picked.tag}</Plate>
              <span className="font-display text-lg font-bold">{picked.name}</span>
            </div>
            <button type="button" onClick={() => clearTeam(side)} className="text-sm text-muted hover:text-kart-red" aria-label={t('free.clearTeam')} title={t('free.clearTeam')}>
              ✕
            </button>
          </div>
        ) : (
          teams.length > 0 && (
            <SearchBox
              value={queries[side]}
              onChange={(v) => setQueries((q) => ({ ...q, [side]: v }))}
              suggestions={found.map((tm) => ({ key: String(tm.id), label: tm.name, icon: <Plate>{tm.tag}</Plate>, detail: `MKC #${tm.id}` }))}
              onPick={(s) => {
                const tm = found.find((o) => String(o.id) === s.key)
                if (tm) pickTeam(side, tm)
              }}
              placeholder={t('free.searchTeam')}
            />
          )
        )}
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <input className="field" value={team.tag} maxLength={12} onChange={(e) => patchTeam(side, { tag: e.target.value, ...(picked && e.target.value !== picked.tag ? { teamId: null } : {}) })} placeholder={t('free.tag')} aria-label={`${label}: ${t('free.tag')}`} />
          <input className="field" value={team.name} maxLength={40} onChange={(e) => patchTeam(side, { name: e.target.value })} placeholder={t('free.teamName')} aria-label={`${label}: ${t('free.teamName')}`} />
        </div>
        <div>
          <div className="mb-1 grid grid-cols-[1fr_7rem_2.5rem] gap-2 font-display text-sm font-extrabold tracking-wider text-kart-yellow uppercase">
            <span>{t('free.player')}</span>
            <span>{t('free.points')}</span>
            <span />
          </div>
          <ul className="space-y-2">
            {team.players.map((p) => (
              <li key={p.id} className="grid grid-cols-[1fr_7rem_2.5rem] gap-2">
                <PlayerInput value={p.name} onChange={(v) => patchPlayer(side, p.id, { name: v })} suggestions={members} taken={team.players.filter((q) => q.id !== p.id).map((q) => q.name)} placeholder={t('free.player')} maxLength={40} />
                <input className="field time" inputMode="text" value={p.points} maxLength={40} onChange={(e) => patchPlayer(side, p.id, { points: e.target.value })} placeholder="0" aria-label={t('free.points')} />
                <button type="button" className="btn-line !px-0" onClick={() => removePlayer(side, p.id)} aria-label={t('free.remove')} title={t('free.remove')}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" className="btn-yellow text-base" onClick={() => addPlayer(side)}>
          {t('free.add')}
        </button>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('free.title')} subtitle={t('free.subtitle')} />

      <div className="flex flex-wrap items-center gap-3">
        <input className="field max-w-xl flex-1" value={war.title} maxLength={60} onChange={(e) => setWar((w) => ({ ...w, title: e.target.value }))} placeholder={t('free.tableName')} aria-label={t('free.tableName')} />
        <button type="button" className="btn-line text-sm" onClick={() => setWar((w) => ({ ...w, home: w.away, away: w.home }))}>
          ⇄ {t('free.swap')}
        </button>
        <button type="button" className="btn-line text-sm" onClick={() => setCaptureOpen((o) => !o)} aria-expanded={captureOpen}>
          📷 {t('cap.open')}
        </button>
        <span className="hidden text-xs text-muted lg:inline">{t('cap.paste')}</span>
        <button type="button" className="min-h-11 text-sm text-muted hover:text-kart-red" onClick={clear}>
          {t('free.clear')}
        </button>
      </div>

      {captureOpen && (
        <CaptureTablePanel
          tags={[war.home.tag, war.away.tag]}
          initialImage={pasted}
          onClose={() => {
            setCaptureOpen(false)
            setPasted(null)
          }}
          onApply={(rows, tags) => {
            // Los tags de los nombres pasan a ser los de los equipos y, si son de un equipo de la web, se elige con su nombre
            setWar((w) => matchKnownTeams(applyCapture(w, rows, tags), teams))
            setCaptureOpen(false)
            setPasted(null)
            // Las filas que no se pasan (puntos que no son de un jugador, como el total de un equipo) se avisan, no se descartan en silencio
            const skipped = rows.filter((r) => !r.include && r.name.trim() !== '').map((r) => `${r.name} (${r.points})`)
            const used = rows.filter((r) => r.include && (r.name.trim() !== '' || r.points.trim() !== '')).length
            flash(skipped.length > 0 ? `${t('cap.done', { n: used })} ${t('cap.skipped', { names: skipped.join(', ') })}` : t('cap.done', { n: used }), skipped.length > 0 ? 12000 : 4000)
          }}
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {teamEditor('home')}
        {teamEditor('away')}
      </div>
      <p className="text-sm text-muted">{t('free.hint')}</p>

      <div>
        <button type="button" className="btn-line text-sm" onClick={() => setDesignOpen((o) => !o)} aria-expanded={designOpen}>
          🎨 {t('design.title')}
        </button>
      </div>
      {designOpen && (
        <div className="panel overflow-hidden">
          <WarDesignPanel
            eventId={null}
            minDim={MIN_TABLE_DIM}
            value={design}
            onChange={(next) => {
              setLinkDesign(null)
              setStored(next)
            }}
          />
          <p className="px-4 pb-4 text-xs text-muted sm:px-5">{t('free.photoSafe')}</p>
        </div>
      )}

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <button type="button" className="btn-yellow text-base" onClick={copyImage} disabled={!ready}>
            {t('warImg.copy')}
          </button>
          <button type="button" className="btn-line text-base" onClick={download} disabled={!ready}>
            {t('warImg.download')}
          </button>
          <button type="button" className="btn-line text-base" onClick={copyLink} disabled={!ready}>
            {t('share.copyLink')}
          </button>
          <button type="button" className="text-sm font-semibold text-kart-blue hover:underline disabled:opacity-50" onClick={copyLorenzi} disabled={!ready}>
            {t('event.copyTable')}
          </button>
          <button type="button" className="text-sm font-semibold text-kart-blue hover:underline disabled:opacity-50" onClick={copyPlain} disabled={!ready}>
            {t('free.copy')}
          </button>
          {ready && (
            <a href={lorenziEditorUrl(lorenziFreeText(war))} target="_blank" rel="noreferrer" className="text-sm font-semibold text-kart-blue hover:underline">
              {t('event.openLorenzi')} ↗
            </a>
          )}
          {note && (
            <span role="status" className="text-sm text-kart-yellow">
              {note}
            </span>
          )}
        </div>
        {!ready ? (
          <p className="bg-bg px-5 py-10 text-center text-sm text-muted">{t('free.empty')}</p>
        ) : failed && !preview ? (
          <p className="bg-bg px-5 py-10 text-center text-sm text-muted">{t('warImg.error')}</p>
        ) : !preview ? (
          <p className="bg-bg px-5 py-10 text-center text-sm text-muted">{t('warImg.generating')}</p>
        ) : (
          <div className="bg-bg">
            <img src={preview.url} alt={`${data.home.tag} ${data.home.total} – ${data.away.total} ${data.away.tag}`} className={`w-full transition-opacity ${preview.key === key ? '' : 'opacity-60'}`} />
          </div>
        )}
      </section>
      <p className="text-xs text-muted">{t('share.tableHint')}</p>
    </div>
  )
}
