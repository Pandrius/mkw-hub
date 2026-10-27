/**
 * Limpieza de los nombres leídos de una captura: sin tag de equipo y sin símbolos raros, solo con letras (de cualquier alfabeto:
 * latino con acentos, griego, cirílico, japonés, coreano, chino…), números, espacios y unos pocos separadores. Función pura.
 */

/** Longitud máxima de un nombre (el de Lounge y MKC es corto; esto solo frena la basura del OCR) */
export const MAX_NAME_LENGTH = 30

/** Todo lo que no sea una letra, marca (acentos), número, espacio o un separador común (_ . ' ’ -) */
const NOT_ALLOWED = /[^\p{L}\p{M}\p{N} _.'’-]/gu
/** Grupos entre corchetes, paréntesis, llaves, ángulos o sus versiones de ancho completo y japonesas: suelen ser el tag */
const BRACKETED = /\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|<[^>]*>|［[^］]*］|（[^）]*）|【[^】]*】/gu
/** Tag con el cierre pero sin la apertura, o al revés (el OCR se come un corchete): «NEB] Ana», «Ana [NEB» */
const HALF_LEADING = /^[^\p{L}\p{N}]*[\p{L}\p{N}]{2,6}\s*[\])}>】）］]\s*/u
const HALF_TRAILING = /\s*[[({<【（［]\s*[\p{L}\p{N}]{2,6}[^\p{L}\p{N}]*$/u
/** Tag separado del nombre con una barra o dos puntos: «NEB | Ana», «Ana | NEB» */
const PIPE_LEADING = /^[^\p{L}\p{N}]*[\p{L}\p{N}]{2,6}\s*[|｜:：»›]\s*/u
const PIPE_TRAILING = /\s*[|｜:：«‹]\s*[\p{L}\p{N}]{2,6}[^\p{L}\p{N}]*$/u

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Espacio entre dos caracteres japoneses o chinos: el OCR los mete entre las letras («た ろう», «山田 太郎») */
const CJK_GAP = /(?<=[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]) (?=[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー])/gu

/** Quita los símbolos no permitidos, junta espacios y recorta los separadores de las puntas */
function tidy(s: string): string {
  return s
    .replace(NOT_ALLOWED, ' ')
    .replace(/\s+/g, ' ')
    .replace(CJK_GAP, '')
    .replace(/^[\s_.'’-]+|[\s_.'’-]+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .trim()
}

/**
 * Nombre de jugador limpio. `tags` son los tags de equipo ya conocidos (se quitan si van pegados al principio o al final, como
 * palabra suelta). Si al limpiar no queda nada, se devuelve lo que haya dentro de los corchetes antes que una cadena vacía.
 */
export function cleanPlayerName(raw: string, tags: string[] = []): string {
  const original = raw.normalize('NFKC')
  let s = original.replace(BRACKETED, ' ')
  s = s.replace(HALF_LEADING, '').replace(HALF_TRAILING, '').replace(PIPE_LEADING, '').replace(PIPE_TRAILING, '')

  for (const tag of tags.map((t) => t.trim()).filter(Boolean)) {
    const t = escapeRegex(tag)
    // Solo como palabra entera: el tag NEB no se quita de «Nebula»
    s = s.replace(new RegExp(`^[^\\p{L}\\p{N}]*${t}(?![\\p{L}\\p{N}])[^\\p{L}\\p{N}]*`, 'iu'), '').replace(new RegExp(`(?<![\\p{L}\\p{N}])${t}[^\\p{L}\\p{N}]*$`, 'iu'), '')
  }

  const cleaned = tidy(s)
  if (cleaned) return cleaned
  // Nada fuera de los corchetes: el nombre estaba dentro («[Ana]»)
  return tidy(original)
}

/**
 * Tag de equipo sin corchetes que se repite en varios jugadores del mismo equipo («NEB Ana», «NEB Beto»): se quita de todos. Solo si
 * lo comparten al menos dos y la mitad de los nombres, y si a ningún nombre se le queda vacío.
 */
export function stripSharedTag(names: string[]): string[] {
  if (names.length < 2) return names
  const words = names.map((n) => n.split(' '))
  const needed = Math.max(2, Math.ceil(names.length / 2))
  for (const edge of ['first', 'last'] as const) {
    const pick = (w: string[]) => (edge === 'first' ? w[0] : w[w.length - 1])
    const counts = new Map<string, number>()
    for (const w of words) if (w.length > 1) counts.set(pick(w).toLowerCase(), (counts.get(pick(w).toLowerCase()) ?? 0) + 1)
    const [tag, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
    // Un tag es corto (hasta 4); una palabra repetida más larga puede ser parte real del nombre
    if (tag && n >= needed && tag.length <= 4) {
      return words.map((w) => (w.length > 1 && pick(w).toLowerCase() === tag ? (edge === 'first' ? w.slice(1) : w.slice(0, -1)).join(' ') : w.join(' ')))
    }
  }
  return names
}
