import type { CouncilVote, DecisionRuleT } from './schema'

/*
 * How a council stage decides (validation_stages[].decision_rule). In the JSON every vote keeps the
 * model's raw answer (`raw`) and `vote` says whether that answer speaks for keeping the question.
 */

/** Whether a raw vote (true/false, or 0/1 for pairwise comparisons) speaks for keeping the question. */
export function supportsKeeping(rule: DecisionRuleT, raw: boolean | number): boolean {
  // one vote alone never removes under this rule: the vote says which reading the query gives, on_every_reading says the rest
  if (rule === 'one_query_removes') return true
  switch (rule) {
    case 'majority_keeps':
    case 'any_keeps':
      return raw === true
    case 'majority_removes':
    case 'any_removes':
      return raw === false
    case 'pairwise':
      return raw === 0
  }
}

export interface PairwiseGroup {
  against: string
  kept: number
  total: number
  pass: boolean
}

export interface StageDecision {
  pass: boolean
  kept: number
  total: number
  /** pairwise stages: one entry per compared category, in vote order */
  groups?: PairwiseGroup[]
}

const majority = (kept: number, total: number) => kept * 2 > total

/** What a decision needs of a vote: the votes of the first version and of the final run both have it. */
export type DecisionVote = Pick<CouncilVote, 'vote' | 'wrote_question' | 'against' | 'on_every_reading'>

export function stageDecision(rule: DecisionRuleT | undefined, votes: DecisionVote[]): StageDecision {
  // the model that wrote the question stays on record but does not count; so does a vote without a usable result
  const counted = votes.filter((v) => !v.wrote_question && v.vote !== 'none')
  const kept = counted.filter((v) => v.vote === 'pass').length
  const total = counted.length
  if (rule === 'any_removes') return { pass: kept === total, kept, total }
  // one model other than the writer that reaches the reference is enough
  if (rule === 'any_keeps') return { pass: kept > 0, kept, total }
  if (rule === 'majority_removes') return { pass: total > 0 && !majority(total - kept, total), kept, total }
  if (rule === 'one_query_removes') {
    // a checked fact, not a judgment: the query of the writer counts too
    const withResult = votes.filter((v) => v.vote !== 'none')
    const removing = withResult.filter((v) => v.on_every_reading).length
    return { pass: removing === 0 && total > 0, kept: withResult.length - removing, total: withResult.length }
  }
  if (rule === 'pairwise') {
    const groups: PairwiseGroup[] = []
    for (const v of counted) {
      const against = v.against ?? ''
      let g = groups.find((x) => x.against === against)
      if (!g) groups.push((g = { against, kept: 0, total: 0, pass: false }))
      g.total++
      if (v.vote === 'pass') g.kept++
    }
    for (const g of groups) g.pass = majority(g.kept, g.total)
    return { pass: groups.every((g) => g.pass), kept, total, groups }
  }
  return { pass: majority(kept, total), kept, total }
}

/** What an attempt needs of a vote: the votes of the first version and of the final run both have it. */
export interface AttemptVote {
  vote: 'pass' | 'fail' | 'none'
  wrote_question?: boolean
  sql?: string | null
  executes?: boolean
  problem?: string
  row_count?: number
  judged_valid?: boolean
  judgments?: { accepted: boolean; wrote_question?: boolean }[]
}

/** Whether the run logged what the model tried, beyond its vote. */
export const voteHasAttempt = (v: AttemptVote) => v.sql !== undefined || v.problem !== undefined || v.executes !== undefined || v.judged_valid !== undefined

/** A logged query that removes the candidate on its own. */
export const isDecidingVote = (rule: DecisionRuleT | undefined, v: AttemptVote) => rule === 'any_removes' && v.vote === 'fail' && v.sql !== undefined && v.sql !== null && !v.wrote_question

/** The first such vote, -1 if there is none. */
export const decidingVoteIndex = (rule: DecisionRuleT | undefined, votes: AttemptVote[]) => votes.findIndex((v) => isDecidingVote(rule, v))

const NOT_LOGGED = 'not logged in this run'

function runsText(v: AttemptVote) {
  if (v.executes === undefined) return NOT_LOGGED
  if (!v.executes) return v.problem ? `no (${v.problem})` : 'no'
  return v.row_count === undefined ? 'yes' : `yes, ${v.row_count} ${v.row_count === 1 ? 'row' : 'rows'}`
}

function councilText(v: AttemptVote) {
  if (v.judged_valid !== undefined) {
    const verdict = v.judged_valid ? 'accepts it' : 'rejects it'
    if (!v.judgments) return verdict
    const counted = v.judgments.filter((j) => !j.wrote_question)
    const yes = counted.filter((j) => j.accepted).length
    const no = counted.length - yes
    return `${verdict}, ${yes} to ${no}`
  }
  if (v.executes === false) return 'not judged: the query does not run'
  if (v.row_count === 0) return 'not judged: no rows counts as not solved'
  return NOT_LOGGED
}

/** The two facts of an attempt of stage 7, in words. */
export const attemptSummary = (v: AttemptVote) => ({ runs: runsText(v), council: councilText(v) })
