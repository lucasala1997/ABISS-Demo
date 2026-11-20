import { Bot, User } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Turn } from '../data/schema'
import { SqlBlock } from './SqlBlock'
import { RelevancyChip, ThinkingPulse } from './ui'
import { REL_STYLE, cx } from './styles'

const ACTION = { clarification: 'Clarification', sql: 'SQL', feedback: 'Feedback', failed: 'No valid action' } as const

function Bubble({ children, className, indent, onClick, selected }: { children: ReactNode; className?: string; indent?: string; onClick?: () => void; selected?: boolean }) {
  const cls = cx('flex flex-col gap-1.5 rounded-lg border p-2.5 text-left', className, selected && 'ring-[3px] ring-accent/50')
  return (
    <motion.div className={indent} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      {onClick ? (
        <button onClick={onClick} aria-pressed={selected} className={cx(cls, 'w-full')}>
          {children}
        </button>
      ) : (
        <div className={cls}>{children}</div>
      )}
    </motion.div>
  )
}

/**
 * A recorded dialogue as a chat: the question, the turns of the tested system, the replies of the simulated user.
 * Only the first `shown` turns are drawn. A reply of the user can be selected: the panel next to the chat explains it.
 */
export function ChatTurns({
  nlq,
  turns,
  shown,
  system,
  selected,
  onSelect,
  compact,
  thinking,
}: {
  /** the question that opens the dialogue; left out where the screen shows it elsewhere */
  nlq?: string
  turns: Turn[]
  shown: number
  /** the name of the tested system */
  system: string
  selected?: number | null
  onSelect?: (i: number) => void
  /** narrow columns: smaller type, no indent */
  compact?: boolean
  /** the replay is running: say who is answering next */
  thinking?: boolean
}) {
  const text = compact ? 'text-[0.82rem]' : 'text-[0.92rem]'
  const who = 'flex flex-wrap items-center gap-1.5 text-[0.75rem] font-semibold text-ink'
  const next = turns[shown]
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      {nlq !== undefined && (
        <Bubble className="border-line bg-surface" indent={compact ? undefined : 'ml-10'}>
          <span className={who}>
            <User className="size-3.5" aria-hidden /> Simulated user
          </span>
          <p className={cx(text, 'leading-snug text-ink')}>{nlq}</p>
        </Bubble>
      )}
      {turns.slice(0, shown).map((t, i) =>
        t.role === 'agent' ? (
          <Bubble key={i} className="border-line bg-surface-2/70" indent={compact ? undefined : 'mr-10'}>
            <span className={who}>
              <Bot className="size-3.5" aria-hidden /> System
              <span className={cx('rounded px-1.5 py-px text-[0.68rem]', t.action === 'clarification' ? 'bg-accent-soft text-accent' : t.action === 'failed' ? 'bg-fail-soft text-fail' : 'bg-ink text-surface')}>{ACTION[t.action]}</span>
              <span className="font-mono text-[0.68rem] font-normal text-ink-3">{system}</span>
            </span>
            {t.text && <p className={cx(text, 'leading-snug text-ink')}>{t.text}</p>}
            {t.sql && <SqlBlock sql={t.sql} className={cx('overflow-y-auto', compact ? 'max-h-64' : 'max-h-80')} />}
          </Bubble>
        ) : (
          <Bubble key={i} className={cx(REL_STYLE[t.relevancy].border, t.by_hand ? 'border-dashed bg-surface' : REL_STYLE[t.relevancy].bg)} indent={compact ? undefined : 'ml-10'} onClick={onSelect ? () => onSelect(i) : undefined} selected={selected === i}>
            <span className={who}>
              <User className="size-3.5" aria-hidden /> Simulated user
              {t.by_hand ? <span className="rounded border border-line-strong px-1.5 py-px text-[0.68rem] text-ink-2">written by hand</span> : <RelevancyChip label={t.relevancy} size="sm" />}
            </span>
            <p className={cx(text, 'leading-snug text-ink')}>{t.text}</p>
          </Bubble>
        ),
      )}
      {thinking && next && (
        <div className="rounded-lg border border-dashed border-line p-2.5">
          <ThinkingPulse who={next.role === 'agent' ? system : 'The council'} what={next.role === 'agent' ? 'is answering' : 'is labelling and replying'} />
        </div>
      )}
    </div>
  )
}
