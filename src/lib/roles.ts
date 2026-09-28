import type { MessageKey } from '../i18n/es'
import type { Role } from './auth'

/** Roles que se pueden asignar (el valor 'editor' antiguo ya no se usa: ahora son permisos). */
export const ASSIGNABLE_ROLES = ['user', 'moderator', 'admin'] as const
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export const ROLE_LABEL: Record<AssignableRole, MessageKey> = {
  user: 'role.user',
  moderator: 'role.moderator',
  admin: 'role.admin',
}

export const ROLE_DESCRIPTION: Record<AssignableRole, MessageKey> = {
  user: 'role.userDesc',
  moderator: 'role.moderatorDesc',
  admin: 'role.adminDesc',
}

/**
 * Estas reglas deben coincidir con set_user_role() y set_editor_permissions()
 * en la base de datos, que es quien realmente las hace cumplir.
 */
export function canChangeRole(actor: Role, isSelf: boolean): boolean {
  return actor === 'admin' && !isSelf
}

export function canEditPermissions(actor: Role, target: Role, isSelf: boolean): boolean {
  return (actor === 'admin' || actor === 'moderator') && target === 'user' && !isSelf
}
