import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, List, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useData } from '../data/context'
import type { QuestionIndexRow } from '../data/schema'
import { shortModel } from '../data/selectors'
import { trackStates } from '../data/stageView'
import { Segmented } from './ui'
import { cx } from './styles'

export interface CardBadge {
  tone: 'ok' | 'ko' | 'none'
  text: string
}

const CARD_W = 248
const GAP = 10
const TONE = { ok: 'border-answerable bg-answerable-soft text-answerable', ko: 'border-fail bg-fail-soft text-fail', none: 'border-line bg-surface-2 text-ink-3' }

function Badges({ badges }: { badges: CardBadge[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((b, i) => (
        <span key={i} className={cx('rounded-full border px-2 py-px text-[0.72rem] font-semibold whitespace-nowrap', TONE[b.tone])}>
          {b.text}
        </span>
      ))}
    </span>
  )
}

/** The ten stages of a candidate as notches: passed, not applicable, failed (red), not reached. */
function Track({ row }: { row: QuestionIndexRow }) {
  const d = useData()
  return (
    <span className="flex gap-0.5" aria-hidden>
      {trackStates(row, d.validation_stages).map((s, i) => (
        <i key={i} className={cx('h-1.5 flex-1 rounded-sm', s === 'pass' ? 'bg-ink' : s === 'fail' ? 'bg-fail' : s === 'skipped' ? 'hatched bg-surface-2' : 'border border-dashed border-line-strong')} />
      ))}
    </span>
  )
}

/**
 * The questions that match the filters, as cards in a row. The header says how many there are and which are on screen,
 * the arrows move through them, and "All N" opens the whole list with a search.
 */
export function QuestionCards({
  title,
  rows,
  selectedId,
  onSelect,
  badge,
  track,
  filter,
}: {
  title: string
  rows: QuestionIndexRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  badge: (row: QuestionIndexRow) => CardBadge[]
  /** the ten notches of the validation, and the whole card green or red */
  track?: boolean
  /** all / accepted / rejected */
  filter?: boolean
}) {
  const [show, setShow] = useState<'all' | 'accepted' | 'rejected'>('all')
  const [start, setStart] = useState(0)
  const [perPage, setPerPage] = useState(4)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const strip = useRef<HTMLDivElement | null>(null)
  const shown = useMemo(() => (show === 'all' ? rows : rows.filter((r) => r.outcome === show)), [rows, show])

  useEffect(() => {
    const el = strip.current
    if (!el) return
    const measure = () => setPerPage(Math.max(1, Math.floor((el.clientWidth + GAP) / (CARD_W + GAP))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // keep the chosen card on screen
  const at = shown.findIndex((r) => r.id === selectedId)
  const first = Math.min(at >= 0 && (at < start || at >= start + perPage) ? at - (at % perPage) : start, Math.max(0, shown.length - 1))
  useEffect(() => {
    if (first !== start) setStart(first)
  }, [first, start])

  const page = shown.slice(first, first + perPage)
  const found = query.trim() ? shown.filter((r) => `${r.nlq} ${r.db_id} ${r.generator_model ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) : shown
  const arrow = 'grid size-7 place-items-center rounded-md border border-line text-ink-2 hover:border-line-strong disabled:opacity-35'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[0.8rem] text-ink-2">
          <span className="text-[0.72rem] font-semibold tracking-[0.08em] text-ink-3 uppercase">{title}</span>
          <span className="tabular-nums" aria-live="polite">
            {shown.length ? `${first + 1}–${Math.min(first + perPage, shown.length)} of ${shown.length.toLocaleString('en-US')}` : '0'}
          </span>
          <button aria-label="Previous" className={arrow} disabled={first === 0} onClick={() => setStart(Math.max(0, first - perPage))}>
            <ChevronLeft className="size-4" />
          </button>
          <button aria-label="Next" className={arrow} disabled={first + perPage >= shown.length} onClick={() => setStart(first + perPage)}>
            <ChevronRight className="size-4" />
          </button>
          <button onClick={() => setOpen(true)} disabled={!shown.length} className="flex items-center gap-1 rounded-md border border-line px-2 py-1 font-medium hover:border-line-strong disabled:opacity-35">
            <List className="size-3.5" aria-hidden /> All {shown.length.toLocaleString('en-US')}
          </button>
        </div>
        {filter && (
          <Segmented
            label="Outcome"
            value={show}
            onChange={(v) => {
              setShow(v)
              setStart(0)
            }}
            options={[
              { value: 'all', label: 'all' },
              { value: 'accepted', label: 'accepted' },
              { value: 'rejected', label: 'rejected' },
            ]}
          />
        )}
      </div>
      <div ref={strip} className="flex overflow-hidden" style={{ gap: GAP }}>
        {page.map((r) => (
          <QuestionCard key={r.id} row={r} selected={r.id === selectedId} onSelect={onSelect} badges={badge(r)} track={track} />
        ))}
      </div>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
          <Dialog.Content className="fixed top-[8vh] left-1/2 z-50 flex max-h-[84vh] w-[min(880px,94vw)] -translate-x-1/2 flex-col gap-3 rounded-xl border border-line bg-bg p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <Dialog.Title className="text-lg font-semibold">
                {title}: {found.length.toLocaleString('en-US')}
              </Dialog.Title>
              <Dialog.Close aria-label="Close" className="grid size-8 place-items-center rounded-md hover:bg-surface-2">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Every question that matches the filters. Choose one to open it.</Dialog.Description>
            <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5">
              <Search className="size-4 text-ink-3" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the questions…" aria-label="Search the questions" className="min-w-0 flex-1 bg-transparent text-[0.92rem] outline-none placeholder:text-ink-3" />
            </label>
            <ul className="flex flex-col gap-1 overflow-y-auto pr-1">
              {found.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      onSelect(r.id)
                      setOpen(false)
                    }}
                    aria-pressed={r.id === selectedId}
                    className={cx('flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left hover:border-line-strong', r.id === selectedId ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}
                  >
                    <span className="w-44 shrink-0">
                      <Badges badges={badge(r)} />
                    </span>
                    <span className="min-w-0 flex-1 text-[0.88rem] text-ink">{r.nlq}</span>
                    <span className="shrink-0 text-right font-mono text-[0.72rem] text-ink-3">
                      {r.db_id}
                      {r.generator_model && <br />}
                      {r.generator_model && shortModel(r.generator_model)}
                    </span>
                  </button>
                </li>
              ))}
              {!found.length && <li className="p-4 text-center text-[0.9rem] text-ink-3">No question matches the search.</li>}
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

function QuestionCard({ row, selected, onSelect, badges, track }: { row: QuestionIndexRow; selected: boolean; onSelect: (id: string) => void; badges: CardBadge[]; track?: boolean }): ReactNode {
  const tint = track ? (row.outcome === 'accepted' ? 'border-answerable bg-answerable-soft/70' : 'border-fail bg-fail-soft/70') : 'border-line bg-surface'
  return (
    <button
      onClick={() => onSelect(row.id)}
      aria-pressed={selected}
      style={{ flex: `0 0 ${CARD_W}px` }}
      className={cx('flex flex-col gap-1.5 rounded-[10px] border px-2.5 py-2 text-left text-[0.82rem] transition-shadow', tint, selected ? 'ring-[3px] ring-accent' : 'hover:shadow-card')}
    >
      <Badges badges={badges} />
      <span className="line-clamp-2 min-h-[2.5em] text-ink">{row.nlq}</span>
      {row.generator_model && <span className="truncate font-mono text-[0.68rem] text-ink-2">written by {shortModel(row.generator_model)}</span>}
      {track && <Track row={row} />}
    </button>
  )
}
