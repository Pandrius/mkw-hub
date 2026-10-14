/*
 * Recuerda en este navegador que el jugador ya no quiere ver la guía de bienvenida.
 * Si no hay almacenamiento disponible, la guía vuelve a salir cada vez (no rompe nada).
 */

const KEY = 'mkwhub.welcomeGuideHidden'

export function isGuideHidden(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function hideGuide(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // almacenamiento lleno o no disponible
  }
}
