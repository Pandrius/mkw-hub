import { describe, expect, it } from 'vitest'
import { isVerified, verifiedBy } from './verify'

describe('isVerified', () => {
  it('Lounge: solo con una mesa del Lounge', () => {
    expect(isVerified({ kind: 'lounge', lounge_change_id: 5 })).toBe(true)
    expect(isVerified({ kind: 'lounge' })).toBe(false)
  })

  it('War: la mesa SQ la verifica, pero la validación del rival por sí sola NO', () => {
    expect(isVerified({ kind: 'war', lounge_table_id: 9 })).toBe(true)
    expect(isVerified({ kind: 'war', opponent_confirmed: true } as never)).toBe(false)
    expect(isVerified({ kind: 'war' })).toBe(false)
  })

  it('un perfil de confianza lo verifica todo lo que sube o avala', () => {
    expect(isVerified({ kind: 'war', trusted: true })).toBe(true)
    expect(isVerified({ kind: 'lounge', trusted: true })).toBe(true)
    expect(isVerified({ kind: 'war', vouched_by: 'abc' })).toBe(true)
    expect(isVerified({ kind: 'lounge', vouched_by: 'abc' })).toBe(true)
  })

  it('verifiedBy da el motivo más fuerte primero', () => {
    expect(verifiedBy({ kind: 'lounge', lounge_change_id: 1, trusted: true })).toBe('lounge')
    expect(verifiedBy({ kind: 'war', lounge_table_id: 1, trusted: true })).toBe('sq')
    expect(verifiedBy({ kind: 'war', vouched_by: 'x', trusted: true })).toBe('vouched')
    expect(verifiedBy({ kind: 'war', trusted: true })).toBe('trusted')
    expect(verifiedBy({ kind: 'war' })).toBeNull()
  })
})
