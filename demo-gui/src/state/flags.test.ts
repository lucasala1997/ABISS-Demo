import { describe, expect, it } from 'vitest'
import { DEFAULT_DATA_URL, resolveFlags } from './flags'

describe('resolveFlags', () => {
  it('ignores the flags of the first version: theme, what-if and instant speed', () => {
    expect(resolveFlags({ search: '?speed=instant&theme=dark&whatif=1', env: {} })).toEqual({
      dev: false,
      present: false,
      paper: false,
      dataUrl: DEFAULT_DATA_URL,
      speed: 1,
    })
  })

  it('reads dev, present, paper and speed 4', () => {
    const f = resolveFlags({ search: '?dev=1&present=1&paper=1&speed=4', env: {} })
    expect(f).toMatchObject({ dev: true, present: true, paper: true, speed: 4 })
  })

  it('serves a fixture only in dev mode', () => {
    expect(resolveFlags({ search: '?data=fixtures/broken.json', env: {} }).dataUrl).toBe(DEFAULT_DATA_URL)
    expect(resolveFlags({ search: '?dev=1&data=fixtures/broken.json', env: {} }).dataUrl).toBe('fixtures/broken.json')
    expect(resolveFlags({ search: '?dev=1&data=../secret.json', env: {} }).dataUrl).toBe(DEFAULT_DATA_URL)
  })
})
