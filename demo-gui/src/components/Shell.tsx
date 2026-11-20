import { Columns4, LayoutGrid, MessagesSquare, Presentation, RotateCcw, Table2, Workflow } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { useData } from '../data/context'
import { useApp } from '../state/app'
import { DatabaseSheet } from './DatabaseSheet'
import { cx } from './styles'

const NAV = [
  { to: '/', label: 'Overview', n: null, Icon: LayoutGrid },
  { to: '/generate', label: 'Generate & Validate', n: 1, Icon: Workflow },
  { to: '/benchmark', label: 'Benchmarking', n: 2, Icon: MessagesSquare },
  { to: '/modes', label: 'Four Modes', n: 3, Icon: Columns4 },
  { to: '/results', label: 'Paper Results', n: null, Icon: Table2 },
] as const

function SideButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.85rem] font-medium transition-colors',
        active ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

function CursorHalo() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const on = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', on)
    return () => window.removeEventListener('pointermove', on)
  }, [])
  if (!pos) return null
  return <div className="cursor-halo" style={{ left: pos.x, top: pos.y }} aria-hidden />
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation()
  const s = useApp()
  const d = useData()
  return (
    <div className="grid min-h-screen grid-cols-[auto_minmax(0,1fr)]">
      <aside className={cx('sticky top-0 flex h-screen self-start flex-col gap-4 border-r border-line bg-surface px-3 py-4', s.present ? 'w-56' : 'w-60')}>
        <div className="px-2">
          <div className="text-[1.45rem] leading-none font-bold tracking-tight">ABISS</div>
          <div className="mt-1 text-[0.75rem] leading-snug text-ink-3">Text-to-SQL on answerable, ambiguous and unanswerable questions</div>
        </div>
        <nav aria-label="Screens" className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = loc === n.to
            return (
              <Link
                key={n.to}
                href={n.to}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'group flex items-center gap-2.5 rounded-lg px-2 py-2 text-[0.92rem] font-medium transition-colors',
                  active ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                <span
                  className={cx(
                    'grid size-6 place-items-center rounded-md font-mono text-[0.75rem] font-semibold',
                    active ? 'bg-accent text-surface' : 'bg-surface-2 text-ink-2',
                  )}
                >
                  {n.n ?? <n.Icon className="size-3.5" aria-hidden />}
                </span>
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <SideButton label="Presentation (P)" onClick={s.togglePresent} active={s.present}>
            <Presentation className="size-4" aria-hidden />
          </SideButton>
          <SideButton label="Reset demo" onClick={s.resetDemo}>
            <RotateCcw className="size-4" aria-hidden />
          </SideButton>
          {s.dev && <div className="px-2 pt-1 font-mono text-[0.65rem] text-ink-3">data v{d.meta.schema_version}</div>}
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
      <DatabaseSheet />
      {s.present && <CursorHalo />}
    </div>
  )
}

export function ScreenHeader({ step, title, lead, right }: { step?: number; title: string; lead: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-bg/90 px-8 pt-6 pb-4 backdrop-blur">
      <div className="max-w-3xl">
        <h1 className="flex items-baseline gap-2.5 text-[1.6rem] leading-tight font-semibold tracking-tight">
          {step !== undefined && <span className="font-mono text-[1.1rem] text-accent">{step}</span>}
          {title}
        </h1>
        <p className="mt-1 text-[0.98rem] leading-snug text-ink-2">{lead}</p>
      </div>
      {right}
    </header>
  )
}
