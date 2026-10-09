import { useState } from 'react'
import { useI18n } from '../i18n'

/** Nombre de un jugador con un lápiz a la derecha (solo si se puede editar) para corregirlo en el sitio */
export default function EditableName({
  name,
  canEdit,
  onSave,
  maxLength = 80,
}: {
  name: string
  canEdit: boolean
  /** Guarda el nombre nuevo; si lanza un error se muestra en la página y el campo se queda abierto */
  onSave: (value: string) => Promise<void>
  maxLength?: number
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)

  if (!canEdit) return <>{name}</>

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {name}
        <button
          type="button"
          onClick={() => {
            setValue(name)
            setEditing(true)
          }}
          className="text-muted hover:text-kart-yellow"
          aria-label={`${t('event.editName')}: ${name}`}
          title={t('event.editName')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </span>
    )
  }

  const clean = value.trim()
  const save = async () => {
    if (!clean || clean === name) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await onSave(clean)
      setEditing(false)
    } catch {
      // el error lo muestra la página; se deja el campo abierto para corregirlo
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        maxLength={maxLength}
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void save()
          } else if (e.key === 'Escape') setEditing(false)
        }}
        title={t('event.renameHint')}
        className="field w-40 py-0.5 text-sm"
      />
      <button type="button" onClick={() => void save()} disabled={busy} className="text-kart-green hover:opacity-80" aria-label={t('common.save')} title={t('common.save')}>
        ✓
      </button>
      <button type="button" onClick={() => setEditing(false)} disabled={busy} className="text-muted hover:text-kart-red" aria-label={t('common.cancel')} title={t('common.cancel')}>
        ✕
      </button>
    </span>
  )
}
