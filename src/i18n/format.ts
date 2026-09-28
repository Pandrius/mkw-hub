/** Sustituye {variables} en un texto. Las que no se pasan se dejan tal cual. */
export function format(template: string, vars?: Record<string, string | number>): string {
  return vars ? template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : template
}
