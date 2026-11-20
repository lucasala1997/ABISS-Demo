import type { DialogueRun, DialoguesFile, QuestionDialogues } from './detailSchema'
import { outcomes } from './questions'
import type { QuestionIndexRow, TypeIdT, UserTurn } from './schema'

/* The recorded dialogues of a question: which one a screen shows, what the visitor can choose, how a reply was chosen. */

export const findQuestion = (files: DialoguesFile[], questionId: string): QuestionDialogues | undefined => files.flatMap((f) => f.dialogues).find((q) => q.question_id === questionId)

export function findRun(files: DialoguesFile[], questionId: string, system: string, mode: string, meaning: number): DialogueRun | undefined {
  return findQuestion(files, questionId)?.runs.find((r) => r.system === system && r.mode === mode && r.meaning === meaning)
}

export interface MeaningChoice {
  meaning: number
  label: string
  hiddenKnowledge: string | null
  /** whether a dialogue is recorded for this interpretation with this system and mode */
  available: boolean
  reason?: string
}

/** The interpretations of an ambiguous question the visitor can choose between. */
export function meaningChoices(q: QuestionDialogues, system: string, mode: string): MeaningChoice[] {
  return q.question.meanings.map((m, meaning) => {
    const available = q.runs.some((r) => r.system === system && r.mode === mode && r.meaning === meaning)
    return { meaning, label: m.label ?? `Interpretation ${meaning + 1}`, hiddenKnowledge: m.hidden_knowledge, available, ...(available ? {} : { reason: 'No recorded dialogue for this interpretation' }) }
  })
}

/** The first turn where two dialogues differ: after a change of interpretation the chat restarts from there. */
export function resumeIndex(a: DialogueRun, b: DialogueRun): number {
  const n = Math.min(a.turns.length, b.turns.length)
  for (let i = 0; i < n; i++) if (JSON.stringify(a.turns[i]) !== JSON.stringify(b.turns[i])) return i
  return n
}

export type ReplyChoiceView =
  /** earlier run: every model wrote a candidate, every model compared every pair */
  | { kind: 'contest'; rows: { model: string; wins: number; winner: boolean }[]; comparisons: number; judges: number; pairs: number }
  /** final run: the models answer in a drawn order, the first reply that passes the leak check is used */
  | { kind: 'order'; rows: { model: string; state: 'used' | 'leaked' | 'not_asked' }[]; allLeaked: boolean }
  | { kind: 'fixed_refusal' }
  | { kind: 'by_hand' }
  /** the votes gave Technical, but pointed to no usable part of the reference SQL: the turn counts as Irrelevant */
  | { kind: 'no_reference' }
  | { kind: 'none' }

/** How the reply of a simulated-user turn was chosen, from what the run recorded. */
export function replyChoice(turn: UserTurn): ReplyChoiceView {
  if (turn.by_hand) return { kind: 'by_hand' }
  if (turn.fixed_refusal) return { kind: 'fixed_refusal' }
  if (turn.technical_without_node) return { kind: 'no_reference' }
  if (turn.contest) {
    const judges = new Set(turn.contest.judgments.map((j) => j.judge)).size
    const comparisons = turn.contest.judgments.length
    const rows = Object.entries(turn.contest.wins)
      .sort((a, b) => b[1] - a[1])
      .map(([model, wins]) => ({ model, wins, winner: model === turn.contest!.winner }))
    return { kind: 'contest', rows, comparisons, judges, pairs: judges ? comparisons / judges : 0 }
  }
  if (turn.choice) {
    const { order, answers, answer_model, all_leaked } = turn.choice
    const rows = order.map((model) => {
      const asked = answers.find((a) => a.model === model)
      const state = model === answer_model ? ('used' as const) : asked ? ('leaked' as const) : ('not_asked' as const)
      return { model, state }
    })
    return { kind: 'order', rows, allLeaked: all_leaked }
  }
  return { kind: 'none' }
}

export interface OutcomeView {
  tone: 'ok' | 'ko' | 'none'
  text: string
  /** why the answer did not pass, where the run recorded it */
  reason?: string
  /** the SQL gives the result of the other interpretation of an ambiguous question */
  otherMeaning?: string
}

/** One outcome value: EX for a question with SQL, FB for an unanswerable one. */
export function outcomeView(value: boolean | null, type: TypeIdT): OutcomeView {
  if (value === null) return { tone: 'none', text: 'no dialogue' }
  if (type === 'unanswerable') return value ? { tone: 'ok', text: 'explained' } : { tone: 'ko', text: 'not explained' }
  return value ? { tone: 'ok', text: 'correct' } : { tone: 'ko', text: 'incorrect' }
}

const EX_REASON = {
  mismatch: 'The SQL runs, but its result differs from the reference.',
  error: 'The SQL fails to run.',
  timeout: 'The SQL ran out of time.',
  no_result: 'The result could not be compared with the reference.',
} as const

/** Why a dialogue did not pass: the reason EX recorded, or the kind of answer the system ended with. */
function whyNot(run: DialogueRun, type: TypeIdT): string | undefined {
  const last = run.turns.filter((t) => t.role === 'agent').at(-1)
  if (last?.action === 'failed') return 'The system gave no valid answer.'
  if (type === 'unanswerable') return last?.action === 'sql' ? 'The system answered with SQL, not with an explanation.' : undefined
  if (run.ex_status && run.ex_status !== 'match') return EX_REASON[run.ex_status]
  if (last?.action === 'feedback') return 'The system answered that the question cannot be answered, and gave no SQL.'
  return undefined
}

export function runOutcome(run: DialogueRun, type: TypeIdT): OutcomeView {
  const value = type === 'unanswerable' ? run.explained : run.correct
  if (value === null) return { tone: 'none', text: 'outcome not recorded' }
  const reason = value ? undefined : whyNot(run, type)
  return { ...outcomeView(value, type), ...(reason ? { reason } : {}), ...(run.matches_other_meaning ? { otherMeaning: 'This SQL answers the other interpretation.' } : {}) }
}

/** The outcome of a question on its card: one per interpretation, numbered for an ambiguous question. */
export const outcomeBadges = (row: QuestionIndexRow, system: string | null, mode: string | null): OutcomeView[] =>
  outcomes(row, system, mode).map((v, i) => {
    const o = outcomeView(v, row.type)
    return { tone: o.tone, text: `${row.meanings > 1 ? `${i + 1} ` : ''}${o.tone === 'ok' ? '✓' : o.tone === 'ko' ? '✗' : '–'} ${o.text}` }
  })
