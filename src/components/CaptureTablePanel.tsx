import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { bestReading, parseCaptureLines, swapSides, type CaptureRow, type Side } from '../lib/captureTable'
import { newPlayerId } from '../lib/freeTable'
import { readCaptureLines } from '../lib/ocrImage'

/**
 * Tabla de war a partir de una captura de la pantalla de resultados. Se lee en el navegador (sin subir nada a ningún servidor): salen
 * los jugadores con sus puntos, sin tag ni símbolos raros, y el equipo de cada uno se saca del tag de su nombre (o, si no lo hay, del
 * color de su fila). Si se sabe el equipo de cada uno, la tabla se rellena directamente; si no, se enseñan las filas para elegirlo.
 */
export default function CaptureTablePanel({ tags, onApply, onClose }: { tags: string[]; onApply: (rows: CaptureRow[], tags: { home: string; away: string }) => void; onClose: () => void }) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [allScripts, setAllScripts] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(false)
  const [rows, setRows] = useState<CaptureRow[] | null>(null)
  const [detected, setDetected] = useState({ home: '', away: '' })

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    },
    [imageUrl],
  )

  const read = useCallback(
    async (image: File, scripts: boolean) => {
      setBusy(true)
      setError(false)
      setProgress(0)
      try {
        const { normal, inverted } = await readCaptureLines(image, scripts, setProgress)
        const reading = bestReading([parseCaptureLines(normal, tags), parseCaptureLines(inverted, tags)])
        // Con el equipo de cada jugador claro (por el tag o el color), la tabla se rellena sin más pasos
        if (reading.sidesFrom !== 'none' && reading.rows.some((r) => r.include && r.name.trim())) {
          setRows(null)
          onApply(reading.rows, reading.tags)
          return
        }
        setRows(reading.rows)
        setDetected(reading.tags)
      } catch {
        setRows(null)
        setError(true)
      } finally {
        setBusy(false)
      }
    },
    [tags, onApply],
  )

  const choose = useCallback(
    (image: File | null | undefined) => {
      if (!image || !image.type.startsWith('image/')) return
      setFile(image)
      setImageUrl(URL.createObjectURL(image))
      void read(image, allScripts)
    },
    [read, allScripts],
  )

  // Ctrl+V con una imagen en el portapapeles
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const image = item?.getAsFile()
      if (image) {
        e.preventDefault()
        choose(image)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [choose])

  const patchRow = (id: number, patch: Partial<CaptureRow>) => setRows((list) => list?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null)
  const addRow = () => setRows((list) => [...(list ?? []), { id: newPlayerId(), name: '', points: '', side: 'home' as Side, include: true, raw: '' }])
  const chosen = rows?.filter((r) => r.include && r.name.trim() !== '').length ?? 0

  return (
    <section className="panel space-y-4 p-4 sm:p-5" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]) }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-black text-kart-yellow uppercase">{t('cap.title')}</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted">{t('cap.hint')}</p>
        </div>
        <button type="button" className="btn-line text-sm" onClick={onClose}>
          {t('cap.close')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }} />
        <button type="button" className="btn-yellow text-base" disabled={busy} onClick={() => inputRef.current?.click()}>
          {t('cap.choose')}
        </button>
        <span className="text-xs text-muted">{t('cap.paste')}</span>
        <label className="flex items-center gap-2 text-sm" title={t('cap.scriptsHint')}>
          <input type="checkbox" checked={allScripts} disabled={busy} onChange={(e) => setAllScripts(e.target.checked)} />
          {t('cap.scripts')}
        </label>
        {file && rows !== null && !busy && (
          <button type="button" className="text-sm font-semibold text-kart-blue hover:underline" onClick={() => void read(file, allScripts)}>
            {t('cap.reread')}
          </button>
        )}
      </div>
      {allScripts && <p className="text-xs text-muted">{t('cap.scriptsHint')}</p>}

      {busy && (
        <div role="status" className="space-y-1">
          <p className="text-sm text-kart-yellow">{t('cap.reading')}</p>
          <div className="h-1.5 bg-line">
            <div className="h-full bg-kart-yellow transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-kart-red">{t('cap.error')}</p>}

      {rows !== null && !busy && (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            <p className="text-xs text-muted">{rows.length === 0 ? t('cap.none') : t('cap.sidesManual')}</p>
            {rows.length > 0 && (
              <>
                <div className="grid grid-cols-[2rem_7.5rem_1fr_5.5rem] gap-2 font-display text-xs font-extrabold tracking-wider text-kart-yellow uppercase">
                  <span>{t('cap.col.use')}</span>
                  <span>{t('cap.col.team')}</span>
                  <span>{t('cap.col.name')}</span>
                  <span>{t('cap.col.points')}</span>
                </div>
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <li key={r.id} className={`grid grid-cols-[2rem_7.5rem_1fr_5.5rem] items-center gap-2 ${r.include ? '' : 'opacity-50'}`} title={r.raw ? t('cap.rawTitle', { raw: r.raw }) : undefined}>
                      <input type="checkbox" checked={r.include} onChange={(e) => patchRow(r.id, { include: e.target.checked })} aria-label={t('cap.col.use')} />
                      <select className="field" value={r.side} onChange={(e) => patchRow(r.id, { side: e.target.value as Side })} aria-label={t('cap.col.team')}>
                        <option value="home">{t('free.team1')}</option>
                        <option value="away">{t('free.team2')}</option>
                      </select>
                      <input className="field" value={r.name} maxLength={40} onChange={(e) => patchRow(r.id, { name: e.target.value })} aria-label={t('cap.col.name')} />
                      <input className="field time" inputMode="numeric" value={r.points} maxLength={6} onChange={(e) => patchRow(r.id, { points: e.target.value })} aria-label={t('cap.col.points')} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-line text-sm" onClick={addRow}>
                {t('cap.addRow')}
              </button>
              {rows.length > 1 && (
                <button type="button" className="btn-line text-sm" onClick={() => setRows((list) => (list ? swapSides(list) : list))}>
                  {t('cap.swap')}
                </button>
              )}
              <button type="button" className="btn-yellow text-base" disabled={chosen === 0} onClick={() => onApply(rows, detected)}>
                {t('cap.apply')} ({chosen})
              </button>
            </div>
            <p className="text-xs text-muted">{t('cap.cleanNote')} {t('cap.applyHint')}</p>
          </div>
          {imageUrl && <img src={imageUrl} alt={t('cap.imageAlt')} className="max-h-[28rem] w-full self-start bg-bg object-contain" />}
        </div>
      )}
    </section>
  )
}
