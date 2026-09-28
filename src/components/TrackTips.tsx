import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { createTip, deleteTip, listTips, updateTip, youtubeId, type Tip, type TipInput, type TipKind } from '../lib/tips'
import { EmptyState } from './ui'

const COPY: Record<TipKind, { empty: string; emptyText: string; add: string }> = {
  time_trial: {
    empty: 'Todavía no hay guía de contrarreloj',
    emptyText: 'Strats, atajos y líneas de esta pista, con vídeos de ejemplo.',
    add: 'Añadir strat',
  },
  race: {
    empty: 'Todavía no hay guía de carreras',
    emptyText: 'Consejos de posicionamiento y de uso de items para carreras online.',
    add: 'Añadir consejo',
  },
}

export default function TrackTips({ trackId, kind }: { trackId: string; kind: TipKind }) {
  const { enabled, isEditor } = useAuth()
  const [tips, setTips] = useState<Tip[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  const reload = useCallback(
    () =>
      listTips(trackId, kind).then(
        (data) => {
          setTips(data)
          setError(null)
        },
        () => setError('No se han podido cargar los consejos.'),
      ),
    [trackId, kind],
  )

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    listTips(trackId, kind).then(
      (data) => !cancelled && setTips(data),
      () => !cancelled && setError('No se han podido cargar los consejos.'),
    )
    return () => {
      cancelled = true
    }
  }, [enabled, trackId, kind])

  const copy = COPY[kind]

  if (!enabled) return <EmptyState title={copy.empty}>{copy.emptyText}</EmptyState>
  if (error) return <p className="text-kart-red">{error}</p>
  if (!tips) return <p className="text-muted">Cargando…</p>

  const save = async (input: TipInput, id?: number) => {
    if (id) await updateTip(id, input)
    else await createTip(trackId, kind, input, tips.length)
    setEditing(null)
    await reload()
  }

  const remove = async (tip: Tip) => {
    if (!confirm(`¿Seguro que quieres borrar “${tip.title}”?`)) return
    await deleteTip(tip.id)
    await reload()
  }

  return (
    <div className="space-y-4">
      {isEditor && editing !== 'new' && (
        <button
          onClick={() => setEditing('new')}
          className="rounded-xl bg-kart-yellow px-4 py-2 text-sm font-bold text-bg hover:brightness-105"
        >
          + {copy.add}
        </button>
      )}
      {editing === 'new' && <TipForm onSave={(input) => save(input)} onCancel={() => setEditing(null)} />}

      {tips.length === 0 && editing !== 'new' && (
        <EmptyState title={copy.empty}>
          {copy.emptyText}
          {!isEditor && ' Solo los editores pueden añadirlos.'}
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
            canEdit={isEditor}
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
  const videoId = tip.video_url ? youtubeId(tip.video_url) : null

  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <header className="flex items-start gap-3">
        <span className="font-display text-2xl font-black italic leading-none text-kart-yellow">{index}</span>
        <h3 className="flex-1 font-display text-lg font-bold leading-tight">{tip.title}</h3>
        {canEdit && (
          <div className="flex gap-2 text-sm">
            <button onClick={onEdit} className="text-muted hover:text-ink">
              Editar
            </button>
            <button onClick={onDelete} className="text-muted hover:text-kart-red">
              Borrar
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
            Ver vídeo ↗
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
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [video, setVideo] = useState(initial?.video_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const videoUrl = video.trim() || null
    if (videoUrl && !videoUrl.startsWith('https://')) {
      setError('El enlace del vídeo debe empezar por https://')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ title: title.trim(), content: content.trim(), video_url: videoUrl })
    } catch {
      setError('No se ha podido guardar. ¿Sigues teniendo permisos de editor?')
      setSaving(false)
    }
  }

  const input =
    'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-kart-yellow'

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-kart-yellow/60 bg-surface p-5">
      <input
        required
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título (p. ej. «Atajo del segundo túnel»)"
        className={input}
      />
      <textarea
        maxLength={5000}
        rows={5}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Explicación de la strat o el consejo…"
        className={input}
      />
      <input
        type="url"
        value={video}
        onChange={(e) => setVideo(e.target.value)}
        placeholder="Enlace a vídeo de YouTube (opcional)"
        className={input}
      />
      {error && <p className="text-sm text-kart-red">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-kart-yellow px-4 py-2 text-sm font-bold text-bg hover:brightness-105 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold">
          Cancelar
        </button>
      </div>
    </form>
  )
}
