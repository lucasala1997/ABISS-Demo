import { useEffect, useMemo, useRef, useState } from 'react'
import { BottomBar } from '../components/BottomBar'
import { CouncilToken, DbTokens, FieldToken, Sentence } from '../components/ConfigSentence'
import { Phase1Card } from '../components/Phase1Card'
import { QuestionCards, type CardBadge } from '../components/QuestionCards'
import { StageDetail } from '../components/StageDetail'
import { StageLine } from '../components/StageLine'
import { Card, EmptyState, Eyebrow } from '../components/ui'
import { TYPE_STYLE, cx } from '../components/styles'
import { useData } from '../data/context'
import { useQuestions } from '../data/detail'
import type { QuestionDetail } from '../data/detailSchema'
import type { QuestionIndexRow } from '../data/schema'
import { subcatIndex } from '../data/selectors'
import { defaultStop, replaySteps, stopState } from '../data/stageView'
import { useReplay } from '../replay/useReplay'
import { useApp } from '../state/app'
import { useSelection } from '../state/useSelection'

const badge = (r: QuestionIndexRow): CardBadge[] =>
  r.outcome === 'accepted' ? [{ tone: 'ok', text: '✓ accepted' }] : [{ tone: 'ko', text: `✗ rejected · ${r.rejected_at_stage === 0 ? 'pre-check' : `stage ${r.rejected_at_stage}`}` }]

const article = (word: string | null) => (word && /^[aeiou]/i.test(word) ? 'an' : 'a')

/** The replay of one candidate: phase 1, then the line of the stages with the detail of the chosen stop. */
function Trace({ q, onStepWithoutQuestion }: { q: QuestionDetail | undefined; onStepWithoutQuestion: () => boolean }) {
  const d = useData()
  const present = useApp((s) => s.present)
  const steps = useMemo(() => (q ? replaySteps(q) : []), [q])
  const replay = useReplay(steps.length, { atEnd: !present, intercept: (direction) => direction > 0 && onStepWithoutQuestion() })
  const [picked, setPicked] = useState<number | null>(null)
  const reached = replay.reached
  const phase2 = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    setPicked(null)
    // in presentation keep the stage just reached on screen
    if (present) phase2.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [reached, present])

  if (!q)
    return (
      <>
        <div className="flex-1" />
        <BottomBar replay={replay} />
      </>
    )

  const done = replay.state.status === 'done'
  const running = replay.state.status === 'running'
  const stepOf = (stage: number) => steps.findIndex((s) => s.kind === 'stage' && s.stage === stage)
  // a stage that is no step (not reached by the question) is drawn only once the replay is over
  const shown = (stage: number) => (stepOf(stage) >= 0 ? replay.status(stepOf(stage)) === 'done' : !present && done)
  const lastShown = [...steps].reverse().find((s, i) => s.kind === 'stage' && replay.status(steps.length - 1 - i) === 'done')
  const anyStage = lastShown !== undefined
  const stop = picked ?? (done ? defaultStop(q) : lastShown?.kind === 'stage' ? lastShown.stage : null)
  const stage = stop !== null ? d.validation_stages.find((s) => s.id === stop) : undefined
  const rejected = d.validation_stages.find((s) => s.id === q.rejected_at_stage)
  const next = steps[reached]

  return (
    <>
      <div className={cx('flex flex-1 flex-col gap-4 px-8 pb-5', present && !anyStage && 'mx-auto mt-[5vh] w-[min(100%,66rem)]')}>
        <Card className="p-4 transition-all duration-500">
          <Eyebrow className="mb-3">Phase 1 · Category-aware generation of the NLQ object</Eyebrow>
          <Phase1Card q={q} status={(i) => replay.status(i)} thinking={running} compact={present && anyStage && !done} />
        </Card>
        {(anyStage || !present) && (
          <Card className="flex scroll-mb-20 flex-col gap-4 p-4">
            <div ref={phase2} className="flex flex-wrap items-center justify-between gap-3">
              <Eyebrow>Phase 2 · Multi-stage validation</Eyebrow>
              {done && (
                <span role="status" className={cx('rounded-full border px-3 py-1 text-[0.88rem] font-semibold', q.outcome === 'accepted' ? 'border-answerable bg-answerable-soft text-answerable' : 'border-fail bg-fail-soft text-fail')}>
                  {q.outcome === 'accepted' ? '✓ Accepted: enters the benchmark' : `✗ Rejected at ${rejected?.pre_check ? 'the' : `stage ${q.rejected_at_stage}:`} ${rejected?.name ?? ''}`}
                </span>
              )}
            </div>
            <StageLine stages={d.validation_stages} state={(id) => stopState(q, id, shown(id))} selected={stop} onSelect={setPicked} />
            {stage && <StageDetail q={q} stage={stage} collection={q.id ? (d.question_index?.find((r) => r.id === q.id)?.collection ?? '') : ''} />}
            {running && next?.kind === 'stage' && <p className="text-[0.85rem] text-ink-3">Stage {next.stage} is running…</p>}
          </Card>
        )}
      </div>
      <BottomBar replay={replay} />
    </>
  )
}

export function GenerateValidate() {
  const d = useData()
  const present = useApp((s) => s.present)
  const { sel, rows, set, pending, fillNext } = useSelection('generate')
  const detail = useQuestions(sel)
  const q = detail.status === 'ok' && sel.questionId ? detail.data.flatMap((f) => f.questions).find((x) => x.id === sel.questionId) : undefined
  const type = sel.subcategory ? subcatIndex(d).get(sel.subcategory)?.type : undefined
  const tone = type ? cx(TYPE_STYLE[type].border, TYPE_STYLE[type].bg) : undefined
  const cellChosen = sel.subcategory !== null && sel.style !== null && sel.difficulty !== null

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-col gap-4 px-8 pt-5 pb-4">
        <Card className="px-5 py-3">
          <Eyebrow>
            <span className="font-mono text-accent">1</span> Generate &amp; Validate
          </Eyebrow>
          <Sentence>
            Generate {article(sel.style)} <FieldToken field="style" sel={sel} screen="generate" set={set} placeholder="style" />
            <FieldToken field="difficulty" sel={sel} screen="generate" set={set} placeholder="difficulty" />
            <FieldToken field="subcategory" sel={sel} screen="generate" set={set} placeholder="choose a subcategory" className={tone} /> question on <DbTokens sel={sel} screen="generate" set={set} />, written by{' '}
            <FieldToken field="generator" sel={sel} screen="generate" set={set} placeholder="writer" mono footer="Any LLM can write the questions. This replay shows the models of the recorded run." /> and judged by{' '}
            <span className="whitespace-nowrap">
              <CouncilToken />.
            </span>
          </Sentence>
        </Card>
        {(cellChosen || !present) && rows.length > 0 && <QuestionCards title="Candidates" rows={rows} selectedId={sel.questionId} onSelect={(id) => set('questionId', id)} badge={badge} track filter />}
        {cellChosen && rows.length === 0 && <EmptyState>No recorded questions for this selection yet.</EmptyState>}
        {sel.questionId && detail.status === 'loading' && <p role="status" className="text-ink-3">Loading…</p>}
        {sel.questionId && detail.status === 'missing' && <EmptyState>No recorded questions for this selection yet.</EmptyState>}
        {detail.status === 'invalid' && (
          <EmptyState>
            The file {detail.url} cannot be shown: {detail.issues[0]?.path}: {detail.issues[0]?.message}
          </EmptyState>
        )}
        {sel.questionId && detail.status === 'ok' && !q && <EmptyState>This question is not in its detail file.</EmptyState>}
      </div>
      <Trace key={q?.id ?? 'none'} q={q} onStepWithoutQuestion={() => (pending !== null ? fillNext() : false)} />
    </div>
  )
}
