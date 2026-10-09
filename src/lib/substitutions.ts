/**
 * Sustitución en una war: desde la carrera `race_no` entra `in` en lugar de `out`.
 * Quien sale juega hasta la carrera anterior; quien entra, desde esa.
 */
export type Substitution = {
  side: 'home' | 'away'
  out: string
  in: string
  race_no: number
}

export const MAX_SUBSTITUTIONS = 24

/** Los jsonb se descartan si no tienen la forma esperada, para no romper la página */
export function parseSubstitutions(raw: unknown): Substitution[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (x): x is Substitution =>
        !!x &&
        (x.side === 'home' || x.side === 'away') &&
        typeof x.out === 'string' &&
        typeof x.in === 'string' &&
        Number.isInteger(x.race_no) &&
        x.race_no >= 1 &&
        x.race_no <= 12,
    )
    .slice(0, MAX_SUBSTITUTIONS)
}

/** ¿Corre este jugador en la carrera `raceNo`? Los que no aparecen en ninguna sustitución corren siempre */
export function isActiveInRace(name: string, side: Substitution['side'], subs: Substitution[], raceNo: number): boolean {
  const joined = subs.find((s) => s.side === side && s.in === name)
  if (joined && joined.race_no > raceNo) return false
  const left = subs.find((s) => s.side === side && s.out === name)
  return !(left && left.race_no <= raceNo)
}

/** Nombres que corren en la carrera `raceNo`, en el mismo orden */
export function activeNames(names: string[], side: Substitution['side'], subs: Substitution[], raceNo: number): string[] {
  return names.filter((n) => isActiveInRace(n, side, subs, raceNo))
}
