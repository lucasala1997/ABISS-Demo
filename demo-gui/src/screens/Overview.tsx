import { motion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { BottomBar } from '../components/BottomBar'
import { TaxonomyTree } from '../components/TaxonomyTree'
import { Card, Eyebrow, TypeChip } from '../components/ui'
import { cx } from '../components/styles'
import { useData } from '../data/context'
import { useDialogues } from '../data/detail'
import { resolveSelection } from '../data/questions'
import type { Turn } from '../data/schema'
import { dbById, subcatIndex } from '../data/selectors'
import { useReplay } from '../replay/useReplay'
import { useApp } from '../state/app'

const n = (x: number) => x.toLocaleString('en-US')
const words = (s: string) => s.replace(/_/g, ' ')

function Act({ number, title, drawing, children, accent }: { number: string; title: string; drawing: ReactNode; children: ReactNode; accent?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cx('flex flex-col gap-2.5 rounded-2xl border bg-surface p-4.5 shadow-card', accent ? 'border-accent' : 'border-line')}>
      <div className="text-[2.4rem] leading-none font-bold text-accent">{number}</div>
      <h3 className="text-[1.15rem] font-semibold">{title}</h3>
      <div className="flex min-h-40 flex-col justify-center gap-2 rounded-xl border border-line bg-surface-2/70 p-3">{drawing}</div>
      <p className="text-[0.9rem] leading-snug text-ink-2">{children}</p>
    </motion.div>
  )
}

const Pill = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cx('rounded-md border border-line bg-surface px-2 py-0.5 text-[0.8rem]', className)}>{children}</span>
const Down = ({ label }: { label: string }) => <div className="text-center text-[0.8rem] text-ink-3">↓ {label}</div>

/** One element of a drawing; in presentation the elements of an act come in one after the other. */
function Seq({ i, children }: { i: number; children: ReactNode }) {
  const present = useApp((s) => s.present)
  return (
    <motion.div initial={present ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: present ? 0.25 + i * 0.6 : 0, duration: 0.35 }}>
      {children}
    </motion.div>
  )
}

const turnText = (t: Turn) => (t.role === 'agent' ? (t.text ?? t.sql ?? '') : t.text)

export function Overview() {
  const d = useData()
  const present = useApp((s) => s.present)
  const openDb = useApp((s) => s.openDb)
  const replay = useReplay(5, { atEnd: !present })
  const show = (i: number) => replay.status(i) === 'done'

  const collections = d.collections ?? []
  const [collection, setCollection] = useState(() => collections.find((c) => c.status === 'replay')?.id ?? '')
  const index = useMemo(() => (d.question_index ?? []).filter((r) => r.run !== 'legacy'), [d])
  const inCollection = index.filter((r) => r.collection === collection)
  const example = index.find((r) => r.id === d.demo_defaults?.generate) ?? index[0]
  const stages = d.validation_stages.filter((s) => !s.pre_check)

  // act 3: the first turns of the dialogue the Benchmarking screen opens on
  const benchSel = useMemo(() => resolveSelection(d, {}, 'benchmark', true), [d])
  const dialogues = useDialogues(benchSel)
  const dialogue = dialogues.status === 'ok' ? dialogues.data.flatMap((f) => f.dialogues).find((q) => q.question_id === benchSel.questionId) : undefined
  const run = dialogue?.runs.find((r) => r.mode === benchSel.mode && r.meaning === 0) ?? dialogue?.runs[0]

  const databases = [...new Set((d.question_index ?? []).filter((r) => r.collection === collection).map((r) => r.db_id))].sort()

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col gap-5 px-8 py-6">
        <header className="max-w-4xl">
          <h1 className="text-[1.7rem] leading-tight font-semibold tracking-tight">A benchmark built on your database</h1>
          <p className="mt-1 text-[1rem] leading-snug text-ink-2">Any organisation can bring the schema and data of its databases and get questions that test Text-to-SQL systems on its own needs.</p>
        </header>

        <div className="grid grid-cols-3 gap-4" data-shot="acts">
          {show(0) && (
            <Act
              number="①"
              title="Bring your database"
              drawing={
                <>
                  {d.overview?.input_formats && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {d.overview.input_formats.items.map((f) => (
                        <Pill key={f} className="font-mono">{f}</Pill>
                      ))}
                      <Pill>field descriptions</Pill>
                    </div>
                  )}
                  <Down label="parser" />
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <Pill className="font-medium">executable database</Pill>
                    <Pill className="font-medium">schema as text for the prompts</Pill>
                  </div>
                </>
              }
            >
              Schema, field descriptions and data. The pipeline runs SQL on the database, read-only, and shows the models each table's definition, its field descriptions and its first five rows.
            </Act>
          )}
          {show(1) && (
            <Act
              number="②"
              title="Generate & validate questions"
              drawing={
                <>
                  {example && (
                    <Seq i={0}>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <TypeChip type={example.type} size="sm">{subcatIndex(d).get(example.subcategory)?.sub.name}</TypeChip>
                        <Pill>{example.style}</Pill>
                        <Pill>{words(example.requested_difficulty)}</Pill>
                      </div>
                    </Seq>
                  )}
                  <Seq i={1}>
                    <Down label="writer LLM · question, then SQL" />
                  </Seq>
                  <Seq i={2}>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {[stages[0], stages[1], stages[2]].filter(Boolean).map((s) => (
                        <span key={s.id} className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[0.7rem] font-bold text-surface">{s.id}</span>
                      ))}
                      <span className="text-ink-3">…</span>
                      {stages.at(-1) && <span className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[0.7rem] font-bold text-surface">{stages.at(-1)!.id}</span>}
                      <span className="ml-1.5 rounded-full border border-answerable bg-answerable-soft px-2 py-px text-[0.75rem] font-semibold text-answerable">✓ in the benchmark</span>
                    </div>
                  </Seq>
                </>
              }
            >
              An LLM writes a question of a given subcategory, style and difficulty with its SQL. {stages.length} stages, mostly judged by a council of {d.models.council.length} LLMs, filter it.
              {inCollection.length > 0 && (
                <span className="mt-1 block font-semibold text-ink">
                  {collections.find((c) => c.id === collection)?.name}: {n(inCollection.length)} written · {n(inCollection.filter((r) => r.outcome === 'accepted').length)} accepted
                </span>
              )}
            </Act>
          )}
          {show(2) && (
            <Act
              number="③"
              title="Benchmark systems in dialogue"
              accent
              drawing={
                dialogue && run ? (
                  <>
                    {[{ who: 'user', text: dialogue.question.nlq }, ...run.turns.slice(0, 2).map((t) => ({ who: t.role === 'agent' ? 'system' : 'user', text: turnText(t) }))].map((m, i) => (
                      <Seq key={i} i={i}>
                        <div className={cx('max-w-[88%] rounded-lg border px-2.5 py-1.5 text-[0.8rem] leading-snug', m.who === 'user' ? 'ml-auto border-line bg-surface' : 'border-accent/40 bg-accent-soft/60')}>
                          <span className="line-clamp-2">{m.text}</span>
                        </div>
                      </Seq>
                    ))}
                  </>
                ) : (
                  <div className="text-center text-[0.85rem] text-ink-3">question → clarification → reply → SQL</div>
                )
              }
            >
              The system can ask, answer with SQL or explain why it cannot. A simulated user who knows the hidden intent replies.
            </Act>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_26rem] items-start gap-4">
          {show(3) ? (
            <Card className="flex flex-col gap-3 p-4" data-shot="taxonomy">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Eyebrow>Taxonomy of questions</Eyebrow>
                {d.overview?.taxonomy_origin && <span className="max-w-xl text-right text-[0.8rem] text-ink-3">{d.overview.taxonomy_origin.text}</span>}
              </div>
              <TaxonomyTree />
            </Card>
          ) : (
            <div />
          )}
          {show(4) && (
            <Card className="flex flex-col gap-3 p-4" data-shot="databases">
              <Eyebrow>Databases</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => c.status === 'replay' && setCollection(c.id)}
                    aria-pressed={c.id === collection}
                    aria-disabled={c.status !== 'replay'}
                    className={cx('rounded-md border px-2.5 py-1 text-[0.85rem] font-medium', c.id === collection ? 'border-accent bg-accent-soft text-ink' : c.status === 'replay' ? 'border-line text-ink-2 hover:border-line-strong' : 'cursor-not-allowed border-dashed border-line text-ink-3')}
                  >
                    {c.name}
                    <span className="ml-1.5 text-[0.75rem] font-normal text-ink-3">{c.status === 'replay' ? `${c.n_databases} databases` : 'results only'}</span>
                  </button>
                ))}
              </div>
              <table className="w-full text-[0.85rem]">
                <thead>
                  <tr className="text-left text-[0.72rem] tracking-wide text-ink-3 uppercase">
                    <th className="py-1 font-semibold">database</th>
                    <th className="py-1 text-right font-semibold">tables</th>
                    <th className="py-1 text-right font-semibold">written</th>
                    <th className="py-1 text-right font-semibold">accepted</th>
                  </tr>
                </thead>
                <tbody>
                  {databases.map((id) => {
                    const rows = inCollection.filter((r) => r.db_id === id)
                    return (
                      <tr key={id} onClick={() => openDb(id)} className="cursor-pointer border-t border-line hover:bg-accent-soft/50">
                        <td className="py-1.5 font-mono text-[0.8rem] text-accent">{id}</td>
                        <td className="py-1.5 text-right tabular-nums">{dbById(d, id)?.tables.length || '—'}</td>
                        <td className="py-1.5 text-right tabular-nums">{n(rows.length)}</td>
                        <td className="py-1.5 text-right tabular-nums">{n(rows.filter((r) => r.outcome === 'accepted').length)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
      {/* in presentation the parts come in one per step: the bar shows where the talk is, and steps with a click too */}
      {present && <BottomBar replay={replay} />}
    </div>
  )
}
