import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useData } from '../data/context'
import type { ProvenanceT, RelevancyIdT, TypeIdT } from '../data/schema'
import { useApp } from '../state/app'
import { REL_STYLE, TYPE_STYLE, cx } from './styles'

/* ---------- type colour system: one colour per type, always with label + icon ---------- */

export function TypeChip({ type, size = 'md', children }: { type: TypeIdT; size?: 'sm' | 'md'; children?: ReactNode }) {
  const d = useData()
  const s = TYPE_STYLE[type]
  const label = d.taxonomy.types.find((t) => t.id === type)?.label ?? type
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
        s.text, s.bg, s.border,
        size === 'sm' ? 'px-1.5 py-px text-[0.72rem]' : 'px-2 py-0.5 text-[0.8rem]',
      )}
    >
      <s.Icon aria-hidden className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={2.25} />
      {children ?? label}
    </span>
  )
}

export function RelevancyChip({ label, size = 'md' }: { label: RelevancyIdT; size?: 'sm' | 'md' }) {
  const d = useData()
  const s = REL_STYLE[label]
  const text = d.simulated_user.relevancy_labels.find((l) => l.id === label)?.label ?? label
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border font-semibold whitespace-nowrap',
        s.text, s.bg, s.border,
        size === 'sm' ? 'px-1.5 py-px text-[0.72rem]' : 'px-2 py-0.5 text-[0.8rem]',
      )}
    >
      <s.Icon aria-hidden className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={2.25} />
      {text}
    </span>
  )
}

/* ---------- badges ---------- */

export function DevBadge({ children, title }: { children: ReactNode; title?: string }) {
  const dev = useApp((s) => s.dev)
  if (!dev) return null
  return (
    <span
      title={title}
      className="inline-flex items-center rounded border border-dashed border-fail px-1 py-px font-mono text-[0.62rem] font-semibold tracking-wider text-fail"
    >
      {children}
    </span>
  )
}

export function ProvenanceBadge({ provenance }: { provenance: ProvenanceT }) {
  if (provenance !== 'illustrative') return null
  return <DevBadge title="Hand-written placeholder: replace before paper/video">ILLUSTRATIVE</DevBadge>
}

export function ThinkingPulse({ who, what = 'thinking' }: { who: string; what?: string }) {
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-[0.82rem] text-ink-2">
        <span className="font-medium text-ink">{who}</span>
        <span>{what}</span>
        <span className="inline-flex gap-0.5" aria-hidden>
          <span className="thinking-dot size-1 rounded-full bg-ink-2" />
          <span className="thinking-dot size-1 rounded-full bg-ink-2 [animation-delay:0.15s]" />
          <span className="thinking-dot size-1 rounded-full bg-ink-2 [animation-delay:0.3s]" />
        </span>
      </div>
      <div className="thinking-bar h-2 w-full rounded" />
      <div className="thinking-bar h-2 w-3/4 rounded" />
    </div>
  )
}

/** Dev-only card for slots still marked TO_FILL / traces not available. */
export function PlaceholderCard({ title, detail, path }: { title: string; detail?: string; path?: string }) {
  const dev = useApp((s) => s.dev)
  if (!dev) return null
  return (
    <div className="rounded-lg border border-dashed border-fail bg-fail-soft/60 p-3 text-[0.85rem]">
      <div className="flex items-center gap-2 font-semibold text-fail">
        <TriangleAlert className="size-4" aria-hidden /> {title}
      </div>
      {detail && <p className="mt-1 text-ink-2">{detail}</p>}
      {path && <code className="mt-1 block font-mono text-[0.75rem] text-ink-3">{path}</code>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-line-strong p-4 text-center text-[0.9rem] text-ink-3">
      {children}
    </div>
  )
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('rounded-xl border border-line bg-surface shadow-card', className)}>
      {children}
    </div>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-[0.72rem] font-semibold tracking-[0.08em] text-ink-3 uppercase', className)}>{children}</div>
}

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-[0.8rem] leading-snug text-surface shadow-lg"
        >
          {content}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode; disabled?: boolean; tip?: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
      {options.map((o) => {
        const btn = (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            aria-disabled={o.disabled}
            onClick={() => !o.disabled && onChange(o.value)}
            className={cx(
              'rounded-md px-2.5 py-1 text-[0.85rem] font-medium transition-colors',
              value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink',
              o.disabled && 'cursor-not-allowed text-ink-3 line-through decoration-ink-3/50 hover:text-ink-3',
            )}
          >
            {o.label}
          </button>
        )
        return o.tip ? (
          <Tip key={o.value} content={o.tip}>
            {btn}
          </Tip>
        ) : (
          btn
        )
      })}
    </div>
  )
}
