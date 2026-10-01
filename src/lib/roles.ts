import type { MessageKey } from '../i18n/es'
import type { Role } from './auth'

/** Roles base en base de datos */
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

/** Roles completos que se pueden asignar en la interfaz (incluyendo editores específicos) */
export const FULL_ROLES = [
  'user',
  'tt_editor',
  'strat_editor',
  'all_editor',
  'moderator',
  'admin',
] as const

export type FullRole = (typeof FULL_ROLES)[number]

export const FULL_ROLE_LABEL: Record<FullRole, MessageKey> = {
  user: 'role.user',
  tt_editor: 'role.ttEditor',
  strat_editor: 'role.stratEditor',
  all_editor: 'role.allEditor',
  moderator: 'role.moderator',
  admin: 'role.admin',
}

export const FULL_ROLE_DESCRIPTION: Record<FullRole, MessageKey> = {
  user: 'role.userDesc',
  tt_editor: 'role.ttEditorDesc',
  strat_editor: 'role.stratEditorDesc',
  all_editor: 'role.allEditorDesc',
  moderator: 'role.moderatorDesc',
  admin: 'role.adminDesc',
}

export function getUserFullRole(profile: { role: Role; tt_editor: boolean; strat_editor: boolean }): FullRole {
  if (profile.role === 'admin') return 'admin'
  if (profile.role === 'moderator') return 'moderator'
  if (profile.tt_editor && profile.strat_editor) return 'all_editor'
  if (profile.tt_editor) return 'tt_editor'
  if (profile.strat_editor) return 'strat_editor'
  return 'user'
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

/** Comprueba si un usuario puede asignar un rol completo específico a otro usuario */
export function canAssignFullRole(actor: Role, targetRole: Role, option: FullRole, isSelf: boolean): boolean {
  if (isSelf) return false
  if (actor === 'admin') return true
  if (actor === 'moderator') {
    if (targetRole !== 'user') return false
    return option === 'user' || option === 'tt_editor' || option === 'strat_editor' || option === 'all_editor'
  }
  return false
}
