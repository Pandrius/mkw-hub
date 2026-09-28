import type { Role } from './auth'

export const ROLE_LABELS: Record<Role, string> = {
  user: 'Usuario',
  editor: 'Editor',
  moderator: 'Moderador',
  admin: 'Admin',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  user: 'Registra sus propias carreras',
  editor: 'Guías, strats y tiempos de contrarreloj',
  moderator: 'Editor que además puede dar y quitar el rol de editor',
  admin: 'Control total',
}

/**
 * Roles que `actor` puede asignar a un usuario con rol `target`.
 * Debe coincidir con las reglas de set_user_role() en la base de datos,
 * que es quien realmente las hace cumplir.
 */
export function assignableRoles(actor: Role, target: Role, isSelf: boolean): Role[] {
  if (isSelf) return []
  if (actor === 'admin') return ['user', 'editor', 'moderator', 'admin']
  if (actor === 'moderator' && (target === 'user' || target === 'editor')) return ['user', 'editor']
  return []
}
