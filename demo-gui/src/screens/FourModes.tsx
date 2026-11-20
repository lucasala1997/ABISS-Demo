import { EyeOff } from 'lucide-react'
import { useMemo } from 'react'
import { BottomBar } from '../components/BottomBar'
import { ChatTurns } from '../components/ChatTurns'
import { DbTokens, FieldToken, Sentence, Token } from '../components/ConfigSentence'
import { Card, EmptyState, Eyebrow, Segmented } from '../components/ui'
import { TYPE_STYLE, cx } from '../components/styles'
import { useData } from '../data/context'
import { useDialogues } from '../data/detail'
import type { QuestionDialogues } from '../data/detailSchema'
import { findQuestion, runOutcome } from '../data/dialogues'
import { outcomes, type Selection } from '../data/questions'
import type { QuestionIndexRow } from '../data/schema'
import { agentById, shortModel, subcatIndex } from '../data/selectors'
import { useReplay } from '../replay/useReplay'
import { useApp } from '../state/app'
import { useSelection } from '../state/useSelection'

const TIMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']
const OUTCOME = { ok: 'border-answerable bg-answerable-soft text-answerable', ko: 'border-fail bg-fail-soft text-fail', none: 'border-line text-ink-3' }

/** The same question in every category mode, side by side: step k of the replay shows the first k turns of each column. */
function Columns({ q, sel, subcategory, onStep }: { q: QuestionDialogues | undefined; sel: Selection; subcategory: string | null; onStep: () => boolean }) {
  const d = useData()
  const present = useApp((s) => s.present)
  const runs = useMemo(() => d.category_modes.map((m) => ({ mode: m, run: q?.runs.find((r) => r.system === sel.system && r.mode === m.id && r.meaning === sel.meaning) })), [d, q, sel.system, sel.meaning])
  const longest = Math.max(0, ...runs.map((r) => r.run?.turns.length ?? 0))
  const replay = useReplay(q ? longest + 1 : 0, { atEnd: !present, intercept: (direction) => direction > 0 && onStep() })
  if (!q)
    return (
      <>
        <div className="flex-1" />
        <BottomBar replay={replay} />
      </>
    )
  const system = shortModel(agentById(d, sel.system ?? '')?.name ?? sel.system ?? '')
  const idx = subcatIndex(d)
  return (
    <>
      <div className="grid flex-1 grid-cols-4 items-start gap-3 px-8 pb-5 max-[1000px]:grid-cols-2" data-shot="modes-columns">
        {runs.map(({ mode, run }) => {
          const shown = Math.min(replay.reached, run?.turns.length ?? 0)
          const finished = !!run && replay.reached >= run.turns.length && (replay.state.status === 'done' || replay.reached > run.turns.length)
          const outcome = run ? runOutcome(run, q.question.type) : undefined
          const predicted = mode.id === 'predicted' && run ? run.predicted_subcategory : undefined
          const wrong = predicted !== undefined && predicted !== null && predicted !== subcategory
          return (
            <section key={mode.id} aria-label={mode.label} className={cx('flex min-w-0 flex-col gap-2 rounded-xl border bg-surface p-3', mode.id === 'ground_truth' ? 'border-accent ring-2 ring-accent/15' : 'border-line')}>
              <header className="flex flex-col gap-1 border-b border-line pb-2">
                <span className="text-[1rem] font-semibold">{mode.label}</span>
                <span className="text-[0.78rem] text-ink-2">
                  System sees: <span className="text-ink">{mode.system_sees}</span>
                </span>
                {mode.id === 'predicted' &&
                  run &&
                  (predicted ? (
                    <span className={cx('self-start rounded-md border px-1.5 py-0.5 text-[0.75rem] font-semibold', wrong ? 'border-fail bg-fail-soft text-fail' : 'border-line-strong text-ink')}>
                      The system classified it as: {idx.get(predicted)?.sub.name ?? predicted} {wrong ? `✗ (it is ${subcategory ? (idx.get(subcategory)?.sub.name ?? subcategory) : 'another subcategory'})` : '✓'}
                    </span>
                  ) : (
                    <span className="text-[0.75rem] text-ink-3">How the system classified it: not recorded</span>
                  ))}
              </header>
              {run ? <ChatTurns turns={run.turns} shown={shown} system={system} compact thinking={replay.state.status === 'running'} /> : <p className="py-4 text-center text-[0.85rem] text-ink-3">No recorded dialogue in this mode.</p>}
              {finished && outcome && (
                <div role="status" className={cx('rounded-md border px-2 py-1 text-[0.85rem] font-semibold', OUTCOME[outcome.tone])}>
                  {outcome.tone === 'ok' ? '✓' : outcome.tone === 'ko' ? '✗' : ''} {outcome.text}
                  {outcome.reason && <p className="font-normal text-ink-2">{outcome.reason}</p>}
                  {outcome.otherMeaning && <p className="font-normal text-ink-2">{outcome.otherMeaning}</p>}
                </div>
              )}
            </section>
          )
        })}
      </div>
      <BottomBar replay={replay} />
    </>
  )
}

export function FourModes() {
  const d = useData()
  const present = useApp((s) => s.present)
  const { sel, rows, set, pending, fillNext } = useSelection('modes')
  const detail = useDialogues(sel)
  const q = detail.status === 'ok' && sel.questionId ? findQuestion(detail.data, sel.questionId) : undefined
  const row = rows.find((r) => r.id === sel.questionId)
  const type = sel.subcategory ? subcatIndex(d).get(sel.subcategory)?.type : undefined
  const tone = type ? cx(TYPE_STYLE[type].border, TYPE_STYLE[type].bg) : undefined
  const cellChosen = sel.subcategory !== null && sel.style !== null && sel.difficulty !== null
  const marks = (r: QuestionIndexRow) =>
    d.category_modes
      .map((m) => {
        const v = outcomes(r, sel.system, m.id)[Math.min(sel.meaning, r.meanings - 1)]
        return v === null || v === undefined ? '–' : v ? '✓' : '✗'
      })
      .join(' ')
  const meanings = q?.question.meanings ?? []
  const hasRuns = (m: number) => !!q?.runs.some((r) => r.system === sel.system && r.meaning === m)
  const hidden = meanings[sel.meaning]?.hidden_knowledge
  const nothing = (cellChosen || !present) && (rows.length === 0 || (sel.questionId !== null && (detail.status === 'missing' || (detail.status === 'ok' && !q))))

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-col gap-4 px-8 pt-5 pb-4">
        <Card className="px-5 py-3">
          <Eyebrow>
            <span className="font-mono text-accent">3</span> Four category modes
          </Eyebrow>
          <Sentence>
            Ask <FieldToken field="system" sel={sel} screen="modes" set={set} placeholder="system" mono footer="Any Text-to-SQL system can be tested. This replay shows the systems of the recorded run." /> the same{' '}
            <FieldToken field="style" sel={sel} screen="modes" set={set} placeholder="style" />
            <FieldToken field="difficulty" sel={sel} screen="modes" set={set} placeholder="difficulty" />
            <FieldToken field="subcategory" sel={sel} screen="modes" set={set} placeholder="choose a subcategory" className={tone} /> question on <DbTokens sel={sel} screen="modes" set={set} />, {TIMES[d.category_modes.length] ?? d.category_modes.length} times, changing only what it is told about the category.
          </Sentence>
        </Card>
        {(cellChosen || !present) && rows.length > 0 && (
          <Card className="flex flex-col gap-2 px-4 py-3" data-shot="modes-question">
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow>Question</Eyebrow>
              <div className="min-w-0 flex-1 [&_button]:max-w-full [&_button>span:first-child]:truncate">
                <Token
                  label="question"
                  value={sel.questionId}
                  placeholder="choose a question"
                  options={rows.map((r) => ({ value: r.id, label: r.nlq, count: 0, disabled: false, note: marks(r) }))}
                  onChange={(id) => set('questionId', id)}
                  footer={`The marks are the outcome in each mode: ${d.category_modes.map((m) => m.label).join(', ')}.`}
                />
              </div>
              {meanings.length > 1 && (
                <Segmented
                  label="Interpretation"
                  value={String(sel.meaning)}
                  onChange={(v) => set('meaning', v)}
                  options={meanings.map((m, i) => ({ value: String(i), label: m.label ?? `Interpretation ${i + 1}`, disabled: !hasRuns(i), tip: hasRuns(i) ? undefined : 'No recorded dialogue for this interpretation' }))}
                />
              )}
            </div>
            {q && hidden && (
              <p className="flex gap-1.5 text-[0.85rem] text-ink-2">
                <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-semibold">Hidden knowledge, never shown to the system: </span>
                  {hidden}
                </span>
              </p>
            )}
          </Card>
        )}
        {nothing && <EmptyState>No recorded dialogue for this selection yet.</EmptyState>}
        {sel.questionId && detail.status === 'loading' && <p role="status" className="text-ink-3">Loading…</p>}
        {detail.status === 'invalid' && (
          <EmptyState>
            The file {detail.url} cannot be shown: {detail.issues[0]?.path}: {detail.issues[0]?.message}
          </EmptyState>
        )}
      </div>
      <Columns key={`${q?.question_id}|${sel.system}|${sel.meaning}`} q={q} sel={sel} subcategory={row?.subcategory ?? sel.subcategory} onStep={() => (pending !== null ? fillNext() : false)} />
    </div>
  )
}
