/*
 * Replay engine: a pure reducer over a number of steps, each lasting STEP_MS. The run did not measure single calls,
 * so the replay shows no times: it only goes through the steps at a fixed pace.
 * Steps before `index` are done, the step at `index` is active (unless idle/done), and `elapsed` is the time already
 * spent on the active step.
 */

/** How long one step stays on screen at speed 1. */
export const STEP_MS = 1400

export type Speed = 1 | 4
export type ReplayStatus = 'idle' | 'running' | 'paused' | 'done'
export type StepStatus = 'pending' | 'active' | 'done'

export interface ReplayState {
  steps: number
  index: number
  elapsed: number
  status: ReplayStatus
  speed: Speed
}

export type ReplayAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'tick'; dt: number }
  | { type: 'stepForward' }
  | { type: 'stepBack' }
  | { type: 'skipToEnd' }
  | { type: 'reset' }
  | { type: 'speed'; speed: Speed }
  /** another replay shown from a given step, e.g. the dialogue of the other interpretation from the turn where it differs */
  | { type: 'seek'; index: number; steps: number }

const end = (s: ReplayState): ReplayState => ({ ...s, index: s.steps, elapsed: 0, status: 'done' })

/** atEnd: every step already done, as the screens open outside presentation. */
export function initReplay(steps: number, speed: Speed = 1, atEnd = false): ReplayState {
  const s: ReplayState = { steps, index: 0, elapsed: 0, status: 'idle', speed }
  return atEnd || steps === 0 ? end(s) : s
}

function advance(s: ReplayState, dt: number): ReplayState {
  const elapsed = s.elapsed + dt
  const index = s.index + Math.floor(elapsed / STEP_MS)
  if (index >= s.steps) return end(s)
  return { ...s, index, elapsed: elapsed % STEP_MS }
}

export function replayReducer(s: ReplayState, a: ReplayAction): ReplayState {
  switch (a.type) {
    case 'play':
      return s.status === 'done' ? s : { ...s, status: 'running' }
    case 'pause':
      return s.status === 'running' ? { ...s, status: 'paused' } : s
    case 'tick':
      return s.status === 'running' ? advance(s, a.dt * s.speed) : s
    case 'stepForward': {
      if (s.status === 'done') return s
      const index = s.index + 1
      return index >= s.steps ? end(s) : { ...s, index, elapsed: 0, status: 'paused' }
    }
    case 'stepBack':
      if (s.index === 0) return { ...s, elapsed: 0, status: s.status === 'idle' ? 'idle' : 'paused' }
      return { ...s, index: s.index - 1, elapsed: 0, status: 'paused' }
    case 'skipToEnd':
      return end(s)
    case 'reset':
      return initReplay(s.steps, s.speed)
    case 'speed':
      return { ...s, speed: a.speed }
    case 'seek': {
      const next = { ...s, steps: a.steps, elapsed: 0 }
      return a.index >= a.steps ? end(next) : { ...next, index: Math.max(0, a.index), status: 'paused' }
    }
  }
}

export function stepStatus(s: ReplayState, i: number): StepStatus {
  if (i < s.index) return 'done'
  if (i === s.index && (s.status === 'running' || s.status === 'paused')) return 'active'
  return 'pending'
}
