/** Idiomas con ordinal propio (los mismos de la web) */
export type OrdinalLang = 'es' | 'en' | 'fr' | 'ja'

/** Posición escrita como ordinal en cada idioma: 1º, 1st, 1er / 2e, 1位 */
export function ordinal(n: number, lang: OrdinalLang): string {
  switch (lang) {
    case 'es':
      return `${n}º`
    case 'fr':
      return n === 1 ? '1er' : `${n}e`
    case 'ja':
      return `${n}位`
    default: {
      const teen = n % 100 >= 11 && n % 100 <= 13
      return `${n}${teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`
    }
  }
}
