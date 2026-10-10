import { describe, expect, it } from 'vitest'
import { getCompetition, MAX_COMPETITION_CHARS, setCompetition } from './warDesignStore'

// En el entorno de pruebas no hay localStorage: vale con que funcione en memoria
describe('nombre de la competición', () => {
  it('se guarda por war y se puede borrar', () => {
    expect(getCompetition('w-a')).toBe('')
    setCompetition('w-a', 'MKW Open · Gran Final')
    setCompetition('w-b', 'Liga')
    expect(getCompetition('w-a')).toBe('MKW Open · Gran Final')
    expect(getCompetition('w-b')).toBe('Liga')
    setCompetition('w-a', '   ')
    expect(getCompetition('w-a')).toBe('')
    expect(getCompetition('w-b')).toBe('Liga')
  })

  it('recorta los nombres demasiado largos', () => {
    setCompetition('w-long', 'x'.repeat(MAX_COMPETITION_CHARS + 40))
    expect(getCompetition('w-long')).toHaveLength(MAX_COMPETITION_CHARS)
  })

  it('solo conserva las últimas 60', () => {
    for (let i = 0; i < 65; i++) setCompetition(`bulk-${i}`, `n${i}`)
    expect(getCompetition('bulk-0')).toBe('')
    expect(getCompetition('bulk-64')).toBe('n64')
  })
})
