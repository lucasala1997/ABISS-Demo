import type { StopState } from '../data/stageView'
import type { ValidationStage } from '../data/schema'
import { Tip } from './ui'
import { cx } from './styles'

const RESULT: Record<Exclude<StopState, 'hidden'>, string> = { pass: '✓', fail: '✗ rejected', skipped: 'n/a', unreached: 'not reached' }

/**
 * The ten stages as stops on a line. A stop is passed (dark), failed (red), not applicable to this question (dashed)
 * or not reached; a stop the replay has not shown yet is not drawn. The check before stage 1 appears only where it stopped the question.
 */
export function StageLine({ stages, state, selected, onSelect }: { stages: ValidationStage[]; state: (stage: number) => StopState; selected: number | null; onSelect: (stage: number) => void }) {
  const numbered = stages.filter((s) => !s.pre_check).sort((a, b) => a.id - b.id)
  const pre = stages.find((s) => s.pre_check)
  const preFailed = pre && state(pre.id) === 'fail'
  return (
    <div className="relative" data-shot="stage-line">
      <div className="absolute top-[1.05rem] right-[5%] left-[5%] h-[3px] rounded bg-line-strong" aria-hidden />
      {pre && preFailed && (
        <Tip content={pre.notes}>
          <button onClick={() => onSelect(pre.id)} aria-pressed={selected === pre.id} className={cx('absolute -top-1 left-0 z-10 rounded-full border-2 border-fail bg-fail px-2 py-0.5 text-[0.7rem] font-semibold text-surface', selected === pre.id && 'ring-4 ring-accent-soft')}>
            ✗ {pre.name}
          </button>
        </Tip>
      )}
      <ol className="relative grid grid-cols-10">
        {numbered.map((s) => {
          const st = state(s.id)
          const hidden = st === 'hidden'
          const on = selected === s.id
          return (
            <li key={s.id} className={cx('flex justify-center', hidden && 'invisible')} aria-hidden={hidden}>
              <button
                onClick={() => onSelect(s.id)}
                aria-pressed={on}
                aria-label={hidden ? undefined : `Stage ${s.id}: ${s.name}, ${RESULT[st as Exclude<StopState, 'hidden'>]}`}
                tabIndex={hidden ? -1 : 0}
                className="group flex w-full flex-col items-center gap-1.5 px-1 text-center"
              >
                <span
                  className={cx(
                    'grid size-[2.1rem] place-items-center rounded-full border-[3px] border-bg font-mono text-[0.82rem] font-bold transition-shadow',
                    st === 'pass' && 'bg-ink text-surface',
                    st === 'fail' && 'bg-fail text-surface',
                    (st === 'skipped' || st === 'unreached') && 'border-2 border-dashed border-line-strong bg-bg text-ink-3',
                    on && 'ring-4 ring-accent/35',
                    on && st === 'pass' && 'bg-accent',
                  )}
                >
                  {s.id}
                </span>
                <span className={cx('text-[0.74rem] leading-tight', st === 'skipped' || st === 'unreached' ? 'text-ink-3' : 'text-ink', on && 'font-semibold')}>{s.name}</span>
                {!hidden && <span className={cx('text-[0.7rem] font-semibold', st === 'fail' ? 'text-fail' : st === 'pass' ? 'text-answerable' : 'font-medium text-ink-3')}>{RESULT[st as Exclude<StopState, 'hidden'>]}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
