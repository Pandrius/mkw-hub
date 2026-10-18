import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '../components/ui'
import { useI18n } from '../i18n'
import { copyText } from '../lib/clipboard'
import { decodeTable, encodeTable, MAX_SHARE_LENGTH, rankRows, tableText, type FreeRow, type RankedRow } from '../lib/freeTable'

const STORE = 'mkw-free-table'

type Saved = { title: string; rows: FreeRow[] }

/** Lo último que se estaba editando en este navegador (solo local: esta tabla no se guarda en ningún servidor) */
function load(shared: string | null): Saved {
  // Una tabla que llega por enlace (?d=) manda sobre lo guardado
  const fromLink = decodeTable(shared)
  if (fromLink) return { title: fromLink.title, rows: fromLink.rows.map((r, id) => ({ id, ...r })) }
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Saved | null
    if (raw && Array.isArray(raw.rows) && raw.rows.every((r) => typeof r?.name === 'string' && typeof r?.points === 'string' && typeof r?.id === 'number')) {
      return { title: typeof raw.title === 'string' ? raw.title : '', rows: raw.rows }
    }
  } catch {
    // sin almacenamiento o datos rotos: se empieza de cero
  }
  return { title: '', rows: [0, 1, 2].map((id) => ({ id, name: '', points: '' })) }
}

/** PNG de la tabla con la estética de la web (asfalto y amarillo kart) */
function drawPng(title: string, rows: RankedRow[], fallbackTitle: string): HTMLCanvasElement {
  const W = 720
  const ROW = 44
  const TOP = 110
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = TOP + rows.length * ROW + 24
  const c = canvas.getContext('2d') as CanvasRenderingContext2D
  c.fillStyle = '#141414'
  c.fillRect(0, 0, W, canvas.height)
  c.fillStyle = '#ffd500'
  c.fillRect(0, 0, W, 8)
  c.textBaseline = 'middle'
  c.fillStyle = '#f4f2ec'
  c.font = '900 44px "Big Shoulders Display", Impact, sans-serif'
  c.fillText((title.trim() || fallbackTitle).toUpperCase().slice(0, 40), 28, 56)
  rows.forEach((r, i) => {
    const y = TOP + i * ROW
    c.fillStyle = i % 2 ? '#1c1c1b' : '#242422'
    c.fillRect(20, y, W - 40, ROW - 4)
    c.fillStyle = r.rank <= 3 ? '#ffd500' : '#a5a29a'
    c.font = '900 26px "Big Shoulders Display", Impact, sans-serif'
    c.fillText(String(r.rank), 38, y + ROW / 2 - 2)
    c.fillStyle = '#f4f2ec'
    c.font = '600 22px Barlow, Arial, sans-serif'
    c.fillText(r.name.slice(0, 32), 90, y + ROW / 2 - 2)
    c.textAlign = 'right'
    c.font = '700 24px "JetBrains Mono", monospace'
    c.fillStyle = r.points < 0 ? '#ff5a4d' : '#f4f2ec'
    c.fillText(String(r.points), W - 38, y + ROW / 2 - 2)
    c.textAlign = 'left'
  })
  return canvas
}

/** Editor de tablas libre: sin cuenta, sin límite de jugadores y sin tocar ninguna estadística */
export default function FreeTable() {
  const { t, lang } = useI18n()
  const [params] = useSearchParams()
  const [initial] = useState(() => load(params.get('d')))
  const opened = useRef(decodeTable(params.get('d')) !== null)
  const [title, setTitle] = useState(initial.title)
  const [rows, setRows] = useState<FreeRow[]>(initial.rows)
  const [copied, setCopied] = useState(false)
  const [linkNote, setLinkNote] = useState<string | null>(null)
  const nextId = useRef(Math.max(-1, ...initial.rows.map((r) => r.id)) + 1)
  const ranked = useMemo(() => rankRows(rows), [rows])

  useEffect(() => {
    // Una tabla recién abierta desde un enlace no pisa la que tenías guardada hasta que la toques
    if (opened.current && title === initial.title && rows === initial.rows) return
    try {
      localStorage.setItem(STORE, JSON.stringify({ title, rows } satisfies Saved))
    } catch {
      // almacenamiento no disponible: la tabla sigue funcionando
    }
  }, [title, rows, initial])

  const update = (id: number, patch: Partial<FreeRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const add = () => setRows((rs) => [...rs, { id: nextId.current++, name: '', points: '' }])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tableText(title, ranked))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // el navegador no deja copiar
    }
  }
  const copyLink = async () => {
    const data = encodeTable(title, rows)
    if (data.length > MAX_SHARE_LENGTH) return setLinkNote(t('share.tooLong'))
    const ok = await copyText(`${window.location.origin}/t?d=${data}&lang=${lang}`)
    setLinkNote(ok ? t('share.copied') : null)
    setTimeout(() => setLinkNote(null), 2500)
  }
  const download = () => {
    const a = document.createElement('a')
    a.href = drawPng(title, ranked, t('free.defaultTitle')).toDataURL('image/png')
    a.download = 'tabla.png'
    a.click()
  }
  const clear = () => {
    if (!window.confirm(t('free.clearConfirm'))) return
    setTitle('')
    setRows([0, 1, 2].map(() => ({ id: nextId.current++, name: '', points: '' })))
  }

  return (
    <div>
      <PageHeader title={t('free.title')} subtitle={t('free.subtitle')} />
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="panel p-4">
          <input className="field mb-4" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={t('free.tableName')} aria-label={t('free.tableName')} />
          <div className="mb-1 grid grid-cols-[1fr_6rem_2.5rem] gap-2 font-display text-sm font-extrabold tracking-wider text-kart-yellow uppercase">
            <span>{t('free.player')}</span>
            <span>{t('free.points')}</span>
            <span />
          </div>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_6rem_2.5rem] gap-2">
                <input className="field" value={r.name} maxLength={40} onChange={(e) => update(r.id, { name: e.target.value })} placeholder={t('free.player')} aria-label={t('free.player')} />
                <input className="field time" inputMode="decimal" value={r.points} onChange={(e) => update(r.id, { points: e.target.value })} placeholder="0" aria-label={t('free.points')} />
                <button type="button" className="btn-line !px-0" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} aria-label={t('free.remove')} title={t('free.remove')}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn-yellow" onClick={add}>
              {t('free.add')}
            </button>
            <button type="button" className="btn-line" onClick={clear}>
              {t('free.clear')}
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">{t('free.hint')}</p>
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 font-display text-2xl font-black uppercase">{title.trim() || t('free.defaultTitle')}</h2>
          {ranked.length === 0 ? (
            <p className="text-muted">{t('free.empty')}</p>
          ) : (
            <table className="w-full">
              <tbody>
                {ranked.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className={`w-12 py-2 font-display text-2xl font-black ${r.rank <= 3 ? 'text-kart-yellow' : 'text-muted'}`}>{r.rank}</td>
                    <td className="py-2 break-words">{r.name}</td>
                    <td className={`time py-2 text-right ${r.points < 0 ? 'text-kart-red' : ''}`}>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn-yellow" onClick={download} disabled={ranked.length === 0}>
              {t('free.png')}
            </button>
            <button type="button" className="btn-line" onClick={copy} disabled={ranked.length === 0}>
              {copied ? t('free.copied') : t('free.copy')}
            </button>
            <button type="button" className="btn-line" onClick={copyLink} disabled={ranked.length === 0}>
              {t('share.copyLink')}
            </button>
          </div>
          {linkNote && <p role="status" className="mt-2 text-sm text-kart-yellow">{linkNote}</p>}
          <p className="mt-3 text-xs text-muted">{t('share.tableHint')}</p>
        </section>
      </div>
    </div>
  )
}
