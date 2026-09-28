import { describe, expect, it } from 'vitest'
import { currentRecord, daysSince, type WorldRecord } from './worldRecords'

const wr = (id: number, time_ms: number, achieved_on: string): WorldRecord => ({
  id,
  track_id: 'rainbow-road',
  time_ms,
  player_name: `p${id}`,
  country_code: null,
  achieved_on,
  days_held: null,
  video_url: null,
  character: null,
  vehicle: null,
  splits: [],
})

describe('currentRecord', () => {
  it('el más rápido; en empate, el más antiguo', () => {
    expect(currentRecord([wr(1, 300, '2026-01-01'), wr(2, 200, '2026-02-01'), wr(3, 200, '2026-03-01')])?.id).toBe(2)
  })

  it('null si no hay historial', () => {
    expect(currentRecord([])).toBeNull()
  })
})

describe('daysSince', () => {
  it('cuenta días naturales', () => {
    expect(daysSince('2026-09-27', new Date('2026-09-28T15:00:00Z'))).toBe(1)
    expect(daysSince('2026-09-28', new Date('2026-09-28T23:59:00Z'))).toBe(0)
    expect(daysSince('2025-12-31', new Date('2026-09-28T00:00:00Z'))).toBe(271)
  })
})
