import type { CreateSessionReq, Health, LiveAdapter, LiveEvent, TurnReq } from './LiveAdapter'
import { LIVE_EVENT_TYPES } from './LiveAdapter'

/** HTTP + SSE client of CONTRACT.md. Enabled by VITE_LIVE_API_URL. */
export class HttpLiveAdapter implements LiveAdapter {
  readonly kind = 'http' as const
  private base: string

  constructor(baseUrl: string) {
    this.base = baseUrl.replace(/\/+$/, '')
  }

  private async json<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
    const ctrl = new AbortController()
    const timer = init?.timeoutMs ? setTimeout(() => ctrl.abort(), init.timeoutMs) : undefined
    try {
      const res = await fetch(this.base + path, {
        ...init,
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} on ${path}`)
      return (await res.json()) as T
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  health(timeoutMs = 3000): Promise<Health> {
    return this.json<Health>('/live/health', { timeoutMs })
  }

  createSession(req: CreateSessionReq) {
    return this.json<{ session_id: string }>('/live/sessions', { method: 'POST', body: JSON.stringify(req), timeoutMs: 30_000 })
  }

  sendTurn(sessionId: string, turn: TurnReq) {
    return this.json<{ accepted: true }>(`/live/sessions/${encodeURIComponent(sessionId)}/turns`, {
      method: 'POST',
      body: JSON.stringify(turn),
      timeoutMs: 30_000,
    })
  }

  subscribe(sessionId: string, onEvent: (e: LiveEvent) => void): () => void {
    const es = new EventSource(`${this.base}/live/sessions/${encodeURIComponent(sessionId)}/events`)
    const handle = (m: MessageEvent<string>) => {
      try {
        onEvent(JSON.parse(m.data) as LiveEvent)
      } catch {
        onEvent({ type: 'error', payload: { message: 'malformed event from live backend' }, latency_ms: 0 })
      }
    }
    for (const t of LIVE_EVENT_TYPES) es.addEventListener(t, handle as EventListener)
    es.onmessage = handle
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED)
        onEvent({ type: 'error', payload: { message: 'event stream closed by the live backend' }, latency_ms: 0 })
    }
    return () => es.close()
  }
}
