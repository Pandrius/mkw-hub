import { describe, expect, it } from 'vitest'
import { assignableRoles } from './roles'

describe('assignableRoles', () => {
  it('el admin puede asignar cualquier rol a otros', () => {
    expect(assignableRoles('admin', 'moderator', false)).toEqual(['user', 'editor', 'moderator', 'admin'])
  })

  it('nadie puede cambiarse su propio rol', () => {
    expect(assignableRoles('admin', 'admin', true)).toEqual([])
  })

  it('el moderador solo alterna entre usuario y editor', () => {
    expect(assignableRoles('moderator', 'user', false)).toEqual(['user', 'editor'])
    expect(assignableRoles('moderator', 'editor', false)).toEqual(['user', 'editor'])
    expect(assignableRoles('moderator', 'moderator', false)).toEqual([])
    expect(assignableRoles('moderator', 'admin', false)).toEqual([])
  })

  it('editores y usuarios no pueden cambiar roles', () => {
    expect(assignableRoles('editor', 'user', false)).toEqual([])
    expect(assignableRoles('user', 'user', false)).toEqual([])
  })
})
