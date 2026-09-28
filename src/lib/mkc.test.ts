import { describe, expect, it } from 'vitest'
import { bestProof, pickTop, type MkcTimeTrial } from './mkc'

const tt = (id: string, player_id: number, time_ms: number, validation_status = 'valid'): MkcTimeTrial => ({
  id,
  player_id,
  track: 'RR',
  time_ms,
  proofs: [],
  created_at: '2026-01-01T00:00:00',
  validation_status,
  player_name: `p${player_id}`,
  player_country_code: 'ES',
})

describe('pickTop', () => {
  it('ordena, quita no validados y deja un tiempo por jugador', () => {
    const top = pickTop([tt('a', 1, 300), tt('b', 2, 100), tt('c', 1, 200), tt('d', 3, 50, 'pending')], 10)
    expect(top.map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('limita a N', () => {
    const records = Array.from({ length: 15 }, (_, i) => tt(String(i), i, 1000 + i))
    expect(pickTop(records, 10)).toHaveLength(10)
  })
})

describe('bestProof', () => {
  it('prefiere el vídeo completo', () => {
    expect(
      bestProof([
        { url: 'https://x.com/a', type: 'Screenshot', status: 'valid' },
        { url: 'https://youtu.be/b', type: 'Full Video', status: 'valid' },
      ]),
    ).toBe('https://youtu.be/b')
  })

  it('ignora pruebas no válidas', () => {
    expect(bestProof([{ url: 'https://youtu.be/b', type: 'Full Video', status: 'invalid' }])).toBeNull()
  })
})
