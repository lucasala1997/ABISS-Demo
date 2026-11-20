import { useState, type ReactNode } from 'react'
import { Card, Eyebrow } from '../components/ui'
import { cx } from '../components/styles'
import { useData } from '../data/context'

const METRICS = [
  { key: 'ex_ans', label: 'EX ans.' },
  { key: 'ex_amb', label: 'EX amb.' },
  { key: 'fb', label: 'FB unans.' },
  { key: 'air', label: 'AIR amb.' },
] as const

const n = (x: number) => x.toLocaleString('en-US')

function Bar({ label, value, text }: { label: ReactNode; value: number; text: string }) {
  return (
    <div className="grid grid-cols-[12.5rem_minmax(0,1fr)_auto] items-center gap-3 text-[0.85rem]">
      <span className="text-ink-2">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-sm bg-surface-2">
        <div className="h-full rounded-sm bg-accent" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="min-w-28 text-right font-mono text-[0.8rem] whitespace-nowrap tabular-nums">{text}</span>
    </div>
  )
}

const Source = ({ children }: { children: ReactNode }) => <p className="mt-3 border-t border-line pt-2 text-[0.75rem] leading-snug text-ink-3">Source: {children}</p>

/** The numbers of the paper, and what each stage removed in the run the demo shows. Every block says where it comes from. */
export function PaperResults() {
  const d = useData()
  const { ablation, dataset_sizes, simulator_audit, source } = d.paper_results
  const collections = d.collections ?? []
  const nameOf = (key: string) => `ABISS-${collections.find((c) => c.id.toLowerCase() === key.toLowerCase())?.name ?? key}`
  const datasets = Object.keys(ablation)
  const metricsOf = (ds: string) => METRICS.filter((m) => Object.values(ablation[ds]).length > 0 && Object.values(ablation[ds]).every((r) => r[m.key] !== undefined))
  const best = (ds: string, key: (typeof METRICS)[number]['key']) => Math.max(...Object.values(ablation[ds]).map((r) => r[key] ?? -Infinity))

  const withCounts = collections.filter((c) => d.validation_stages.some((s) => s.run_counts?.[c.id]))
  const [collection, setCollection] = useState(withCounts[0]?.id ?? '')
  const stages = d.validation_stages.filter((s) => (s.run_counts?.[collection]?.checked_records ?? 0) > 0)

  return (
    <div className="flex flex-col gap-5 px-8 py-6">
      <header className="max-w-4xl">
        <h1 className="text-[1.7rem] leading-tight font-semibold tracking-tight">Paper results</h1>
        <p className="mt-1 text-[1rem] leading-snug text-ink-2">Averaged over the evaluated systems. EX: execution accuracy · FB: feedback accuracy · AIR: answer incorporation rate.</p>
      </header>

      <Card className="p-4" data-shot="results-table">
        <table className="w-full border-collapse text-[0.92rem]">
          <thead>
            <tr>
              <th />
              {datasets.map((ds) => (
                <th key={ds} colSpan={metricsOf(ds).length} className="border-b-2 border-ink px-3 pb-1.5 text-center font-semibold">
                  {nameOf(ds)}
                  {dataset_sizes?.[`abiss_${ds}`] !== undefined && <span className="font-normal text-ink-2"> · {n(dataset_sizes[`abiss_${ds}`])} questions</span>}
                </th>
              ))}
            </tr>
            <tr className="text-left text-[0.78rem] text-ink-3">
              <th className="py-1.5 pr-3 font-medium">Category mode</th>
              {datasets.flatMap((ds, i) =>
                metricsOf(ds).map((m, j) => (
                  <th key={`${ds}-${m.key}`} className={cx('px-3 py-1.5 text-right font-medium', i > 0 && j === 0 && 'pl-10')}>{m.label}</th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {d.category_modes.map((mode) => (
              <tr key={mode.id} className="border-t border-line">
                <td className="py-2 pr-3 font-medium">{mode.label}</td>
                {datasets.flatMap((ds, i) =>
                  metricsOf(ds).map((m, j) => {
                    const v = ablation[ds][mode.id]?.[m.key]
                    return (
                      <td key={`${ds}-${m.key}`} className={cx('px-3 py-2 text-right font-mono tabular-nums', i > 0 && j === 0 && 'pl-10', v !== undefined && v === best(ds, m.key) && 'font-bold text-ink')}>
                        {v !== undefined ? v.toFixed(1) : '—'}
                      </td>
                    )
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <Source>{source}</Source>
      </Card>

      <div className="grid grid-cols-2 items-start gap-4">
        {simulator_audit && (
          <Card className="p-4" data-shot="audit">
            <Eyebrow className="mb-3">Simulated user audit</Eyebrow>
            <div className="flex flex-col gap-2">
              {Object.entries(simulator_audit).map(([k, v]) => (
                <Bar key={k} label={k.replace(/_/g, ' ')} value={v} text={`${v.toFixed(1)}%`} />
              ))}
            </div>
            <Source>{source}</Source>
          </Card>
        )}
        {stages.length > 0 && (
          <Card className="p-4" data-shot="rejections">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Rejected by validation</Eyebrow>
              {withCounts.length > 1 && (
                <div className="flex gap-1">
                  {withCounts.map((c) => (
                    <button key={c.id} onClick={() => setCollection(c.id)} aria-pressed={c.id === collection} className={cx('rounded-md border px-2 py-0.5 text-[0.8rem]', c.id === collection ? 'border-accent bg-accent-soft' : 'border-line text-ink-2')}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {stages.map((s) => {
                const c = s.run_counts![collection]
                const rate = (100 * c.removed_records) / c.checked_records
                return <Bar key={s.id} label={`${s.pre_check ? '' : `${s.id} · `}${s.name}`} value={rate} text={`${rate.toFixed(1)}% · ${n(c.removed_records)} of ${n(c.checked_records)}`} />
              })}
            </div>
            <p className="mt-2 text-[0.78rem] text-ink-3">Counts are records: each interpretation of an ambiguous question is one record. A stage checks only the records of the types it applies to.</p>
            <Source>{collections.find((c) => c.id === collection)?.source}</Source>
          </Card>
        )}
      </div>
    </div>
  )
}
