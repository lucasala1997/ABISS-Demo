import { Check, Minus, X } from 'lucide-react'
import { useData } from '../data/context'
import type { RunVote } from '../data/detailSchema'
import type { ValidationStage } from '../data/schema'
import { shortModel, subcatIndex } from '../data/selectors'
import { attemptSummary, isDecidingVote, stageDecision, voteHasAttempt } from '../data/votes'
import { SqlBlock } from './SqlBlock'
import { Tip } from './ui'
import { cx } from './styles'

const NOT_COUNTED = 'wrote the question, not counted'

const voteLabel = (stage: ValidationStage, v: RunVote) => (v.raw !== undefined && v.raw !== null ? stage.vote_labels?.[String(v.raw)] : undefined)

function Mark({ vote }: { vote: RunVote['vote'] }) {
  if (vote === 'none') return <Minus className="size-3.5 shrink-0 text-ink-3" aria-label="no usable result" strokeWidth={3} />
  return vote === 'pass' ? <Check className="size-3.5 shrink-0" aria-label="speaks for keeping" strokeWidth={3} /> : <X className="size-3.5 shrink-0 text-fail" aria-label="speaks for removing" strokeWidth={3} />
}

/** What a model stated after its reasoning, on demand: the texts are long. */
function Reasoning({ text, summary = 'reasoning' }: { text: string | null; summary?: string }) {
  if (!text) return null
  return (
    <details className="text-[0.78rem]">
      <summary className="cursor-pointer text-accent">{summary}</summary>
      <p className="mt-1 max-h-56 overflow-y-auto rounded-md border border-line bg-surface-2 px-2.5 py-1.5 leading-snug whitespace-pre-line text-ink-2">{text}</p>
    </details>
  )
}

/** One model's vote: what it voted, its query where the stage asks for one, and its reasoning. */
function VoteRow({ v, stage }: { v: RunVote; stage: ValidationStage }) {
  const deciding = isDecidingVote(stage.decision_rule, v)
  const attempt = voteHasAttempt(v)
  const { runs, council } = attemptSummary(v)
  const label = voteLabel(stage, v) ?? (v.vote === 'none' ? 'no usable result' : undefined)
  return (
    <li className={cx('flex flex-col gap-1.5 rounded-lg border bg-surface px-2.5 py-2', deciding ? 'border-2 border-fail' : 'border-line')} data-vote={deciding ? 'deciding' : 'other'}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.85rem]">
        <Mark vote={v.vote} />
        <span className="font-mono font-semibold">{shortModel(v.model)}</span>
        {label && <span className={v.vote === 'fail' ? 'text-fail' : 'text-ink-2'}>{label}</span>}
        {v.wrote_question && <span className="rounded border border-line-strong px-1.5 py-px text-[0.72rem] text-ink-2">{NOT_COUNTED}</span>}
      </div>
      {attempt && (
        <>
          <div className="flex flex-wrap gap-x-4 text-[0.78rem] text-ink-2">
            <span>runs on the database: <span className="font-semibold text-ink">{runs}</span></span>
            {stage.id === 7 && <span>council: <span className="font-semibold text-ink">{council}</span></span>}
          </div>
          {deciding && <div className="text-[0.8rem] font-semibold text-fail">This query removes the candidate.</div>}
          {v.sql ? <SqlBlock sql={v.sql} className="max-h-72 overflow-y-auto" /> : <div className="text-[0.78rem] text-ink-3">The model wrote no query.</div>}
          {v.judgments && v.judgments.length > 0 && (
            <ul className="flex flex-col gap-1 border-l-2 border-line pl-2.5">
              {v.judgments.map((j) => (
                <li key={j.model} className="flex flex-col gap-0.5 text-[0.8rem] text-ink-2">
                  <span className="flex flex-wrap items-center gap-x-1.5">
                    {j.accepted ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <X className="size-3 text-fail" strokeWidth={3} aria-hidden />}
                    <span className="font-mono">{shortModel(j.model)}</span> {j.accepted ? 'accepts the query' : 'rejects the query'}
                    {j.wrote_question && <span className="text-ink-3">· {NOT_COUNTED}</span>}
                  </span>
                  <Reasoning text={j.rationale} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Reasoning text={v.rationale} />
    </li>
  )
}

export function VoteList({ votes, stage }: { votes: RunVote[]; stage: ValidationStage }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(19rem,1fr))] items-start gap-2">
      {votes.map((v, i) => (
        <VoteRow key={`${v.model}-${i}`} v={v} stage={stage} />
      ))}
    </ul>
  )
}

/** Pairwise stage: one row per compared subcategory, one mark per council model. */
export function PairwiseVotes({ votes, stage }: { votes: RunVote[]; stage: ValidationStage }) {
  const d = useData()
  const idx = subcatIndex(d)
  const against = [...new Set(votes.map((v) => v.against ?? ''))]
  const groups = stageDecision('pairwise', votes).groups ?? []
  if (!against.length) return <p className="text-[0.82rem] text-ink-3">No other subcategory of this kind to compare with: the question passes.</p>
  return (
    <ul className="flex flex-col gap-1.5">
      {against.map((a) => {
        const own = votes.filter((v) => (v.against ?? '') === a)
        const g = groups.find((x) => x.against === a)
        return (
          <li key={a} className="rounded-lg border border-line bg-surface px-2.5 py-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem]">
              <span className="min-w-44 text-ink-2">vs <span className="font-semibold text-ink">{idx.get(a)?.sub.name ?? a}</span></span>
              {own.map((v, k) => (
                <Tip key={k} content={`${shortModel(v.model)}: ${voteLabel(stage, v) ?? v.vote}${v.wrote_question ? ` (${NOT_COUNTED})` : ''}`}>
                  <span className={cx('inline-flex items-center gap-1 rounded border px-1.5 py-px font-mono text-[0.72rem]', v.wrote_question ? 'border-dashed border-line-strong text-ink-3' : v.vote === 'pass' ? 'border-line-strong text-ink' : 'border-fail bg-fail-soft text-fail')}>
                    <Mark vote={v.vote} /> {shortModel(v.model)}
                  </span>
                </Tip>
              ))}
              {g && <span className={cx('font-mono text-[0.78rem] tabular-nums', g.pass ? 'text-ink-3' : 'font-semibold text-fail')}>{g.kept}/{g.total} for the own category</span>}
            </div>
            <details className="mt-1 text-[0.78rem]">
              <summary className="cursor-pointer text-accent">reasoning</summary>
              <div className="mt-1 flex flex-col gap-1.5">
                {own.map((v, k) => (
                  <div key={k}>
                    <span className="font-mono font-semibold">{shortModel(v.model)}</span>
                    <p className="max-h-40 overflow-y-auto rounded-md border border-line bg-surface-2 px-2.5 py-1.5 leading-snug whitespace-pre-line text-ink-2">{v.rationale ?? 'not recorded'}</p>
                  </div>
                ))}
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}

const RULE_TEXT = {
  majority_keeps: 'majority keeps',
  majority_removes: 'majority removes',
  any_removes: 'one vote removes',
  any_keeps: 'one model must reach the reference',
  pairwise: 'must win every comparison',
  one_query_removes: 'one query on every reading removes',
} as const

/** The decision of the stage under its rule, e.g. "one vote removes · 1/2 its query was accepted → removed". */
export function Decision({ stage, votes }: { stage: ValidationStage; votes: RunVote[] }) {
  const rule = stage.decision_rule
  if (!rule) return null
  const dec = stageDecision(rule, votes)
  let count: string
  if (rule === 'pairwise') count = `${dec.groups?.filter((g) => g.pass).length ?? 0}/${dec.groups?.length ?? 0} won`
  else if (rule === 'any_removes') count = `${dec.total - dec.kept}/${dec.total} ${stage.vote_labels?.true ?? 'against'}`
  else count = `${dec.kept}/${dec.total} ${stage.vote_labels?.true ?? 'for'}`
  const body = (
    <span className={cx('font-mono text-[0.8rem] font-semibold', dec.pass ? 'text-ink' : 'text-fail')}>
      {RULE_TEXT[rule]} · {count} → {dec.pass ? 'kept' : 'removed'}
    </span>
  )
  const tip = [stage.vote_meaning && `Vote: ${stage.vote_meaning}`, stage.decision && `Rule: ${stage.decision}`].filter(Boolean).join('\n')
  return tip ? <Tip content={<span className="whitespace-pre-line">{tip}</span>}>{body}</Tip> : body
}
