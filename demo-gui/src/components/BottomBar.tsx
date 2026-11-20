import { Pause, Play, Radio, RotateCcw, SkipForward, StepBack, StepForward } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Speed } from '../replay/engine'
import type { Replay } from '../replay/useReplay'
import { useApp } from '../state/app'
import { Segmented, Tip } from './ui'
import { cx } from './styles'

const LIVE_TIP = 'Runs the pipeline on a connected server. Not connected in this build.'

function IconBtn({ label, onClick, children, disabled, primary }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; primary?: boolean }) {
  return (
    <Tip content={label}>
      <button
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={cx('grid size-9 place-items-center rounded-md transition-colors disabled:opacity-40', primary ? 'bg-ink text-surface hover:bg-ink-2' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}
      >
        {children}
      </button>
    </Tip>
  )
}

/**
 * The controls of the replay, fixed at the bottom of the screen so that they stay in reach under long SQL:
 * restart, step back, play/pause, step forward, skip to end, speed, and the Live button (not connected in this build).
 */
export function BottomBar({ replay, note }: { replay: Replay; note?: ReactNode }) {
  const speed = useApp((s) => s.speed)
  const setSpeed = useApp((s) => s.setSpeed)
  const present = useApp((s) => s.present)
  const paper = useApp((s) => s.paper)
  const { status, index, steps } = replay.state
  const running = status === 'running'
  return (
    <div className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/95 px-8 py-2 backdrop-blur" data-bottom-bar>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5">
          <IconBtn label="Restart" onClick={replay.restart} disabled={status === 'idle'}>
            <RotateCcw className="size-4" />
          </IconBtn>
          <IconBtn label={present ? 'Step back (←)' : 'Step back'} onClick={replay.stepBack} disabled={index === 0}>
            <StepBack className="size-4" />
          </IconBtn>
          <IconBtn primary label={running ? 'Pause' : status === 'done' ? 'Finished: restart to replay' : 'Play'} onClick={running ? replay.pause : replay.play} disabled={status === 'done'}>
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          </IconBtn>
          <IconBtn label={present ? 'Step forward (→)' : 'Step forward'} onClick={replay.stepForward} disabled={status === 'done'}>
            <StepForward className="size-4" />
          </IconBtn>
          <IconBtn label="Skip to end" onClick={replay.skipToEnd} disabled={status === 'done'}>
            <SkipForward className="size-4" />
          </IconBtn>
        </div>
        <Segmented<string>
          label="Replay speed"
          value={String(speed)}
          onChange={(v) => setSpeed(Number(v) as Speed)}
          options={[
            { value: '1', label: '1×' },
            { value: '4', label: '4×' },
          ]}
        />
        <span className="font-mono text-[0.8rem] text-ink-3 tabular-nums" aria-label="Replay position">
          {Math.min(index, steps)} / {steps}
        </span>
        {note}
      </div>
      {!paper && (
        <Tip content={LIVE_TIP}>
          <button aria-disabled className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[0.85rem] font-semibold text-ink-3">
            <Radio className="size-4" aria-hidden /> Live
          </button>
        </Tip>
      )}
    </div>
  )
}
