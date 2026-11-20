import { describe, expect, it } from 'vitest'
import { STEP_MS, initReplay, replayReducer, stepStatus, type ReplayAction, type ReplayState } from './engine'

const run = (s: ReplayState, ...actions: ReplayAction[]) => actions.reduce(replayReducer, s)

describe('replay at a fixed pace', () => {
  it('starts idle on the first step, with nothing done', () => {
    const s = initReplay(5)
    expect(s).toMatchObject({ steps: 5, index: 0, status: 'idle', speed: 1 })
    expect([0, 1].map((i) => stepStatus(s, i))).toEqual(['pending', 'pending'])
  })

  it('outside presentation starts at the end: every step is done', () => {
    const s = initReplay(5, 1, true)
    expect(s).toMatchObject({ index: 5, status: 'done' })
    expect(stepStatus(s, 4)).toBe('done')
  })

  it('steps back from the end, one step at a time', () => {
    const s = run(initReplay(5, 1, true), { type: 'stepBack' })
    expect(s).toMatchObject({ index: 4, status: 'paused' })
    expect(stepStatus(s, 3)).toBe('done')
    expect(stepStatus(s, 4)).toBe('active')
  })

  it('restarts from the first step', () => {
    expect(run(initReplay(5, 1, true), { type: 'reset' })).toMatchObject({ index: 0, status: 'idle' })
  })

  it('plays one step every STEP_MS, four at speed 4', () => {
    expect(run(initReplay(5), { type: 'play' }, { type: 'tick', dt: STEP_MS })).toMatchObject({ index: 1, status: 'running' })
    expect(run(initReplay(5, 4), { type: 'play' }, { type: 'tick', dt: STEP_MS })).toMatchObject({ index: 4, status: 'running' })
  })

  it('ends after the last step, and play does nothing more', () => {
    const s = run(initReplay(2), { type: 'play' }, { type: 'tick', dt: STEP_MS * 2 })
    expect(s).toMatchObject({ index: 2, status: 'done' })
    expect(run(s, { type: 'play' })).toBe(s)
  })

  it('pauses, steps forward by hand and skips to the end', () => {
    const paused = run(initReplay(3), { type: 'play' }, { type: 'pause' })
    expect(paused.status).toBe('paused')
    expect(run(paused, { type: 'tick', dt: STEP_MS })).toBe(paused)
    expect(run(paused, { type: 'stepForward' })).toMatchObject({ index: 1, status: 'paused' })
    expect(run(paused, { type: 'stepForward' }, { type: 'stepForward' }, { type: 'stepForward' })).toMatchObject({ index: 3, status: 'done' })
    expect(run(paused, { type: 'skipToEnd' })).toMatchObject({ index: 3, status: 'done' })
  })

  it('does not step back before the first step', () => {
    expect(run(initReplay(3), { type: 'stepBack' })).toMatchObject({ index: 0, status: 'idle' })
  })

  it('changes speed without losing its place', () => {
    const s = run(initReplay(5), { type: 'play' }, { type: 'tick', dt: STEP_MS }, { type: 'speed', speed: 4 })
    expect(s).toMatchObject({ index: 1, speed: 4, status: 'running' })
  })

  it('a replay without steps is done at once', () => {
    expect(initReplay(0).status).toBe('done')
  })
})

describe('seek', () => {
  it('moves to a step of a replay that may have another length, paused there', () => {
    const s = run(initReplay(4, 1, true), { type: 'seek', index: 1, steps: 6 })
    expect(s).toMatchObject({ steps: 6, index: 1, status: 'paused', elapsed: 0 })
  })

  it('is done when it lands on the end', () => {
    expect(run(initReplay(4), { type: 'seek', index: 9, steps: 3 })).toMatchObject({ steps: 3, index: 3, status: 'done' })
  })
})
