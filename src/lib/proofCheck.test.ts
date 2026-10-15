import { describe, expect, it } from 'vitest'
import type { OcrLine } from './ocrRace'
import { expectedPoints, pointsOnLine, proofMatches, readProof, type ProofPlayer } from './proofCheck'

const line = (text: string, i: number): OcrLine => ({ text, y: i * 40, confidence: 90 })
const players: ProofPlayer[] = [
  { id: 1, name: 'Peckmat', expected: 98 },
  { id: 2, name: 'Tortelini', expected: 80 },
  { id: 3, name: 'Marcos', expected: 75 },
  { id: 4, name: 'Lucia', expected: 60 },
  { id: 5, name: 'Dani', expected: 50 },
  { id: 6, name: 'Sergio', expected: 40 },
]

describe('pointsOnLine', () => {
  it('lee los puntos al final y no la posición del principio', () => {
    expect(pointsOnLine('1 Peckmat 98')).toBe(98)
    expect(pointsOnLine('12. Dani 7 pts')).toBe(7)
    expect(pointsOnLine('3 Marcos')).toBeNull()
    expect(pointsOnLine('7')).toBeNull()
  })
})

describe('expectedPoints', () => {
  it('suma los puntos por posición y descarta a quien no corrió', () => {
    const races = [
      { race_results: [{ player_id: 1, position: 1 }, { player_id: 2, position: 12 }] },
      { race_results: [{ player_id: 1, position: 2 }] },
    ]
    const out = expectedPoints([{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }], races)
    expect(out).toEqual([{ id: 1, name: 'A', expected: 27 }, { id: 2, name: 'B', expected: 1 }])
  })
})

describe('readProof', () => {
  const photo = ['1 Peckmat 98', '2 Tortelini 80', '3 Marcos 75', '4 Lucia 60', '5 RivalUno 55', '6 Dani 50', '7 Sergio 40'].map(line)

  it('si los puntos de nuestros jugadores coinciden, se da por buena', () => {
    const r = readProof(photo, players)
    expect(r).toMatchObject({ read: 6, agreeing: 6, mismatched: 0 })
    expect(proofMatches(r, players)).toBe(true)
  })

  it('una diferencia de puntos manda la captura a revisión', () => {
    const edited = photo.map((l, i) => (i === 2 ? line('3 Marcos 90', 2) : l))
    const r = readProof(edited, players)
    expect(r.mismatched).toBe(1)
    expect(proofMatches(r, players)).toBe(false)
  })

  it('si se leen muy pocos jugadores no se da por buena', () => {
    const r = readProof([line('1 Peckmat 98', 0), line('2 Tortelini 80', 1)], players)
    expect(r.read).toBe(2)
    expect(proofMatches(r, players)).toBe(false)
  })

  it('tolera pequeños fallos del OCR en los nombres', () => {
    const noisy = photo.map((l, i) => (i === 0 ? line('1 Peckrnat 98', 0) : l))
    expect(readProof(noisy, players).agreeing).toBe(6)
  })
})
