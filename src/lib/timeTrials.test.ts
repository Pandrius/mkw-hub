import { describe, expect, it } from 'vitest'
import { bestPerPlayer, type TimeTrial } from './timeTrials'

const t = (id: number, player_name: string, time_ms: number): TimeTrial => ({
  id,
  track_id: 'rainbow-road',
  category: 'race',
  nita: false,
  time_ms,
  player_name,
  country_code: null,
  proof_url: null,
  achieved_on: null,
  source: 'manual',
})

describe('bestPerPlayer', () => {
  it('se queda con el mejor tiempo de cada jugador y ordena', () => {
    const r = bestPerPlayer([t(1, 'Peckmat', 300), t(2, 'Vike', 200), t(3, 'peckmat ', 150)])
    expect(r.map((x) => x.id)).toEqual([3, 2])
  })
})
