import { describe, expect, it } from 'vitest'
import { canChangeRole, canEditPermissions } from './roles'

describe('canChangeRole', () => {
  it('solo el admin, y nunca sobre sí mismo', () => {
    expect(canChangeRole('admin', false)).toBe(true)
    expect(canChangeRole('admin', true)).toBe(false)
    expect(canChangeRole('moderator', false)).toBe(false)
    expect(canChangeRole('user', false)).toBe(false)
  })
})

describe('canEditPermissions', () => {
  it('moderadores y admins sobre usuarios normales', () => {
    expect(canEditPermissions('moderator', 'user', false)).toBe(true)
    expect(canEditPermissions('admin', 'user', false)).toBe(true)
  })

  it('no sobre moderadores o admins (ya tienen todos los permisos)', () => {
    expect(canEditPermissions('admin', 'moderator', false)).toBe(false)
    expect(canEditPermissions('moderator', 'admin', false)).toBe(false)
  })

  it('ni sobre uno mismo, ni por parte de usuarios', () => {
    expect(canEditPermissions('moderator', 'user', true)).toBe(false)
    expect(canEditPermissions('user', 'user', false)).toBe(false)
  })
})
