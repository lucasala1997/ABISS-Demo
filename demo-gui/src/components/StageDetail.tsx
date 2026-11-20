import { useData } from '../data/context'
import type { QuestionDetail } from '../data/detailSchema'
import type { ValidationStage } from '../data/schema'
import { subcatIndex, typeLabel } from '../data/selectors'
import { Decision, PairwiseVotes, VoteList } from './StageVotes'
import { cx } from './styles'

const n = (x: number) => x.toLocaleString('en-US')

/** What one stage did with the question: what it checks, the reason or the votes, and its decision. */
export function StageDetail({ q, stage, collection }: { q: QuestionDetail; stage: ValidationStage; collection: string }) {
  const d = useData()
  const run = q.validation.find((s) => s.stage === stage.id)
  const counts = stage.run_counts?.[collection]
  const failed = run?.outcome === 'fail'
  const only = stage.applies_to_subcategories?.map((id) => subcatIndex(d).get(id)?.sub.name ?? id).join(', ')
  return (
    <div className={cx('flex flex-col gap-2.5 rounded-xl border p-3.5', failed ? 'border-fail bg-fail-soft/50' : 'border-accent/50 bg-accent-soft/40')} data-shot="stage-detail">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={cx('grid size-6 place-items-center self-center rounded-full font-mono text-[0.75rem] font-bold text-surface', failed ? 'bg-fail' : 'bg-accent')}>{stage.id}</span>
        <span className="text-[1rem] font-semibold">{stage.name}</span>
        <span className="text-[0.85rem] text-ink-2">{stage.notes}</span>
      </div>
      {counts && counts.checked_records > 0 && (
        <p className="text-[0.78rem] text-ink-3">
          In this run the stage checked {n(counts.checked_records)} records and removed {n(counts.removed_records)}
          {counts.partner_records > 0 && `, plus ${n(counts.partner_records)} whose other interpretation was removed`}.
        </p>
      )}
      {(!run || run.outcome === 'unreached') && <p className="text-[0.88rem] text-ink-2">Not reached: the question was removed at an earlier stage.</p>}
      {run?.outcome === 'skipped' && (
        <p className="text-[0.88rem] text-ink-2">
          {(stage.applies_to as string[]).includes(q.type) && only ? `Applies to ${only} questions only.` : `Not applied to ${typeLabel(d, q.type).toLowerCase()} questions.`}
        </p>
      )}
      {run?.checks.map((c, i) => (
        <div key={i} className="flex flex-col gap-2">
          {c.meaning !== null && <div className="text-[0.78rem] font-semibold tracking-wide text-ink-2 uppercase">Interpretation {c.meaning + 1}</div>}
          {c.reasons.map((r, k) => (
            <p key={k} className="rounded-md border border-fail/40 bg-surface px-2.5 py-1.5 text-[0.88rem] text-ink">
              <span className="font-semibold text-fail">Removed: </span>
              {r}
            </p>
          ))}
          {c.partner_removed && <p className="text-[0.88rem] text-ink-2">Removed because the other interpretation was removed.</p>}
          {c.votes.length > 0 && (stage.decision_rule === 'pairwise' ? <PairwiseVotes votes={c.votes} stage={stage} /> : <VoteList votes={c.votes} stage={stage} />)}
          {(c.votes.length > 0 || stage.decision_rule === 'pairwise') && stage.uses_council && <Decision stage={stage} votes={c.votes} />}
          {!c.votes.length && !c.reasons.length && !c.partner_removed && !stage.uses_council && <p className="text-[0.88rem] text-ink-2">Passed: this check has no votes.</p>}
        </div>
      ))}
    </div>
  )
}
