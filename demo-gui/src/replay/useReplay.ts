import { useEffect, useReducer, useRef } from 'react'
import { useApp } from '../state/app'
import { initReplay, replayReducer, stepStatus, type ReplayState } from './engine'

export const STEP_EVENT = 'abiss:step'

export interface Replay {
  state: ReplayState
  status: (i: number) => ReturnType<typeof stepStatus>
  /** how many steps are done: the step at this index is the one being shown, or the next one */
  reached: number
  play(): void
  pause(): void
  stepForward(): void
  stepBack(): void
  skipToEnd(): void
  restart(): void
  /** shows another replay of `steps` steps from the step `index`, then plays it if `play` */
  seek(index: number, steps: number, play?: boolean): void
}

export interface ReplayOptions {
  /** every step already done: how the screens open outside presentation */
  atEnd: boolean
  /** called before a step of the keyboard or of the bar; return true when the screen used the step itself (e.g. to choose a part of the sentence) */
  intercept?: (direction: 1 | -1) => boolean
}

/** Drives a replay over a number of steps at the global speed. Remount (key) the caller to replay something else. */
export function useReplay(steps: number, opts: ReplayOptions): Replay {
  const speed = useApp((s) => s.speed)
  const [state, dispatch] = useReducer(replayReducer, undefined, () => initReplay(steps, speed, opts.atEnd))
  const last = useRef<number | null>(null)
  const intercept = useRef(opts.intercept)
  intercept.current = opts.intercept

  useEffect(() => {
    dispatch({ type: 'speed', speed })
  }, [speed])

  useEffect(() => {
    if (state.status !== 'running') {
      last.current = null
      return
    }
    let raf = 0
    const loop = (t: number) => {
      if (last.current !== null) dispatch({ type: 'tick', dt: t - last.current })
      last.current = t
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state.status])

  const step = (direction: 1 | -1) => {
    if (intercept.current?.(direction)) return
    dispatch({ type: direction > 0 ? 'stepForward' : 'stepBack' })
  }
  const stepRef = useRef(step)
  stepRef.current = step

  useEffect(() => {
    const on = (e: Event) => stepRef.current((e as CustomEvent<number>).detail > 0 ? 1 : -1)
    window.addEventListener(STEP_EVENT, on)
    return () => window.removeEventListener(STEP_EVENT, on)
  }, [])

  return {
    state,
    status: (i) => stepStatus(state, i),
    reached: state.index,
    play: () => {
      if (!intercept.current?.(1)) dispatch({ type: 'play' })
    },
    pause: () => dispatch({ type: 'pause' }),
    stepForward: () => step(1),
    stepBack: () => step(-1),
    skipToEnd: () => dispatch({ type: 'skipToEnd' }),
    restart: () => dispatch({ type: 'reset' }),
    seek: (index, steps, play) => {
      dispatch({ type: 'seek', index, steps })
      if (play) dispatch({ type: 'play' })
    },
  }
}
