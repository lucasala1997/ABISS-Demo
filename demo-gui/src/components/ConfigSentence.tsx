import * as Select from '@radix-ui/react-select'
import { ChevronDown, Database } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation } from 'wouter'
import { useData } from '../data/context'
import { options, type Field, type Option, type Screen, type Selection } from '../data/questions'
import { useApp } from '../state/app'
import { Tip } from './ui'
import { cx } from './styles'

/** The sentence on top of a screen: it says what the screen shows, and every highlighted part is a menu. */
export function Sentence({ children }: { children: ReactNode }) {
  return <p className="text-[1.2rem] leading-[2.3] font-medium text-ink-2">{children}</p>
}

const OWN = '__own__'

export function Token({
  label,
  value,
  placeholder,
  options: items,
  onChange,
  mono,
  className,
  footer,
  extra,
}: {
  /** what the menu chooses, for assistive technology */
  label: string
  value: string | null
  placeholder: string
  options: Option[]
  onChange: (v: string) => void
  mono?: boolean
  className?: string
  /** a line at the bottom of the menu */
  footer?: string
  /** an entry after the values, which is not one of them */
  extra?: { value: string; label: string }
}) {
  const current = items.find((o) => o.value === value)
  return (
    <Select.Root value={value ?? ''} onValueChange={onChange}>
      <Select.Trigger
        aria-label={label}
        className={cx(
          'mx-0.5 inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] px-2.5 py-px align-baseline text-[1.05rem] leading-[1.6] font-semibold transition-colors',
          value === null ? 'border-dashed border-line-strong bg-transparent text-ink-3' : cx('border-line-strong bg-surface text-ink', className),
          mono && 'font-mono text-[0.9rem]',
          'hover:border-accent data-[state=open]:border-accent data-[state=open]:ring-[3px] data-[state=open]:ring-accent-soft',
        )}
      >
        <Select.Value placeholder={placeholder}>{current?.label}</Select.Value>
        <ChevronDown className="size-3.5 text-ink-3" aria-hidden />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="z-50 max-h-[min(26rem,var(--radix-select-content-available-height))] min-w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <Select.Viewport className="p-1">
            {items.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className={cx(
                  'flex cursor-pointer items-center justify-between gap-6 rounded-md px-2.5 py-1.5 text-[0.9rem] outline-none select-none',
                  'data-[highlighted]:bg-accent-soft data-[state=checked]:font-semibold data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-3',
                  mono && 'font-mono text-[0.82rem]',
                )}
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <span className="font-sans text-[0.75rem] font-normal text-ink-3 tabular-nums">{o.note ?? o.count.toLocaleString('en-US')}</span>
              </Select.Item>
            ))}
            {extra && (
              <>
                <Select.Separator className="my-1 h-px bg-line" />
                <Select.Item value={extra.value} className="cursor-pointer rounded-md px-2.5 py-1.5 text-[0.9rem] text-accent outline-none select-none data-[highlighted]:bg-accent-soft">
                  <Select.ItemText>{extra.label}</Select.ItemText>
                </Select.Item>
              </>
            )}
          </Select.Viewport>
          {footer && <div className="max-w-80 border-t border-line px-3 py-2 text-[0.78rem] leading-snug text-ink-3">{footer}</div>}
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

type Setter = (field: Field, value: string) => void

/** A menu of the sentence for one of the filters, with the values the index has. */
export function FieldToken({ field, sel, screen, set, placeholder, mono, className, footer }: { field: Field; sel: Selection; screen: Screen; set: Setter; placeholder: string; mono?: boolean; className?: string; footer?: string }) {
  const d = useData()
  const value = field === 'generator' ? sel.generator : (sel[field] as string | null)
  return <Token label={field} value={value} placeholder={placeholder} options={options(d, sel, field, screen)} onChange={(v) => set(field, v)} mono={mono} className={className} footer={footer} />
}

/** The collection and the database, two menus, and the button that shows the database. */
export function DbTokens({ sel, screen, set }: { sel: Selection; screen: Screen; set: Setter }) {
  const d = useData()
  const [, navigate] = useLocation()
  const openDb = useApp((s) => s.openDb)
  const one = sel.db !== 'all'
  return (
    <span className="whitespace-nowrap">
      <Token
        label="collection of databases"
        value={sel.collection}
        placeholder="collection"
        options={options(d, sel, 'collection', screen)}
        onChange={(v) => (v === OWN ? navigate('/') : set('collection', v))}
        extra={{ value: OWN, label: 'Your own databases…' }}
      />
      <span className="text-ink-3">›</span>
      <FieldToken field="db" sel={sel} screen={screen} set={set} placeholder="database" mono />
      <Tip content={one ? `View the database ${sel.db}` : 'Choose one database to view it'}>
        <button
          aria-label="View database"
          aria-disabled={!one}
          onClick={() => one && openDb(sel.db)}
          className={cx('ml-0.5 inline-grid size-8 place-items-center rounded-md border border-line align-middle', one ? 'text-accent hover:border-accent hover:bg-accent-soft' : 'cursor-not-allowed text-ink-3')}
        >
          <Database className="size-4" aria-hidden />
        </button>
      </Tip>
    </span>
  )
}

/** The menu of the council: its models are those of the recorded run, the others are shown but cannot be chosen. */
export function CouncilToken() {
  const d = useData()
  const members = d.models.council.map((m) => ({ value: m, label: m, count: 0, disabled: false, note: 'in this run' }))
  const others = d.models.agents.filter((a) => !d.models.council.includes(a.name)).map((a) => ({ value: a.name, label: a.name, count: 0, disabled: true, note: 'not in this run' }))
  const label = `council · ${d.models.council.length} LLMs`
  return (
    <Token
      label="council"
      value="council"
      placeholder={label}
      options={[{ value: 'council', label, count: 0, disabled: false, note: '' }, ...members.map((m) => ({ ...m, disabled: true })), ...others]}
      onChange={() => {}}
      mono
      footer="Any LLM can sit in the council. This replay shows the models of the recorded run."
    />
  )
}
