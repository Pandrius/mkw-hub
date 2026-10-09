import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { EventPlayer } from '../lib/events'
import { bestResult, matchRaceLines, type OcrLine, type OcrPlayer, type OcrRaceResult } from '../lib/ocrRace'

/** Posiciones leídas: jugadores propios por id y rivales por nombre */
export type OcrFill = { home: Record<number, string>; away: Record<string, string> }

type State =
  | { step: 'idle' }
  | { step: 'reading'; progress: number }
  | { step: 'done'; result: OcrRaceResult; lines: OcrLine[]; total: number }
  | { step: 'error'; message: string }

/**
 * Lector de la pantalla de resultados de una carrera (beta).
 * Lee la captura en el navegador con Tesseract.js y rellena las posiciones; siempre hay que revisarlas.
 */
export default function OcrReader({
  players,
  opponents,
  onFill,
}: {
  players: EventPlayer[]
  opponents: string[]
  onFill: (fill: OcrFill) => void
}) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ step: 'idle' })

  const read = async (file: File) => {
    setState({ step: 'reading', progress: 0 })
    try {
      const { readImageLines } = await import('../lib/ocrImage')
      const passes = await readImageLines(file, (progress) => setState({ step: 'reading', progress }))
      const known: OcrPlayer[] = [
        ...players.map((p) => ({ key: `h:${p.id}`, name: p.name })),
        ...opponents.map((n) => ({ key: `a:${n}`, name: n })),
      ]
      const results = [passes.inverted, passes.normal].map((lines) => ({ lines, result: matchRaceLines(lines, known) }))
      const best = bestResult(results.map((r) => r.result))
      const lines = results.find((r) => r.result === best)!.lines

      const fill: OcrFill = { home: {}, away: {} }
      for (const m of best.matches) {
        if (m.key.startsWith('h:')) fill.home[Number(m.key.slice(2))] = String(m.position)
        else fill.away[m.key.slice(2)] = String(m.position)
      }
      onFill(fill)
      setState({ step: 'done', result: best, lines, total: known.length })
    } catch (err) {
      setState({ step: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const nameOf = (key: string) =>
    key.startsWith('h:') ? (players.find((p) => `h:${p.id}` === key)?.name ?? key) : key.slice(2)

  return (
    <div className="space-y-2 border-2 border-dashed border-line bg-bg/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={state.step === 'reading'}
          className="btn-line text-sm"
        >
          📷 {t('ocr.button')}
        </button>
        <span className="text-xs text-muted">{t('ocr.hint')}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) read(file)
          }}
        />
      </div>

      {state.step === 'reading' && (
        <p className="text-sm text-muted">
          {t('ocr.reading')} {Math.round(state.progress * 100)}%
        </p>
      )}

      {state.step === 'error' && <p className="text-sm text-kart-red">{t('ocr.error', { msg: state.message })}</p>}

      {state.step === 'done' && (
        <div className="space-y-1 text-sm">
          <p className="border-l-4 border-kart-yellow bg-surface px-3 py-2">
            <b>{t('ocr.result', { n: state.result.matches.length, total: state.total })}</b> {t('ocr.review')}
          </p>
          {state.result.unmatched.length > 0 && (
            <p className="text-xs text-muted">
              {t('ocr.unmatched')}: {state.result.unmatched.map(nameOf).join(', ')}
            </p>
          )}
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">{t('ocr.rawText')}</summary>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap bg-surface p-2">
              {state.lines.map((l) => l.text).join('\n') || '—'}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
