import { describe, expect, it } from 'vitest'
import { decidingVoteIndex, stageDecision, supportsKeeping, voteHasAttempt, attemptSummary, isDecidingVote } from './votes'

const v = (vote: 'pass' | 'fail', against?: string) => ({ model: 'm', vote, est_latency_ms: null, rationale: null, ...(against ? { against } : {}) })

describe('supportsKeeping', () => {
  it('reads a true vote as approval when a majority of true keeps the question', () => {
    expect(supportsKeeping('majority_keeps', true)).toBe(true)
    expect(supportsKeeping('majority_keeps', false)).toBe(false)
  })

  it('reads a true vote as a reason to remove when true means "solved"', () => {
    expect(supportsKeeping('majority_removes', true)).toBe(false)
    expect(supportsKeeping('majority_removes', false)).toBe(true)
    expect(supportsKeeping('any_removes', true)).toBe(false)
  })

  it('reads 0 as a preference for the own category in pairwise comparisons', () => {
    expect(supportsKeeping('pairwise', 0)).toBe(true)
    expect(supportsKeeping('pairwise', 1)).toBe(false)
  })
})

describe('stageDecision', () => {
  it('keeps on a simple majority', () => {
    expect(stageDecision('majority_keeps', [v('fail'), v('pass'), v('pass')])).toMatchObject({ pass: true, kept: 2, total: 3 })
  })

  it('removes as soon as one vote is against when one solution is enough', () => {
    expect(stageDecision('any_removes', [v('pass'), v('fail'), v('pass')])).toMatchObject({ pass: false, kept: 2, total: 3 })
  })

  it('needs the own category to win every pairwise comparison', () => {
    const won = stageDecision('pairwise', [v('pass', 'a'), v('pass', 'a'), v('fail', 'a'), v('pass', 'b'), v('pass', 'b'), v('pass', 'b')])
    expect(won.pass).toBe(true)
    expect(won.groups).toEqual([
      { against: 'a', kept: 2, total: 3, pass: true },
      { against: 'b', kept: 3, total: 3, pass: true },
    ])
    const lost = stageDecision('pairwise', [v('pass', 'a'), v('pass', 'a'), v('pass', 'a'), v('fail', 'b'), v('fail', 'b'), v('pass', 'b')])
    expect(lost.pass).toBe(false)
  })

  it('falls back to a majority when the stage has no rule', () => {
    expect(stageDecision(undefined, [v('fail'), v('fail'), v('pass')]).pass).toBe(false)
  })
})

describe('voteHasAttempt', () => {
  const v = { model: 'm', vote: 'fail' as const, est_latency_ms: null, rationale: null }
  it('is false for a vote of the April run, which kept the vote only', () => {
    expect(voteHasAttempt(v)).toBe(false)
  })
  it('is true as soon as one field of the attempt is logged', () => {
    expect(voteHasAttempt({ ...v, sql: 'SELECT 1' })).toBe(true)
    expect(voteHasAttempt({ ...v, executes: false })).toBe(true)
    expect(voteHasAttempt({ ...v, judged_valid: false })).toBe(true)
    expect(voteHasAttempt({ ...v, problem: 'error: no such column: x' })).toBe(true)
  })
})

describe('decidingVoteIndex', () => {
  const kept = { model: 'a', vote: 'pass' as const, raw: false, est_latency_ms: null, rationale: null, sql: 'SELECT 0' }
  const removes = { model: 'b', vote: 'fail' as const, raw: true, est_latency_ms: null, rationale: null, sql: 'SELECT 1' }
  it('is the vote that removes the candidate, when its query is logged', () => {
    expect(decidingVoteIndex('any_removes', [kept, removes, kept])).toBe(1)
  })
  it('is -1 when the votes carry no query, as in the April trace', () => {
    expect(decidingVoteIndex('any_removes', [{ ...removes, sql: undefined }])).toBe(-1)
  })
  it('is -1 under a rule where one vote does not decide', () => {
    expect(decidingVoteIndex('majority_keeps', [kept, removes, kept])).toBe(-1)
  })
})

describe('stageDecision with the model that wrote the question', () => {
  const v = (vote: 'pass' | 'fail', wrote_question?: boolean) => ({ model: 'm', vote, est_latency_ms: null, rationale: null, wrote_question })
  it('does not count its vote: alone it cannot remove the candidate', () => {
    expect(stageDecision('any_removes', [v('pass'), v('pass'), v('fail', true)])).toMatchObject({ pass: true, kept: 2, total: 2 })
  })
  it('still removes on the vote of another model', () => {
    expect(stageDecision('any_removes', [v('fail'), v('pass'), v('pass', true)])).toMatchObject({ pass: false, kept: 1, total: 2 })
  })
})

describe('isDecidingVote', () => {
  const base = { model: 'm', est_latency_ms: null, rationale: null, sql: 'SELECT 1' }
  it('marks every logged query that removes the candidate on its own', () => {
    expect(isDecidingVote('any_removes', { ...base, vote: 'fail' })).toBe(true)
    expect(isDecidingVote('any_removes', { ...base, vote: 'pass' })).toBe(false)
  })
  it('does not mark the model that wrote the question, which does not count', () => {
    expect(isDecidingVote('any_removes', { ...base, vote: 'fail', wrote_question: true })).toBe(false)
  })
  it('needs the rule where one vote decides', () => {
    expect(isDecidingVote('majority_keeps', { ...base, vote: 'fail' })).toBe(false)
  })
})

describe('attemptSummary', () => {
  const base = { model: 'm', vote: 'pass' as const, est_latency_ms: null, rationale: null }
  const judge = (accepted: boolean, wrote_question?: boolean) => ({ model: 'j', accepted, rationale: null, wrote_question })
  it('gives the rows of a query that runs and the score of the council', () => {
    expect(attemptSummary({ ...base, executes: true, row_count: 495, judged_valid: false, judgments: [judge(false), judge(true), judge(false)] })).toEqual({ runs: 'yes, 495 rows', council: 'rejects it, 1 to 2' })
    expect(attemptSummary({ ...base, executes: true, row_count: 1, judged_valid: true, judgments: [judge(true), judge(true), judge(false)] })).toEqual({ runs: 'yes, 1 row', council: 'accepts it, 2 to 1' })
  })
  it('leaves the judge who wrote the question out of the score', () => {
    expect(attemptSummary({ ...base, executes: true, judged_valid: true, judgments: [judge(true), judge(true), judge(false, true)] }).council).toBe('accepts it, 2 to 0')
  })
  it('says why a query was not judged', () => {
    expect(attemptSummary({ ...base, executes: false, problem: 'error: no such column: x' })).toEqual({ runs: 'no (error: no such column: x)', council: 'not judged: the query does not run' })
    expect(attemptSummary({ ...base, executes: true, row_count: 0 })).toEqual({ runs: 'yes, 0 rows', council: 'not judged: no rows counts as not solved' })
  })
  it('declares what the run did not log', () => {
    expect(attemptSummary({ ...base, sql: 'SELECT 1' })).toEqual({ runs: 'not logged in this run', council: 'not logged in this run' })
  })
})

describe('the rules of the code of the final run', () => {
  const base = { model: 'm', est_latency_ms: null, rationale: null }
  const yes = { ...base, vote: 'fail' as const, raw: true }
  const no = { ...base, vote: 'pass' as const, raw: false }
  const unusable = { ...base, vote: 'none' as const, raw: null }

  it('stage 5: a tie among two counted votes keeps the question, because True has no majority', () => {
    expect(stageDecision('majority_removes', [yes, no, { ...yes, wrote_question: true }]).pass).toBe(true)
  })
  it('stage 5: a majority of True among the usable votes removes the question', () => {
    expect(stageDecision('majority_removes', [yes, yes, no]).pass).toBe(false)
  })
  it('stage 5: a vote without a usable result leaves the count', () => {
    expect(stageDecision('majority_removes', [yes, unusable, no])).toMatchObject({ pass: true, total: 2 })
  })
  it('stage 5: a question without a counted usable vote is removed', () => {
    expect(stageDecision('majority_removes', [unusable, unusable, { ...no, wrote_question: true }]).pass).toBe(false)
  })
  it('a tie among two counted votes rejects where a majority must keep the question', () => {
    expect(stageDecision('majority_keeps', [no, yes, { ...no, wrote_question: true }]).pass).toBe(false)
  })

  describe('stage 6: one query on every reading', () => {
    const reaches = { ...base, vote: 'pass' as const, raw: true }
    it('True on this reading only does not remove the question', () => {
      expect(stageDecision('one_query_removes', [reaches, reaches, no]).pass).toBe(true)
    })
    it('one query on every reading removes it', () => {
      expect(stageDecision('one_query_removes', [{ ...reaches, vote: 'fail', on_every_reading: true }, no, no]).pass).toBe(false)
    })
    it('the query of the writer counts too, because it is a checked fact', () => {
      expect(stageDecision('one_query_removes', [{ ...reaches, vote: 'fail', on_every_reading: true, wrote_question: true }, no, no]).pass).toBe(false)
    })
    it('without a usable vote of a model that did not write the question, it is removed', () => {
      expect(stageDecision('one_query_removes', [{ ...no, wrote_question: true }, unusable, unusable]).pass).toBe(false)
    })
  })

  it('a vote keeps its meaning when one vote alone cannot remove the question', () => {
    expect(supportsKeeping('one_query_removes', true)).toBe(true)
  })
})

describe('rules of the final run', () => {
  const rv = (vote: 'pass' | 'fail' | 'none', wrote = false) => ({ vote, wrote_question: wrote })

  it('any_keeps: a true vote speaks for keeping', () => {
    expect(supportsKeeping('any_keeps', true)).toBe(true)
    expect(supportsKeeping('any_keeps', false)).toBe(false)
  })

  it('any_keeps: the vote of the writer alone does not keep the question', () => {
    expect(stageDecision('any_keeps', [rv('fail'), rv('pass', true), rv('fail')]).pass).toBe(false)
  })

  it('any_keeps: one counted model that reaches the reference keeps it', () => {
    expect(stageDecision('any_keeps', [rv('fail'), rv('pass'), rv('none')]).pass).toBe(true)
  })

  it('majority_keeps: a tie removes', () => {
    expect(stageDecision('majority_keeps', [rv('pass'), rv('fail'), rv('pass', true)]).pass).toBe(false)
  })

  it('pairwise: a question with no competitor passes', () => {
    expect(stageDecision('pairwise', []).pass).toBe(true)
  })
})
