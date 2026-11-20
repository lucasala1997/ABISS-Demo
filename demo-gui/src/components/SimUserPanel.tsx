import { EyeOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { replyChoice, type MeaningChoice } from '../data/dialogues'
import type { TypeIdT, UserTurn } from '../data/schema'
import { shortModel } from '../data/selectors'
import { Card, Eyebrow, RelevancyChip } from './ui'
import { cx } from './styles'

const LABEL_EFFECT = {
  relevant: 'Relevant: the reply uses the hidden knowledge.',
  technical: 'Technical: the reply uses fragments of the ground-truth SQL.',
  irrelevant: 'Irrelevant: the user adds nothing, with a fixed sentence.',
} as const

const Line = ({ children }: { children: ReactNode }) => <p className="text-[0.82rem] leading-snug text-ink-2">{children}</p>

/** How the reply of the selected turn was chosen, in words the screen can be read with. */
function ReplyChosen({ turn }: { turn: UserTurn }) {
  const c = replyChoice(turn)
  if (c.kind === 'by_hand') return <Line>This reply was written by hand, not by the simulated user.</Line>
  if (c.kind === 'fixed_refusal') return <Line>Unanswerable question: the user replies with a fixed sentence. The council does not vote.</Line>
  if (c.kind === 'no_reference') return <Line>The user replies with a fixed sentence, and no reply is written.</Line>
  if (c.kind === 'none') return <Line>The council labelled the clarification Irrelevant: the user replies with a fixed sentence, and no reply is written.</Line>
  if (c.kind === 'contest')
    return (
      <>
        <Line>
          Each council model wrote a candidate reply. Every model compared every pair: {c.pairs} pairs × {c.judges} judges = {c.comparisons} comparisons. The reply with the most wins is sent to the system.
        </Line>
        <ul className="flex flex-col gap-1">
          {c.rows.map((r) => (
            <li key={r.model} className={cx('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-md border px-2 py-1 text-[0.82rem]', r.winner ? 'border-accent bg-accent-soft' : 'border-line')}>
              <span className="truncate font-mono">{shortModel(r.model)}</span>
              <span className="tabular-nums">
                <b>{r.wins}</b> of {c.comparisons} comparisons
              </span>
              <span className="col-span-2 h-1.5 overflow-hidden rounded-sm bg-surface-2">
                <span className={cx('block h-full', r.winner ? 'bg-accent' : 'bg-ink-3')} style={{ width: `${(100 * r.wins) / c.comparisons}%` }} />
              </span>
              {r.winner && <span className="col-span-2 text-[0.75rem] font-semibold text-accent">sent to the system</span>}
            </li>
          ))}
        </ul>
        <p className="text-[0.75rem] text-ink-3">The candidate texts were not saved in this run.</p>
      </>
    )
  const STATE = { used: 'sent to the system', leaked: 'rejected: it leaked the answer', not_asked: 'not asked' } as const
  return (
    <>
      <Line>Council members answer in a drawn order. The first reply that passes the leak check is sent to the system.</Line>
      <ol className="flex flex-col gap-1">
        {c.rows.map((r, i) => (
          <li key={r.model} className={cx('flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[0.82rem]', r.state === 'used' ? 'border-accent bg-accent-soft' : 'border-line')}>
            <span className="truncate font-mono">
              {i + 1}. {shortModel(r.model)}
            </span>
            <span className={cx('shrink-0 text-[0.75rem]', r.state === 'used' ? 'font-semibold text-accent' : r.state === 'leaked' ? 'text-fail' : 'text-ink-3')}>{STATE[r.state]}</span>
          </li>
        ))}
      </ol>
      {c.allLeaked && <p className="text-[0.75rem] text-ink-3">Every reply leaked: the one with the fewest problems was used.</p>}
    </>
  )
}

/**
 * What is behind the simulated user: the meaning it has in mind (the one thing the visitor chooses), how the council
 * labelled the clarification of the selected turn, and how its reply was chosen.
 */
export function SimUserPanel({ type, choices, meaning, onMeaning, turn, waiting }: { type: TypeIdT; choices: MeaningChoice[]; meaning: number; onMeaning: (m: number) => void; turn: UserTurn | undefined; waiting?: boolean }) {
  return (
    <div className="flex flex-col gap-3" data-shot="sim-user">
      <Card className="flex flex-col gap-2.5 p-3.5">
        <Eyebrow>Behind the simulated user</Eyebrow>
        {type === 'ambiguous' && choices.length > 1 ? (
          <div role="radiogroup" aria-label="Meaning the user has in mind" className="flex flex-col gap-1.5">
            <span className="text-[0.8rem] font-semibold text-ink-2">Meaning the user has in mind</span>
            {choices.map((c) => (
              <button
                key={c.meaning}
                role="radio"
                aria-checked={c.meaning === meaning}
                aria-disabled={!c.available}
                title={c.reason}
                onClick={() => c.available && onMeaning(c.meaning)}
                className={cx('flex flex-col gap-1 rounded-lg border px-2.5 py-2 text-left', c.meaning === meaning ? 'border-accent bg-accent-soft' : 'border-line', c.available ? 'hover:border-line-strong' : 'cursor-not-allowed opacity-60')}
              >
                <span className="flex items-center gap-2 text-[0.88rem] font-semibold">
                  <span className={cx('size-3.5 shrink-0 rounded-full border', c.meaning === meaning ? 'border-4 border-accent' : 'border-line-strong')} />
                  {c.label}
                </span>
                {c.hiddenKnowledge && (
                  <span className="flex gap-1.5 text-[0.8rem] leading-snug text-ink-2">
                    <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {c.hiddenKnowledge}
                  </span>
                )}
                {!c.available && <span className="text-[0.75rem] text-ink-3">{c.reason}</span>}
              </button>
            ))}
            {waiting && <p className="text-[0.8rem] font-semibold text-accent">Choose the meaning to go on (→ keeps this one).</p>}
          </div>
        ) : type === 'unanswerable' ? (
          <Line>The user knows why the question cannot be answered. It replies to every clarification with the same fixed sentence.</Line>
        ) : type === 'answerable' ? (
          <Line>The question has one meaning. The user can only answer technical questions about the query.</Line>
        ) : (
          choices[0]?.hiddenKnowledge && <Line>{choices[0].hiddenKnowledge}</Line>
        )}
      </Card>
      {turn && (
        <Card className="flex flex-col gap-2.5 p-3.5">
          <Eyebrow>Council on the clarification</Eyebrow>
          {turn.votes.length > 0 ? (
            <>
              <ul className="flex flex-col gap-1">
                {turn.votes.map((v) => (
                  <li key={v.model} className="flex items-center justify-between gap-2 text-[0.82rem]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-mono">{shortModel(v.model)}</span>
                      {v.tested_system && <span className="shrink-0 rounded border border-line-strong px-1 py-px text-[0.68rem] text-ink-2">under test</span>}
                    </span>
                    <RelevancyChip label={v.label} size="sm" />
                  </li>
                ))}
              </ul>
              <Line>The most frequent label wins. A tie gives Irrelevant.</Line>
              {turn.technical_without_node && <Line>The vote gave Technical, but the votes pointed to no part of the ground-truth SQL the reply could use: the turn counts as Irrelevant.</Line>}
              {turn.votes.some((v) => v.tested_system) && <Line>The system under test is also a council member: its vote counts as the others.</Line>}
              <Line>{LABEL_EFFECT[turn.relevancy]}</Line>
              {turn.resolved_fragments && turn.resolved_fragments.length > 0 && (
                <ul className="list-disc pl-5 text-[0.8rem] text-ink-2">
                  {turn.resolved_fragments.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Line>No vote on this turn.</Line>
          )}
          <Eyebrow className="mt-1">How the reply was chosen</Eyebrow>
          <ReplyChosen turn={turn} />
        </Card>
      )}
    </div>
  )
}
