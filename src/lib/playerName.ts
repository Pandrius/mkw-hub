/**
 * Nombres leídos de una captura: separa el tag de equipo del nombre y deja el nombre sin símbolos raros, solo con letras (de cualquier
 * alfabeto: latino con acentos, griego, cirílico, japonés, coreano, chino…), números, espacios y unos pocos separadores. Funciones puras.
 */

/** Longitud máxima de un nombre (el de Lounge y MKC es corto; esto solo frena la basura del OCR) */
export const MAX_NAME_LENGTH = 30
/** Longitud máxima de un tag de equipo (entre corchetes o con barra) */
export const MAX_TAG_LENGTH = 5
/** Y de un tag sin marcas, que solo se deduce de que se repite: más corto para no tomar por tag una palabra normal */
export const MAX_LOOSE_TAG_LENGTH = 4

/** Todo lo que no sea una letra, marca (acentos), número, espacio o un separador común (_ . ' ’ -) */
const NOT_ALLOWED = /[^\p{L}\p{M}\p{N} _.'’-]/gu
/** Grupos entre corchetes, paréntesis, llaves, ángulos o sus versiones de ancho completo y japonesas: suelen ser el tag */
const BRACKETED = /\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|<[^>]*>|［[^］]*］|（[^）]*）|【[^】]*】/gu
/** Tag con el cierre pero sin la apertura, o al revés (el OCR se come un corchete): «NEB] Ana», «Ana [NEB» (el tag va en el grupo 1) */
const HALF_LEADING = /^[^\p{L}\p{N}]*([\p{L}\p{N}]{2,6})\s*[\])}>】）］]\s*/u
const HALF_TRAILING = /\s*[[({<【（［]\s*([\p{L}\p{N}]{2,6})[^\p{L}\p{N}]*$/u
/** Tag separado del nombre con una barra o dos puntos: «NEB | Ana», «Ana | NEB» */
const PIPE_LEADING = /^[^\p{L}\p{N}]*([\p{L}\p{N}]{2,6})\s*[|｜:：»›]\s*/u
const PIPE_TRAILING = /\s*[|｜:：«‹]\s*([\p{L}\p{N}]{2,6})[^\p{L}\p{N}]*$/u

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

/** Texto sin símbolos raros pero con todo lo demás (también el tag), para quien analiza el tag aparte */
export const tidyName = (raw: string): string => tidy(raw.normalize('NFKC'))

/** Solo letras y números: la forma de un tag */
const tagOf = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '').slice(0, MAX_TAG_LENGTH + 1)

/** Expresiones de un tag conocido como palabra entera al principio o al final (el tag NEB no se toma de «Nebula») */
const knownTagRegexes = (tag: string) => {
  const t = escapeRegex(tag)
  return {
    leading: new RegExp(`^[^\\p{L}\\p{N}]*${t}(?![\\p{L}\\p{N}])[^\\p{L}\\p{N}]*`, 'iu'),
    trailing: new RegExp(`(?<![\\p{L}\\p{N}])${t}[^\\p{L}\\p{N}]*$`, 'iu'),
  }
}

/**
 * El tag de equipo que lleva escrito un nombre, si lo hay: entre corchetes, paréntesis o llaves («[NEB] Ana», «Ana (NEB)»),
 * separado con una barra («NEB | Ana») o uno de los tags `known` ya conocidos pegado al principio o al final. null si no lleva.
 */
export function extractTag(raw: string, known: string[] = []): string | null {
  const s = raw.normalize('NFKC')
  const bracket = s.match(BRACKETED)?.[0]
  if (bracket) {
    const inner = tagOf(bracket.slice(1, -1))
    if (inner.length >= 1 && inner.length <= MAX_TAG_LENGTH) return inner
  }
  for (const re of [HALF_LEADING, HALF_TRAILING, PIPE_LEADING, PIPE_TRAILING]) {
    const tag = s.match(re)?.[1]
    if (tag) return tag
  }
  for (const k of known.map((t) => t.trim()).filter(Boolean)) {
    const { leading, trailing } = knownTagRegexes(k)
    if (leading.test(s) || trailing.test(s)) return k
  }
  return null
}

/**
 * Nombre de jugador limpio: sin el tag (entre corchetes, con barra o uno de los `tags` conocidos) y sin símbolos raros. Si al limpiar
 * no queda nada, se devuelve lo que haya dentro de los corchetes antes que una cadena vacía.
 */
export function cleanPlayerName(raw: string, tags: string[] = []): string {
  const original = raw.normalize('NFKC')
  let s = original.replace(BRACKETED, ' ')
  s = s.replace(HALF_LEADING, '').replace(HALF_TRAILING, '').replace(PIPE_LEADING, '').replace(PIPE_TRAILING, '')

  for (const tag of tags.map((t) => t.trim()).filter(Boolean)) {
    const { leading, trailing } = knownTagRegexes(tag)
    s = s.replace(leading, '').replace(trailing, '')
  }

  const cleaned = tidy(s)
  if (cleaned) return cleaned
  // Nada fuera de los corchetes: el nombre estaba dentro («[Ana]»)
  return tidy(original)
}

/**
 * Tags sin corchetes que repiten varios jugadores («NEB Ana», «NEB Beto», «RKL Carla»…): una palabra corta al principio (o al final)
 * de varios nombres es el tag de su equipo. Devuelve el tag de cada nombre (null si no lleva) y el nombre sin él. Hace falta que lo
 * compartan al menos dos nombres, que no se quede ningún nombre vacío y se toman como mucho dos tags (los dos equipos).
 */
export function splitSharedTags(names: string[]): { tags: (string | null)[]; names: string[] } {
  const none = { tags: names.map(() => null), names }
  const words = names.map((n) => n.split(' '))
  let best: { tags: (string | null)[]; names: string[]; tagged: number } | null = null

  for (const edge of ['first', 'last'] as const) {
    const pick = (w: string[]) => (edge === 'first' ? w[0] : w[w.length - 1])
    const counts = new Map<string, number>()
    for (const w of words) if (w.length > 1 && pick(w).length <= MAX_LOOSE_TAG_LENGTH) counts.set(pick(w).toLowerCase(), (counts.get(pick(w).toLowerCase()) ?? 0) + 1)
    const chosen = new Set([...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([tag]) => tag))
    if (chosen.size === 0) continue
    const tags = words.map((w) => (w.length > 1 && chosen.has(pick(w).toLowerCase()) ? pick(w) : null))
    const stripped = words.map((w, i) => (tags[i] === null ? w.join(' ') : (edge === 'first' ? w.slice(1) : w.slice(0, -1)).join(' ')))
    const tagged = tags.filter((t) => t !== null).length
    if (tagged > (best?.tagged ?? 0)) best = { tags, names: stripped, tagged }
  }
  return best ? { tags: best.tags, names: best.names } : none
}
