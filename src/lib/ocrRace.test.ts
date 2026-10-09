import { describe, expect, it } from 'vitest'
import { groupRows, leadingPosition, matchRaceLines, nameScore, normalizeName, type OcrLine } from './ocrRace'

const players = ['Peckmat', 'Pacochef', 'Sharpy', 'Polimar', 'Rayito1005', 'Kikee', 'CK 1', 'Schierke', 'Mario', 'Luigi', 'Toad', 'Yoshi'].map(
  (name, i) => ({ key: String(i), name }),
)
const keyOf = (name: string) => players.find((p) => p.name === name)!.key

describe('normalizeName / nameScore', () => {
  it('ignora mayúsculas, acentos, símbolos y confusiones típicas del OCR', () => {
    expect(normalizeName('Pólimar!')).toBe(normalizeName('polimar'))
    expect(normalizeName('Rayito1005')).toBe(normalizeName('Rayitol005'))
    expect(nameScore('Pacochef', 'Pac0chef')).toBe(1)
  })

  it('encuentra el nombre dentro de una línea con más cosas', () => {
    expect(nameScore('Sharpy', '3 Sharpy +10 27')).toBe(1)
    expect(nameScore('Sharpy', '3 Shapy +10 27')).toBeGreaterThan(0.8)
    expect(nameScore('Sharpy', '5 Polimar +8 20')).toBeLessThan(0.55)
  })
})

describe('leadingPosition', () => {
  it('lee el número de la fila', () => {
    expect(leadingPosition('1 Peckmat 15')).toBe(1)
    expect(leadingPosition('12th Toad')).toBe(12)
    expect(leadingPosition('Peckmat 15')).toBeNull()
    expect(leadingPosition('13 Peckmat')).toBeNull()
  })
})

describe('groupRows', () => {
  it('junta número, nombre y puntos de la misma fila, ordenados de izquierda a derecha', () => {
    const f = (text: string, x: number, y: number) => ({ text, x, y, height: 40, confidence: 90 })
    const rows = groupRows([f('40', 1450, 111), f('Peckmat', 450, 111), f('1', 330, 113), f('Schierke', 450, 181), f('2', 330, 179)])
    expect(rows.map((r) => r.text)).toEqual(['1 Peckmat 40', '2 Schierke'])
  })
})

describe('matchRaceLines', () => {
  const screen = (rows: [string, string][]): OcrLine[] =>
    rows.map(([num, name], i) => ({ text: `${num} ${name} +${12 - i} ${40 - i}`.trim(), y: 100 + i * 50, confidence: 80 }))

  it('empareja cada fila con su jugador y usa el número leído', () => {
    const lines = screen([
      ['1', 'Peckmat'], ['2', 'Schierke'], ['3', 'Pac0chef'], ['4', 'Luigi'], ['5', 'Sharpy'], ['6', 'Yoshi'],
      ['7', 'Polimar'], ['8', 'Mario'], ['9', 'Rayitol005'], ['10', 'Toad'], ['11', 'Kikee'], ['12', 'CK 1'],
    ])
    const r = matchRaceLines(lines, players)
    expect(r.unmatched).toEqual([])
    expect(r.matches.find((m) => m.key === keyOf('Pacochef'))?.position).toBe(3)
    expect(r.matches.find((m) => m.key === keyOf('Rayito1005'))?.position).toBe(9)
    expect(r.matches.every((m) => m.source === 'number')).toBe(true)
  })

  it('deduce la posición por la altura cuando el número no se lee', () => {
    const lines = screen([
      ['1', 'Peckmat'], ['', 'Schierke'], ['3', 'Pacochef'], ['4', 'Luigi'], ['', 'Sharpy'], ['6', 'Yoshi'],
    ])
    const r = matchRaceLines(lines, players)
    const sharpy = r.matches.find((m) => m.key === keyOf('Sharpy'))
    expect(sharpy).toMatchObject({ position: 5, source: 'row' })
    expect(r.matches.find((m) => m.key === keyOf('Schierke'))?.position).toBe(2)
    expect(r.unmatched).toHaveLength(6)
  })

  it('no inventa: lo que no se parece a nadie queda sin asignar', () => {
    const r = matchRaceLines([{ text: '1 XXXXXXXX', y: 10, confidence: 50 }], players)
    expect(r.matches).toEqual([])
    expect(r.unmatched).toHaveLength(12)
  })
})
