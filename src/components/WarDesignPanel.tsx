import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import {
  DEFAULT_DESIGN,
  EDITABLE_COLORS,
  fitWithin,
  MAX_DIM,
  MAX_PHOTO_CHARS,
  PRESET_IDS,
  PRESET_STYLE,
  PRESETS,
  resolvePalette,
  type EditableColor,
  type WarDesign,
} from '../lib/warDesign'
import { useWarDesign } from './useWarDesign'

const PHOTO_MAX_SIDE = 1600

/** Foto elegida → JPEG reducido en data URL (cabe en el almacenamiento del navegador y pesa poco al dibujar) */
async function readPhoto(file: File): Promise<string> {
  const source = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('imagen no válida'))
      el.src = source
    })
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, PHOTO_MAX_SIDE)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas no disponible')
    ctx.drawImage(img, 0, 0, width, height)
    // Baja la calidad hasta que quepa en el límite
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= MAX_PHOTO_CHARS) return dataUrl
    }
    throw new Error('imagen demasiado grande')
  } finally {
    URL.revokeObjectURL(source)
  }
}

const COLOR_LABEL: Record<EditableColor, MessageKey> = {
  accent: 'design.color.accent',
  bg: 'design.color.bg',
  surface: 'design.color.surface',
  ink: 'design.color.ink',
}

/** Editor del diseño de las tablas: estilo, foto de fondo y colores propios (se guarda en este navegador) */
export default function WarDesignPanel() {
  const { t } = useI18n()
  const [design, setDesign] = useWarDesign()
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const palette = resolvePalette(design)
  // El diseño elegante no lleva franjas de peligro
  const hasStripes = PRESET_STYLE[design.preset] === 'standard'
  const change = (patch: Partial<WarDesign>) => setDesign({ ...design, ...patch })

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      change({ photo: { dataUrl: await readPhoto(file), dim: design.photo?.dim ?? 0.55 } })
    } catch {
      setError(t('design.photoError'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const section = 'font-mono text-xs font-bold uppercase tracking-wider text-muted'

  return (
    <div className="space-y-5 border-b border-line bg-surface p-4 sm:p-5">
      <div>
        <p className={section}>{t('design.presets')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_IDS.map((id) => {
            const p = PRESETS[id]
            const active = design.preset === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => change({ preset: id, colors: {} })}
                className={`flex min-h-11 items-center gap-2 border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active ? 'border-kart-yellow bg-kart-yellow/10' : 'border-line hover:border-muted'
                }`}
                aria-pressed={active}
              >
                <span className="flex" aria-hidden="true">
                  {[p.bg, p.surface2, p.accent, p.ink].map((c, i) => (
                    <span key={i} className="size-4 border border-line" style={{ background: c }} />
                  ))}
                </span>
                {t(`design.preset.${id}` as MessageKey)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className={section}>{t('design.photo')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-line min-h-11 text-sm">
            {design.photo ? t('design.photoChange') : t('design.photoAdd')}
          </button>
          {design.photo && (
            <>
              <button type="button" onClick={() => change({ photo: null })} className="min-h-11 text-sm text-muted hover:text-kart-red">
                {t('design.photoRemove')}
              </button>
              <label className="flex min-w-48 flex-1 items-center gap-3 text-sm">
                <span className="text-muted">{t('design.dim')}</span>
                <input
                  type="range"
                  min={0}
                  max={Math.round(MAX_DIM * 100)}
                  step={5}
                  value={Math.round(design.photo.dim * 100)}
                  onChange={(e) => design.photo && change({ photo: { ...design.photo, dim: Number(e.target.value) / 100 } })}
                  className="flex-1 accent-kart-yellow"
                />
                <span className="w-10 text-right font-mono text-xs">{Math.round(design.photo.dim * 100)}%</span>
              </label>
            </>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">{t('design.photoHint')}</p>
        {error && <p className="mt-1 text-sm text-kart-red">{error}</p>}
      </div>

      <div>
        <p className={section}>{t('design.colors')}</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {EDITABLE_COLORS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="color"
                value={palette[key]}
                onChange={(e) => change({ colors: { ...design.colors, [key]: e.target.value } })}
                className="size-9 cursor-pointer border-2 border-line bg-transparent p-0.5"
              />
              {t(COLOR_LABEL[key])}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {hasStripes ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={design.stripes}
              onChange={(e) => change({ stripes: e.target.checked })}
              className="size-4 accent-kart-yellow"
            />
            {t('design.stripes')}
          </label>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => setDesign(DEFAULT_DESIGN)} className="min-h-11 text-sm text-muted hover:text-kart-red">
          {t('design.reset')}
        </button>
      </div>
    </div>
  )
}
