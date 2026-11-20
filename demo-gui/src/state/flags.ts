import type { Speed } from '../replay/engine'

/* URL flags: ?dev=1, ?present=1, ?paper=1, ?speed=4, and in dev mode ?data=fixtures/<file>.json */

export interface Flags {
  dev: boolean
  present: boolean
  /** ?paper=1: the type sizes of the figures of the paper */
  paper: boolean
  dataUrl: string
  speed: Speed
}

export const DEFAULT_DATA_URL = 'data/abiss_demo_data.json'

export function resolveFlags(input: { search: string; env: Record<string, string | undefined> }): Flags {
  const q = new URLSearchParams(input.search)
  const on = (k: string) => q.get(k) === '1' || q.get(k) === 'true'
  const dev = on('dev')
  const data = q.get('data')
  const dataUrl = dev && data && /^fixtures\/[\w.-]+\.json$/.test(data) ? data : DEFAULT_DATA_URL
  const speed: Speed = q.get('speed') === '4' ? 4 : 1
  return { dev, present: on('present'), paper: on('paper'), dataUrl, speed }
}
