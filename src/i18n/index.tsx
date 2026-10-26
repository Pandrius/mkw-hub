import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { en } from './en'
import { fr } from './fr'
import { ja } from './ja'
import { es, type MessageKey } from './es'
import { format } from './format'

/** Idiomas de la web; el inglés es el predeterminado */
// oxlint-disable-next-line react/only-export-components
export const LANGS = ['en', 'es', 'fr', 'ja'] as const
export type Lang = (typeof LANGS)[number]

const DICTS: Record<Lang, Record<MessageKey, string>> = { es, en, fr, ja }
const STORAGE_KEY = 'mkwhub.lang'

type I18n = {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Texto traducido, sustituyendo {variables} */
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  /** Locale para fechas y números (es-ES / en-GB / fr-FR / ja-JP) */
  locale: string
}

const I18nContext = createContext<I18n | null>(null)

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (LANGS.includes(saved as Lang)) return saved as Lang
  } catch {
    // almacenamiento no disponible
  }
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // almacenamiento no disponible
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => format(DICTS[lang][key], vars),
    [lang],
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t, locale: DICTS[lang]['meta.lang'] }}>{children}</I18nContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n debe usarse dentro de <I18nProvider>')
  return ctx
}
