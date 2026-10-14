import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { hideGuide } from '../lib/guideStore'

const STEPS: { title: MessageKey; text: MessageKey; tip: MessageKey }[] = [
  { title: 'guide.s1.title', text: 'guide.s1.text', tip: 'guide.s1.tip' },
  { title: 'guide.s2.title', text: 'guide.s2.text', tip: 'guide.s2.tip' },
  { title: 'guide.s3.title', text: 'guide.s3.text', tip: 'guide.s3.tip' },
  { title: 'guide.s4.title', text: 'guide.s4.text', tip: 'guide.s4.tip' },
]

/** Ventana emergente que explica paso a paso cómo subir un evento (War o Lounge) al jugador sin eventos */
export function WelcomeGuide({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [dontShow, setDontShow] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  const close = () => {
    if (dontShow) hideGuide()
    onClose()
  }

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dontShow) hideGuide()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dontShow, onClose])

  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabIndex={-1}
        className="panel relative w-full max-w-lg overflow-hidden outline-none"
      >
        <div className="hazard h-1.5" />
        <div className="p-6">
          <p className="font-mono text-xs font-bold tracking-widest text-kart-yellow">
            {t('guide.kicker')} · {t('guide.step', { n: step + 1, total: STEPS.length })}
          </p>
          <h2 id="guide-title" className="mt-2 font-display text-3xl leading-none font-black">
            {t(s.title)}
          </h2>
          <p className="mt-3 text-ink/90">{t(s.text)}</p>
          <p className="mt-3 border-l-4 border-kart-yellow bg-surface-2 px-3 py-2 text-sm text-muted">{t(s.tip)}</p>

          <div className="mt-5 flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 ${i <= step ? 'bg-kart-yellow' : 'bg-line'}`} />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="size-4 accent-[var(--color-kart-yellow)]" />
              {t('guide.dontShow')}
            </label>
            <div className="flex gap-2">
              {step > 0 ? (
                <button type="button" onClick={() => setStep(step - 1)} className="btn-line text-base">
                  {t('guide.back')}
                </button>
              ) : (
                <button type="button" onClick={close} className="btn-line text-base">
                  {t('guide.close')}
                </button>
              )}
              {last ? (
                <button
                  type="button"
                  onClick={() => {
                    close()
                    navigate('/eventos/nuevo')
                  }}
                  className="btn-yellow text-base"
                >
                  {t('guide.create')}
                </button>
              ) : (
                <button type="button" onClick={() => setStep(step + 1)} className="btn-yellow text-base">
                  {t('guide.next')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
