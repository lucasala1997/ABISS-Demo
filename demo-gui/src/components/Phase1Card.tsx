import { EyeOff, MessageSquareWarning } from 'lucide-react'
import { useData } from '../data/context'
import type { QuestionDetail } from '../data/detailSchema'
import { shortModel, subcatIndex } from '../data/selectors'
import type { StepStatus } from '../replay/engine'
import { SqlBlock } from './SqlBlock'
import { Eyebrow, ThinkingPulse, TypeChip } from './ui'
import { cx } from './styles'

const words = (s: string) => s.replace(/_/g, ' ')

/**
 * Phase 1: the NLQ object the writer model generated. The question comes with the first generation step, the
 * ground-truth SQL of each interpretation with its own step. `status` says which steps the replay has shown.
 * compact: only the question, for when the stages take the screen in presentation.
 */
export function Phase1Card({ q, status, thinking, compact }: { q: QuestionDetail; status: (i: number) => StepStatus; thinking: boolean; compact?: boolean }) {
  const d = useData()
  const info = subcatIndex(d).get(q.subcategory)
  const ambiguous = q.meanings.length > 1
  const questionStep = q.generation.findIndex((g) => g.step === 'question')
  const sqlStep = (meaning: number) => q.generation.findIndex((g) => g.step === 'sql' && (g.meaning ?? 0) === meaning)
  const shown = (i: number) => i < 0 || status(i) === 'done'
  const waiting = (i: number) => i >= 0 && thinking && status(i) === 'active'
  const writer = shortModel(q.generator_model)
  const hasSql = q.meanings.some((m) => m.gt_sql !== null)
  const measured = [...new Set(q.meanings.map((m) => m.difficulty))]
  const differs = hasSql && measured.some((m) => m !== q.requested_difficulty)

  return (
    <div className="flex flex-col gap-3" data-shot="phase1">
      <div className="flex flex-wrap items-center gap-2">
        <TypeChip type={q.type} />
        <span className="font-semibold">{info?.sub.name ?? q.subcategory}</span>
        <span className="text-[0.85rem] text-ink-2">
          {q.style} · {differs ? `asked: ${words(q.requested_difficulty)} · measured: ${measured.map(words).join(' / ')}` : words(q.requested_difficulty)} · <span className="font-mono">{q.db_id}</span> · written by <span className="font-mono">{writer}</span>
        </span>
      </div>
      {compact ? (
        <p className="text-[1.05rem] leading-snug font-medium text-ink">“{q.nlq}”</p>
      ) : !shown(questionStep) ? (
        waiting(questionStep) ? <ThinkingPulse who={writer} what="is writing the question" /> : <div className="h-16 rounded-lg border border-dashed border-line" />
      ) : (
        <div className={cx('grid gap-4', hasSql && !ambiguous && 'grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]')}>
          <div className="flex flex-col gap-2.5">
            <p className="text-[1.15rem] leading-snug font-medium text-ink">“{q.nlq}”</p>
            <div className="text-[0.85rem]">
              <span className="text-ink-3">Evidence: </span>
              {q.evidence.length === 0 && <span className="text-ink-2">none</span>}
              {q.evidence.map((e, i) => (
                <p key={i} className="mt-1 rounded-md border-l-2 border-accent bg-accent-soft/50 px-2.5 py-1.5 text-ink-2">{e}</p>
              ))}
            </div>
            {q.type === 'unanswerable' && (
              <div className="flex flex-col gap-1">
                <Eyebrow className="flex items-center gap-1.5">
                  <MessageSquareWarning className="size-3.5" aria-hidden /> Feedback · why the question cannot be answered
                </Eyebrow>
                <p className="rounded-md border border-dashed border-unanswerable bg-unanswerable-soft/60 px-2.5 py-1.5 text-[0.9rem] text-ink">{q.meanings[0].feedback ?? '—'}</p>
              </div>
            )}
          </div>
          {hasSql && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-baseline justify-end gap-2 text-[0.72rem] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                {ambiguous && <span className="tracking-normal normal-case">{q.meanings.length} interpretations</span>}
                <span>Ground-truth SQL</span>
              </div>
              <div className={cx('grid gap-3', ambiguous && 'grid-cols-2')}>
                {q.meanings.map((m, j) => (
                  <div key={m.record_id} className="flex min-w-0 flex-col gap-1.5">
                    {ambiguous && (
                      <div className="rounded-md border border-dashed border-ambiguous bg-ambiguous-soft/60 px-2.5 py-1.5 text-[0.88rem] text-ink">
                        <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-wide text-ink-2 uppercase">
                          <EyeOff className="size-3.5" aria-hidden /> Interpretation {j + 1} · hidden knowledge, never shown to the tested system
                        </span>
                        {m.hidden_knowledge ?? '—'}
                      </div>
                    )}
                    {m.gt_sql === null ? null : shown(sqlStep(j)) ? (
                      <SqlBlock sql={m.gt_sql} className="max-h-[22rem] overflow-y-auto" />
                    ) : waiting(sqlStep(j)) ? (
                      <ThinkingPulse who={writer} what="is writing the SQL" />
                    ) : (
                      <div className="h-16 rounded-lg border border-dashed border-line" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
