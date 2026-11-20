import type { QuestionDetail, StageRun } from './detailSchema'
import type { QuestionIndexRow, ValidationStage } from './schema'

/* What the line of the ten stages shows for a question, and the steps its replay goes through. */

export type ReplayStep = { kind: 'generation'; index: number } | { kind: 'stage'; stage: number }
export type StopState = 'hidden' | StageRun['outcome']
export type NotchState = 'pass' | 'fail' | 'skipped' | 'off'

export const stageApplies = (s: ValidationStage, type: string, subcategory: string) =>
  (s.applies_to as string[]).includes(type) && (!s.applies_to_subcategories || s.applies_to_subcategories.includes(subcategory))

const run = (q: QuestionDetail, stage: number) => q.validation.find((s) => s.stage === stage)

/** The steps of the replay: the generation, then every stage the question went through. The check before stage 1 is a step only where it stops the question. */
export function replaySteps(q: QuestionDetail): ReplayStep[] {
  return [
    ...q.generation.map((_, index): ReplayStep => ({ kind: 'generation', index })),
    ...q.validation.filter((s) => s.outcome !== 'unreached' && (s.stage !== 0 || s.outcome === 'fail')).map((s): ReplayStep => ({ kind: 'stage', stage: s.stage })),
  ]
}

/** What a stop of the line shows; a stop the replay has not reached yet is not drawn. */
export function stopState(q: QuestionDetail, stage: number, reached: boolean): StopState {
  if (!reached) return 'hidden'
  return run(q, stage)?.outcome ?? 'unreached'
}

/** The stop that is open first: where the question was rejected, else the first stage the council voted on. */
export function defaultStop(q: QuestionDetail): number {
  if (q.rejected_at_stage !== undefined) return q.rejected_at_stage
  return q.validation.find((s) => s.checks.some((c) => c.votes.length > 0))?.stage ?? 1
}

/** The ten notches on a card (stages 1 to 10), from the index row alone. */
export function trackStates(row: Pick<QuestionIndexRow, 'type' | 'subcategory' | 'outcome' | 'rejected_at_stage'>, stages: ValidationStage[]): NotchState[] {
  const stop = row.rejected_at_stage
  return stages
    .filter((s) => !s.pre_check)
    .sort((a, b) => a.id - b.id)
    .map((s) => {
      if (stop !== undefined && s.id > stop) return 'off'
      if (stop === s.id) return 'fail'
      return stageApplies(s, row.type, row.subcategory) ? 'pass' : 'skipped'
    })
}
