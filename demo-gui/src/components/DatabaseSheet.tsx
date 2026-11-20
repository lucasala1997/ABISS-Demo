import * as Dialog from '@radix-ui/react-dialog'
import { KeyRound, Link2, X } from 'lucide-react'
import { useData } from '../data/context'
import type { Table } from '../data/schema'
import { dbById } from '../data/selectors'
import { useApp } from '../state/app'
import { SqlBlock } from './SqlBlock'
import { Eyebrow } from './ui'

const cell = (v: string | number | null) => (v === null ? 'NULL' : String(v))

function TableBlock({ t }: { t: Table }) {
  const fk = (column: string) => t.foreign_keys?.find((f) => f.column === column)
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <h3 className="font-mono text-[0.92rem] font-semibold">{t.name}</h3>
      <ul className="flex flex-col gap-0.5 text-[0.8rem]">
        {t.columns.map((c) => {
          const ref = fk(c.name)
          return (
            <li key={c.name} className="grid grid-cols-[1rem_minmax(0,14rem)_minmax(0,1fr)] items-baseline gap-x-2">
              <span className="self-center">{c.pk ? <KeyRound aria-label="primary key" className="size-3 text-ambiguous" /> : ref ? <Link2 aria-label="foreign key" className="size-3 text-accent" /> : null}</span>
              <span className="min-w-0 font-mono break-words text-ink">
                {c.name} {c.type && <span className="text-[0.7rem] text-ink-3">{c.type}</span>}
                {ref && <span className="block text-[0.7rem] text-accent">→ {ref.ref_table}.{ref.ref_column}</span>}
              </span>
              <span className="min-w-0 text-ink-2">{c.description}</span>
            </li>
          )
        })}
      </ul>
      {t.sample_rows && t.sample_rows.rows.length > 0 && (
        <div className="flex flex-col gap-1">
          <Eyebrow>First {t.sample_rows.rows.length} rows, as shown to the models</Eyebrow>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-max min-w-full border-collapse font-mono text-[0.72rem]">
              <thead>
                <tr className="bg-surface-2 text-left text-ink-2">
                  {t.sample_rows.columns.map((c) => (
                    <th key={c} className="px-2 py-1 font-semibold whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.sample_rows.rows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {r.map((v, j) => (
                      <td key={j} className={v === null ? 'px-2 py-1 text-ink-3' : 'max-w-72 truncate px-2 py-1 text-ink'} title={cell(v)}>{cell(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {t.create_sql && (
        <details>
          <summary className="cursor-pointer text-[0.78rem] font-medium text-ink-2">CREATE TABLE statement</summary>
          <SqlBlock sql={t.create_sql} className="mt-1.5" />
        </details>
      )}
    </section>
  )
}

/** The database a question is generated or asked on: what the models read about it in the prompts. Open from every screen. */
export function DatabaseSheet() {
  const d = useData()
  const id = useApp((s) => s.dbSheet)
  const close = useApp((s) => s.closeDb)
  const db = id ? dbById(d, id) : undefined
  return (
    <Dialog.Root open={id !== null} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
        <Dialog.Content className="fixed top-0 right-0 z-50 flex h-full w-[min(760px,100vw)] flex-col gap-3 overflow-y-auto border-l border-line bg-bg p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Dialog.Title className="font-mono text-lg font-semibold">{id}</Dialog.Title>
              <Dialog.Description className="text-[0.85rem] text-ink-2">
                {db ? `${db.dataset} · ${db.tables.length} tables. ` : ''}What the models read about this database: tables, columns, field descriptions and first rows.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="grid size-8 place-items-center rounded-md hover:bg-surface-2">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {db?.tables.map((t) => <TableBlock key={t.name} t={t} />)}
          {(!db || !db.tables.length) && <p className="rounded-lg border border-dashed border-line-strong p-4 text-center text-[0.9rem] text-ink-3">Tables not imported yet for this database.</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
