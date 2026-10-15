import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { EventDetail } from '../lib/events'
import { expectedPoints, type ProofReading } from '../lib/proofCheck'
import { isVerified } from '../lib/verify'
import { proofImageUrl, readProofImage, reviewWarProof, submitWarProof } from '../lib/warProof'

type Draft = { file: File; reading: ProofReading; auto: boolean }

/** Tabla de lo que se lee en la captura frente a lo que dice la war */
function ReadingTable({ reading }: { reading: ProofReading }) {
  const { t } = useI18n()
  return (
    <table className="w-full max-w-md text-sm">
      <thead className="text-left font-mono text-[11px] text-muted uppercase">
        <tr>
          <th className="py-1 pr-3">{t('proof.player')}</th>
          <th className="py-1 pr-3 text-right">{t('proof.inWar')}</th>
          <th className="py-1 text-right">{t('proof.inPhoto')}</th>
        </tr>
      </thead>
      <tbody>
        {reading.rows.map((r) => (
          <tr key={r.name} className="border-t border-line/60">
            <td className="py-1 pr-3">{r.name}</td>
            <td className="py-1 pr-3 text-right font-mono">{r.expected}</td>
            <td className={`py-1 text-right font-mono font-bold ${r.read === null ? 'text-muted' : r.read === r.expected ? 'text-kart-green' : 'text-kart-red'}`}>{r.read ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** ¿Es un objeto con la forma de una lectura guardada? (viene de un jsonb) */
function asReading(raw: unknown): ProofReading | null {
  const r = raw as ProofReading | null
  return r && Array.isArray(r.rows) && typeof r.read === 'number' ? r : null
}

/**
 * Verificación de una war con la captura de la sala final. Quien jugó la sube; el navegador compara los puntos y, si coinciden,
 * cuenta como verificada hasta que un revisor la confirme; si no, espera a que un revisor la apruebe.
 */
export default function WarProofPanel({ detail, canSubmit, canReview, onChanged }: { detail: EventDetail; canSubmit: boolean; canReview: boolean; onChanged: () => Promise<void> }) {
  const { t } = useI18n()
  const { event, players, races } = detail
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'reading' | 'sending' | 'reviewing' | null>(null)
  const [progress, setProgress] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const status = event.proof_status ?? null
  const reviewing = canReview && (status === 'auto' || status === 'pending')
  const path = event.proof_path
  const ownPlayers = expectedPoints(players, races)

  // El revisor y quien la subió ven la captura enviada
  useEffect(() => {
    if (!path || !(reviewing || canSubmit)) return
    let cancelled = false
    proofImageUrl(path).then(
      (url) => !cancelled && setImageUrl(url),
      () => !cancelled && setImageUrl(null),
    )
    return () => {
      cancelled = true
    }
  }, [path, reviewing, canSubmit])

  const verifiedOtherWay = isVerified({ ...event, proof_status: null })
  const canUpload = canSubmit && !verifiedOtherWay && (status === null || status === 'rejected')
  if (!canUpload && !status && !reviewing) return null

  const fail = (err: unknown) => setError(err instanceof Error ? err.message : t('common.saveError'))

  const read = async (file: File) => {
    setError(null)
    setBusy('reading')
    setProgress(0)
    try {
      setDraft({ file, ...(await readProofImage(file, ownPlayers, setProgress)) })
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const send = async () => {
    if (!draft) return
    setError(null)
    setBusy('sending')
    try {
      await submitWarProof(event.id, draft.file, draft.reading, draft.auto)
      setDraft(null)
      await onChanged()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const review = async (approve: boolean) => {
    if (!approve && !confirm(t('proof.confirmReject'))) return
    setError(null)
    setBusy('reviewing')
    try {
      await reviewWarProof(event.id, approve)
      await onChanged()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const saved = asReading(event.proof_reading)

  return (
    <section className="panel space-y-3 p-4">
      <h2 className="font-display text-xl font-bold">{t('proof.title')}</h2>

      {status && (
        <p className={`border-l-4 px-3 py-2 text-sm ${status === 'rejected' ? 'border-kart-red bg-kart-red/10' : status === 'pending' ? 'border-kart-yellow bg-surface' : 'border-kart-green bg-kart-green/10'}`}>
          {t(`proof.status.${status}` as 'proof.status.auto')}
        </p>
      )}

      {reviewing && (
        <div className="space-y-3">
          <p className="text-xs text-muted">{t('proof.reviewHint')}</p>
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noreferrer">
              <img src={imageUrl} alt={t('proof.title')} className="max-h-[32rem] max-w-full border border-line" />
            </a>
          )}
          {saved && <ReadingTable reading={saved} />}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-yellow text-sm" disabled={busy !== null} onClick={() => review(true)}>
              {t('proof.approve')}
            </button>
            <button type="button" className="btn-line text-sm" disabled={busy !== null} onClick={() => review(false)}>
              {t('proof.reject')}
            </button>
          </div>
        </div>
      )}

      {!reviewing && imageUrl && status && (
        <a href={imageUrl} target="_blank" rel="noreferrer" className="inline-block font-mono text-xs font-bold text-kart-yellow hover:underline">
          {t('event.openImage')}
        </a>
      )}

      {canUpload && (
        <div className="space-y-3">
          <p className="text-xs text-muted">{t('proof.hint')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-line text-sm" disabled={busy !== null || ownPlayers.length === 0} onClick={() => inputRef.current?.click()}>
              📷 {t('proof.pick')}
            </button>
            {busy === 'reading' && (
              <span className="text-sm text-muted">
                {t('ocr.reading')} {Math.round(progress * 100)}%
              </span>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void read(file)
              }}
            />
          </div>
          {draft && (
            <div className="space-y-3">
              <p className={`border-l-4 px-3 py-2 text-sm ${draft.auto ? 'border-kart-green bg-kart-green/10' : 'border-kart-yellow bg-surface'}`}>
                {draft.auto ? t('proof.readOk') : t('proof.readDoubt')}
              </p>
              <ReadingTable reading={draft.reading} />
              <button type="button" className="btn-yellow text-sm" disabled={busy !== null} onClick={send}>
                {busy === 'sending' ? t('proof.sending') : draft.auto ? t('proof.sendAuto') : t('proof.sendReview')}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-kart-red">{error}</p>}
    </section>
  )
}
