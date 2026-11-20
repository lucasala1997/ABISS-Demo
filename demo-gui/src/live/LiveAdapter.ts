import type { RelevancyIdT } from '../data/schema'

/* Client side of the live contract (see CONTRACT.md). Two implementations: mock and HTTP. */

export interface Health {
  status: 'ok' | 'degraded' | 'down'
  backend: string
  models: string[]
}

export interface CreateSessionReq {
  db_id: string
  nlq: string
  evidence?: string[]
  mode: string
  agent_model?: string
  human_role: 'agent' | 'user'
}

export interface TurnReq {
  action: 'clarification' | 'sql' | 'feedback' | 'reply'
  text?: string
  sql?: string
}

export type LiveEvent =
  | { type: 'agent_turn'; payload: { action: 'clarification' | 'sql' | 'feedback'; text?: string; sql?: string; matched_nlq?: string }; latency_ms: number; model?: string }
  | { type: 'council_vote'; payload: { label: RelevancyIdT }; latency_ms: number; model?: string }
  | { type: 'user_reply'; payload: { label: RelevancyIdT; text: string; bypassed?: boolean }; latency_ms: number; model?: string }
  | { type: 'terminal'; payload: { action: 'sql' | 'feedback'; by: 'agent' | 'human'; text?: string; sql?: string; correct?: boolean }; latency_ms: number; model?: string }
  | { type: 'error'; payload: { message: string; code?: string | number }; latency_ms: number; model?: string }

export const LIVE_EVENT_TYPES: LiveEvent['type'][] = ['agent_turn', 'council_vote', 'user_reply', 'terminal', 'error']

export interface LiveAdapter {
  kind: 'mock' | 'http' | 'recorded'
  health(): Promise<Health>
  createSession(req: CreateSessionReq): Promise<{ session_id: string }>
  sendTurn(sessionId: string, turn: TurnReq): Promise<{ accepted: true }>
  /** returns an unsubscribe function */
  subscribe(sessionId: string, onEvent: (e: LiveEvent) => void): () => void
}
