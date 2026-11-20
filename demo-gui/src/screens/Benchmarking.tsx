import { useEffect, useMemo, useRef, useState } from 'react'
import { BottomBar } from '../components/BottomBar'
import { ChatTurns } from '../components/ChatTurns'
import { CouncilToken, DbTokens, FieldToken, Sentence } from '../components/ConfigSentence'
import { QuestionCards } from '../components/QuestionCards'
import { SimUserPanel } from '../components/SimUserPanel'
import { SqlBlock } from '../components/SqlBlock'
import { Card, EmptyState, Eyebrow } from '../components/ui'
import { TYPE_STYLE, cx } from '../components/styles'
import { useData } from '../data/context'
import { useDialogues } from '../data/detail'
import type { DialogueRun, QuestionDialogues } from '../data/detailSchema'
import { findQuestion, meaningChoices, outcomeBadges, resumeIndex, runOutcome } from '../data/dialogues'
import type { Selection } from '../data/questions'
import type { UserTurn } from '../data/schema'
import { agentById, shortModel, subcatIndex } from '../data/selectors'
import { useReplay } from '../replay/useReplay'
import { useApp } from '../state/app'
import { useSelection } from '../state/useSelection'

const article = (word: string | null) => (word && /^[aeiou]/i.test(word) ? 'an' : 'a')

const OUTCOME = { ok: 'border-answerable bg-answerable-soft text-answerable', ko: 'border-fail bg-fail-soft text-fail', none: 'border-line text-ink-3' }

function DialogueView({ q, run, sel, onMeaning, onStep }: { q: QuestionDialogues | undefined; run: DialogueRun | undefined; sel: Selection; onMeaning: (m: number) => void; onStep: () => boolean }) {
  const d = useData()
  const present = useApp((s) => s.present)
  const turns = useMemo(() => run?.turns ?? [], [run])
  const choices = useMemo(() => (q && sel.system && sel.mode ? meaningChoices(q, sel.system, sel.mode) : []), [q, sel.system, sel.mode])
  const [confirmed, setConfirmed] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const state = useRef({ reached: 0, turns, waiting: false })

  const replay = useReplay(turns.length + (run ? 1 : 0), {
    atEnd: !present,
    intercept: (direction) => {
      if (direction < 0) return false
      if (onStep()) return true
      if (!state.current.waiting) return false
      // the arrow keeps the meaning on show; the reply comes with the next step
      setConfirmed(true)
      return true
    },
  })
  const reached = Math.min(replay.reached, turns.length)
  // in presentation the reply to a clarification waits for the choice of the meaning
  const waiting = present && !confirmed && choices.filter((c) => c.available).length > 1 && turns[reached]?.role === 'simulated_user' && replay.state.status !== 'done'
  state.current = { reached, turns, waiting }

  // another interpretation: the chat restarts from the first turn that differs
  const previous = useRef(run)
  useEffect(() => {
    const before = previous.current
    previous.current = run
    if (!before || !run || before === run) return
    setPicked(null)
    replay.seek(resumeIndex(before, run), run.turns.length + 1, !present)
    // the replay object changes at every render: only a change of dialogue matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  if (!q || !run)
    return (
      <>
        <div className="flex-1" />
        <BottomBar replay={replay} />
      </>
    )

  const done = replay.state.status === 'done'
  const lastUser = turns.slice(0, reached).reduce((at, t, i) => (t.role === 'simulated_user' ? i : at), -1)
  const selected = picked !== null && picked < reached ? picked : lastUser >= 0 ? lastUser : null
  const turn = selected !== null ? (turns[selected] as UserTurn) : undefined
  const outcome = runOutcome(run, q.question.type)
  const system = shortModel(agentById(d, run.system)?.name ?? run.system)

  return (
    <>
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_23rem] items-start gap-4 px-8 pb-5">
        <Card className="flex flex-col gap-2.5 p-4" data-shot="chat">
          <ChatTurns nlq={q.question.nlq} turns={turns} shown={reached} system={system} selected={selected} onSelect={setPicked} thinking={replay.state.status === 'running'} />
          {done && (
            <div className="flex flex-col gap-2 border-t border-line pt-2.5">
              <span role="status" className={cx('self-start rounded-full border px-3 py-1 text-[0.88rem] font-semibold', OUTCOME[outcome.tone])}>
                {outcome.tone === 'ok' ? '✓' : outcome.tone === 'ko' ? '✗' : ''} {outcome.text}
              </span>
              {outcome.reason && <p className="text-[0.85rem] text-ink-2">{outcome.reason}</p>}
              {outcome.otherMeaning && <p className="text-[0.85rem] text-ink-2">{outcome.otherMeaning}</p>}
              {run.origin_note && <p className="text-[0.82rem] text-ink-2">{run.origin_note}</p>}
              {run.outcome_note && <p className="text-[0.82rem] text-ink-2">{run.outcome_note}</p>}
              {run.reference_sql && (
                <details>
                  <summary className="cursor-pointer text-[0.82rem] font-medium text-accent">Reference SQL for this interpretation</summary>
                  <SqlBlock sql={run.reference_sql} className="mt-1.5 max-h-72 overflow-y-auto" />
                </details>
              )}
            </div>
          )}
        </Card>
        <SimUserPanel
          type={q.question.type}
          choices={choices}
          meaning={sel.meaning}
          onMeaning={(m) => {
            setConfirmed(true)
            onMeaning(m)
          }}
          turn={turn}
          waiting={waiting}
        />
      </div>
      <BottomBar replay={replay} />
    </>
  )
}

export function Benchmarking() {
  const d = useData()
  const present = useApp((s) => s.present)
  const { sel, rows, set, pending, fillNext } = useSelection('benchmark')
  const detail = useDialogues(sel)
  const q = detail.status === 'ok' && sel.questionId ? findQuestion(detail.data, sel.questionId) : undefined
  const run = q?.runs.find((r) => r.system === sel.system && r.mode === sel.mode && r.meaning === sel.meaning)
  const type = sel.subcategory ? subcatIndex(d).get(sel.subcategory)?.type : undefined
  const tone = type ? cx(TYPE_STYLE[type].border, TYPE_STYLE[type].bg) : undefined
  const cellChosen = sel.subcategory !== null && sel.style !== null && sel.difficulty !== null
  const nothing = (cellChosen || !present) && (rows.length === 0 || (sel.questionId !== null && (detail.status === 'missing' || (detail.status === 'ok' && !run))))

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-col gap-4 px-8 pt-5 pb-4">
        <Card className="px-5 py-3">
          <Eyebrow>
            <span className="font-mono text-accent">2</span> Benchmarking
          </Eyebrow>
          <Sentence>
            Ask <FieldToken field="system" sel={sel} screen="benchmark" set={set} placeholder="system" mono footer="Any Text-to-SQL system can be tested. This replay shows the systems of the recorded run." /> {article(sel.style)}{' '}
            <FieldToken field="style" sel={sel} screen="benchmark" set={set} placeholder="style" />
            <FieldToken field="difficulty" sel={sel} screen="benchmark" set={set} placeholder="difficulty" />
            <FieldToken field="subcategory" sel={sel} screen="benchmark" set={set} placeholder="choose a subcategory" className={tone} /> question on <DbTokens sel={sel} screen="benchmark" set={set} />, in the{' '}
            <FieldToken field="mode" sel={sel} screen="benchmark" set={set} placeholder="category" /> category mode. A <CouncilToken /> plays the user.
          </Sentence>
        </Card>
        {(cellChosen || !present) && rows.length > 0 && <QuestionCards title="Questions" rows={rows} selectedId={sel.questionId} onSelect={(id) => set('questionId', id)} badge={(r) => outcomeBadges(r, sel.system, sel.mode)} />}
        {nothing && <EmptyState>No recorded dialogue for this selection yet.</EmptyState>}
        {sel.questionId && detail.status === 'loading' && <p role="status" className="text-ink-3">Loading…</p>}
        {detail.status === 'invalid' && (
          <EmptyState>
            The file {detail.url} cannot be shown: {detail.issues[0]?.path}: {detail.issues[0]?.message}
          </EmptyState>
        )}
      </div>
      <DialogueView key={`${q?.question_id}|${sel.system}|${sel.mode}`} q={q} run={run} sel={sel} onMeaning={(m) => set('meaning', String(m))} onStep={() => (pending !== null ? fillNext() : false)} />
    </div>
  )
}
