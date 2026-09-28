import { describe, expect, it } from 'vitest'
import { youtubeId } from './tips'

describe('youtubeId', () => {
  it('reconoce los formatos habituales de YouTube', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('devuelve null si no es YouTube', () => {
    expect(youtubeId('https://clips.twitch.tv/abc')).toBeNull()
    expect(youtubeId('no es una url')).toBeNull()
  })
})
