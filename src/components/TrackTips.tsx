import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { useAuth } from '../lib/auth'
import { createTip, deleteTip, listTips, updateTip, youtubeId, type Tip, type TipInput, type TipKind } from '../lib/tips'
import { EmptyState } from './ui'

const COPY: Record<TipKind, { empty: MessageKey; emptyText: MessageKey; add: MessageKey }> = {
  time_trial: { empty: 'tips.ttEmpty', emptyText: 'tips.ttEmptyText', add: 'tips.ttAdd' },
  race: { empty: 'tips.raceEmpty', emptyText: 'tips.raceEmptyText', add: 'tips.raceAdd' },
}

export default function TrackTips({ trackId, kind }: { trackId: string; kind: TipKind }) {
  const { t } = useI18n()
  const { enabled, isStratEditor } = useAuth()
  const [tips, setTips] = useState<Tip[] | null>(null)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  const reload = useCallback(
    () =>
      listTips(trackId, kind).then(
        (data) => {
          setTips(data)
          setError(false)
        },
        () => setError(true),
      ),
    [trackId, kind],
  )

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    listTips(trackId, kind).then(
      (data) => !cancelled && setTips(data),
      () => !cancelled && setError(true),
    )
    return () => {
      cancelled = true
    }
  }, [enabled, trackId, kind])

  const copy = COPY[kind]

  if (!enabled) return <EmptyState title={t(copy.empty)}>{t(copy.emptyText)}</EmptyState>
  if (error) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (!tips) return <p className="text-muted">{t('common.loading')}</p>

  const save = async (input: TipInput, id?: number) => {
    if (id) await updateTip(id, input)
    else await createTip(trackId, kind, input, tips.length)
    setEditing(null)
    await reload()
  }

  const remove = async (tip: Tip) => {
    if (!confirm(t('tips.confirmDelete', { title: tip.title }))) return
    await deleteTip(tip.id)
    await reload()
  }

  return (
    <div className="space-y-4">
      {isStratEditor && editing !== 'new' && (
        <button
          onClick={() => setEditing('new')}
          className="btn-yellow text-base"
        >
          + {t(copy.add)}
        </button>
      )}
      {editing === 'new' && <TipForm onSave={(input) => save(input)} onCancel={() => setEditing(null)} />}

      {tips.length === 0 && editing !== 'new' && (
        <EmptyState title={t(copy.empty)}>
          {t(copy.emptyText)}
          {!isStratEditor && ` ${t('tips.onlyEditors')}`}
        </EmptyState>
      )}

      {tips.map((tip, i) =>
        editing === tip.id ? (
          <TipForm key={tip.id} initial={tip} onSave={(input) => save(input, tip.id)} onCancel={() => setEditing(null)} />
        ) : (
          <TipCard
            key={tip.id}
            tip={tip}
            index={i + 1}
            canEdit={isStratEditor}
            onEdit={() => setEditing(tip.id)}
            onDelete={() => remove(tip)}
          />
        ),
      )}
    </div>
  )
}

function TipCard({
  tip,
  index,
  canEdit,
  onEdit,
  onDelete,
}: {
  tip: Tip
  index: number
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const videoId = tip.video_url ? youtubeId(tip.video_url) : null

  return (
    <article className="panel p-5">
      <header className="flex items-start gap-3">
        <span className="font-display text-2xl font-black leading-none text-kart-yellow">{index}</span>
        <h3 className="flex-1 font-display text-lg font-bold leading-tight">{tip.title}</h3>
        {canEdit && (
          <div className="flex gap-2 text-sm">
            <button onClick={onEdit} className="text-muted hover:text-ink">
              {t('common.edit')}
            </button>
            <button onClick={onDelete} className="text-muted hover:text-kart-red">
              {t('common.delete')}
            </button>
          </div>
        )}
      </header>
      {tip.content && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/90">{tip.content}</p>}
      {videoId ? (
        <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-line">
          <iframe
            className="size-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title={tip.title}
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : (
        tip.video_url && (
          <a href={tip.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-kart-blue hover:underline">
            {t('common.watchVideo')}
          </a>
        )
      )}
    </article>
  )
}

function TipForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Tip
  onSave: (input: TipInput) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [video, setVideo] = useState(initial?.video_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const videoUrl = video.trim() || null
    if (videoUrl && !videoUrl.startsWith('https://')) {
      setError(t('tips.videoHttps'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ title: title.trim(), content: content.trim(), video_url: videoUrl })
    } catch {
      setError(t('common.saveError'))
      setSaving(false)
    }
  }

  const input =
    'field'

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-kart-yellow/60 bg-surface p-5">
      <input
        required
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('tips.titlePlaceholder')}
        className={input}
      />
      <textarea
        maxLength={5000}
        rows={5}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('tips.contentPlaceholder')}
        className={input}
      />
      <input type="url" value={video} onChange={(e) => setVideo(e.target.value)} placeholder={t('tips.videoPlaceholder')} className={input} />
      {error && <p className="text-sm text-kart-red">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="btn-yellow text-base"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
        <button type="button" onClick={onCancel} className="btn-line text-base">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
