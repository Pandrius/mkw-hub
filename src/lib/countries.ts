/** Nombres de país en inglés que no coinciden con los estándar de Intl. */
const ALIASES: Record<string, string> = {
  usa: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  korea: 'KR',
  'south korea': 'KR',
  russia: 'RU',
  'czech republic': 'CZ',
  holland: 'NL',
}

let byName: Map<string, string> | null = null

function buildIndex(): Map<string, string> {
  const names = new Intl.DisplayNames(['en'], { type: 'region' })
  const map = new Map<string, string>(Object.entries(ALIASES))
  const A = 'A'.charCodeAt(0)
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j)
      try {
        // Ignora códigos obsoletos que apuntan a otro (DD → DE, YU → RS…): si no, "Germany" acabaría como DD
        if (Intl.getCanonicalLocales(`und-${code}`)[0] !== `und-${code}`) continue
        const name = names.of(code)
        if (name && name !== code && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), code)
      } catch {
        // código no válido
      }
    }
  }
  return map
}

/** "Spain" → "ES", "USA" → "US", "Unknown" → null */
export function countryCodeFromName(name: string | null | undefined): string | null {
  if (!name) return null
  byName ??= buildIndex()
  return byName.get(name.trim().toLowerCase()) ?? null
}

/** Nombre del país en el idioma indicado: ("ES", "es") → "España" */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Todos los países, ordenados por nombre en el idioma indicado */
export function allCountries(locale: string): { code: string; name: string }[] {
  const A = 'A'.charCodeAt(0)
  const out: { code: string; name: string }[] = []
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j)
      try {
        // Mismo filtro que buildIndex: fuera códigos obsoletos o sin asignar
        if (Intl.getCanonicalLocales(`und-${code}`)[0] !== `und-${code}`) continue
        const name = names.of(code)
        if (name && name !== code) out.push({ code, name })
      } catch {
        // código no válido
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, locale))
}
