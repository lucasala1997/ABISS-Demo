import { describe, expect, it } from 'vitest'
import { choose, detailUrls, fillNext, nextUnset, options, outcomes, resolveSelection, rowsFor, type Selection } from './questions'
import type { DemoData, QuestionIndexRow } from './schema'

const row = (id: string, over: Partial<QuestionIndexRow> = {}): QuestionIndexRow => ({
  id,
  collection: 'BIRD',
  db_id: 'db_a',
  subcategory: 'scope',
  type: 'ambiguous',
  style: 'formal',
  requested_difficulty: 'simple',
  generator_model: 'M1',
  nlq: `question ${id}`,
  outcome: 'accepted',
  meanings: 2,
  ...over,
})
const bench = (results: Record<string, (boolean | null)[]>, system = 'sys') => [{ system, results }]

const index: QuestionIndexRow[] = [
  row('a1', { generator_model: 'M1', outcome: 'rejected', rejected_at_stage: 2 }),
  row('a2', { generator_model: 'M2', benchmarked: bench({ ground_truth: [true, null], predicted: [false, null] }) }),
  row('a3', { generator_model: 'M3' }),
  row('b1', { style: 'colloquial', requested_difficulty: 'moderate', generator_model: 'M1', benchmarked: bench({ ground_truth: [false, true] }) }),
  row('c1', { subcategory: 'improper', type: 'unanswerable', meanings: 1, generator_model: 'M2' }),
  row('d1', { db_id: 'db_b', generator_model: 'M1' }),
  row('d2', { db_id: 'db_b', subcategory: 'improper', type: 'unanswerable', meanings: 1, generator_model: 'M3', benchmarked: bench({ ground_truth: [true] }) }),
  row('legacy_x', { db_id: 'db_b', run: 'legacy', generator_model: null, benchmarked: bench({ ground_truth: [true, false], predicted: [false, null] }, 'old-sys') }),
]

const demo = (over: Partial<DemoData> = {}) =>
  ({
    question_index: index,
    collections: [
      { id: 'BIRD', name: 'BIRD', status: 'replay', source: 's', n_databases: 2 },
      { id: 'spider', name: 'Spider', status: 'results_only', source: 's', n_databases: 0 },
    ],
    models: { council: ['M1', 'M2', 'M3'], generators: ['M1', 'M2', 'M3'], agents: [{ id: 'sys', name: 'Sys-1B' }, { id: 'old-sys', name: 'Old-Sys' }, { id: 'idle', name: 'Idle-1B' }], demo_default_agent: 'sys' },
    styles: ['formal', 'colloquial', 'interrogative'],
    difficulties: ['simple', 'moderate'],
    taxonomy: { types: [], categories: [{ id: 'c1', name: 'Structure', type: 'ambiguous', subcategories: [{ id: 'scope', name: 'Scope Ambiguity', definition: '' }] }, { id: 'c2', name: 'Improper', type: 'unanswerable', subcategories: [{ id: 'improper', name: 'Improper Question', definition: '' }] }] },
    category_modes: [{ id: 'ground_truth', label: 'Ground Truth', system_sees: '' }, { id: 'predicted', label: 'Predicted', system_sees: '' }],
    demo_defaults: { generate: 'b1', benchmark: 'legacy_x', modes: 'legacy_x' },
    ...over,
  }) as unknown as DemoData

const d = demo()
const sel = (over: Partial<Selection> = {}): Selection => ({ collection: 'BIRD', db: 'all', subcategory: null, style: null, difficulty: null, generator: 'any', questionId: null, meaning: 0, system: null, mode: null, ...over })
const ids = (rows: QuestionIndexRow[]) => rows.map((r) => r.id)

describe('rowsFor', () => {
  it('lists in Generate & Validate the candidates of the run that match the filters, never those of the earlier run', () => {
    expect(ids(rowsFor(d, sel(), 'generate'))).toEqual(['a1', 'a2', 'a3', 'b1', 'c1', 'd1', 'd2'])
    expect(ids(rowsFor(d, sel({ db: 'db_a', subcategory: 'scope', style: 'formal', difficulty: 'simple' }), 'generate'))).toEqual(['a1', 'a2', 'a3'])
  })

  it('keeps one candidate per combination when a writer is chosen', () => {
    expect(ids(rowsFor(d, sel({ db: 'db_a', subcategory: 'scope', generator: 'M1' }), 'generate'))).toEqual(['a1', 'b1'])
  })

  it('lists in Benchmarking only the questions with a dialogue for the system and the mode', () => {
    expect(ids(rowsFor(d, sel({ system: 'sys', mode: 'ground_truth' }), 'benchmark'))).toEqual(['a2', 'b1', 'd2'])
    expect(ids(rowsFor(d, sel({ system: 'sys', mode: 'predicted' }), 'benchmark'))).toEqual(['a2'])
    expect(ids(rowsFor(d, sel({ system: 'old-sys', mode: 'ground_truth' }), 'benchmark'))).toEqual(['legacy_x'])
  })

  it('lists in Four Modes the questions with a dialogue of the system in any mode', () => {
    expect(ids(rowsFor(d, sel({ system: 'sys', mode: 'predicted' }), 'modes'))).toEqual(['a2', 'b1', 'd2'])
  })
})

describe('options', () => {
  const by = (field: Parameters<typeof options>[2], s = sel({ db: 'db_a', subcategory: 'scope' }), screen: Parameters<typeof options>[3] = 'generate') => Object.fromEntries(options(d, s, field, screen).map((o) => [o.value, o]))

  it('counts the rows each value would leave, and disables a value that leaves none', () => {
    expect(by('style').formal).toMatchObject({ count: 3, disabled: false })
    expect(by('style').colloquial).toMatchObject({ count: 1, disabled: false })
    expect(by('style').interrogative).toMatchObject({ count: 0, disabled: true })
  })

  it('offers every database of the collection and all of them together', () => {
    expect(options(d, sel(), 'db', 'generate').map((o) => [o.value, o.count])).toEqual([['all', 7], ['db_a', 5], ['db_b', 2]])
  })

  it('names the subcategories and the difficulties as the demo shows them', () => {
    expect(by('subcategory').scope.label).toBe('Scope Ambiguity')
    expect(options(demo({ difficulties: ['highly_complex'] }), sel(), 'difficulty', 'generate')[0].label).toBe('highly complex')
  })

  it('shows a collection without questions as results only, and a system without dialogues as not in this run', () => {
    expect(by('collection').spider).toMatchObject({ disabled: true, note: 'results only' })
    expect(by('system', sel(), 'benchmark').idle).toMatchObject({ disabled: true, note: 'not in this run' })
    expect(by('system', sel(), 'benchmark').sys.disabled).toBe(false)
  })

  it('offers any writer, then the writers of the run', () => {
    expect(options(d, sel({ db: 'db_a', subcategory: 'scope', style: 'formal', difficulty: 'simple' }), 'generator', 'generate').map((o) => [o.value, o.count])).toEqual([['any', 3], ['M1', 1], ['M2', 1], ['M3', 1]])
  })
})

describe('resolveSelection', () => {
  it('opens on the default question of the screen, with its filters', () => {
    expect(resolveSelection(d, {}, 'generate', true)).toMatchObject({ collection: 'BIRD', db: 'db_a', subcategory: 'scope', style: 'colloquial', difficulty: 'moderate', questionId: 'b1', generator: 'any' })
    expect(resolveSelection(d, {}, 'benchmark', true)).toMatchObject({ questionId: 'legacy_x', db: 'db_b', system: 'old-sys', mode: 'ground_truth' })
  })

  it('keeps the question that is asked for, when the filters allow it', () => {
    expect(resolveSelection(d, { db: 'db_a', subcategory: 'scope', style: 'formal', difficulty: 'simple', questionId: 'a3' }, 'generate', true).questionId).toBe('a3')
  })

  it('falls back on the first question of the filters when the wanted one has no rows left', () => {
    expect(resolveSelection(d, { db: 'db_a', subcategory: 'scope', style: 'formal', difficulty: 'simple', generator: 'M2', questionId: 'a1' }, 'generate', true).questionId).toBe('a2')
  })

  it('moving to Benchmarking from a question without dialogue opens the first one of the same database and subcategory that has one', () => {
    const from = { collection: 'BIRD', db: 'db_a', subcategory: 'scope', style: 'formal', difficulty: 'simple', questionId: 'a1', system: 'sys', mode: 'ground_truth' }
    expect(resolveSelection(d, from, 'benchmark', true)).toMatchObject({ questionId: 'a2', style: 'formal', difficulty: 'simple' })
    expect(resolveSelection(d, { ...from, style: 'interrogative' }, 'benchmark', true)).toMatchObject({ questionId: 'a2', style: 'formal' })
  })

  it('leaves the question empty when the database and the subcategory have no dialogue at all', () => {
    const s = resolveSelection(d, { collection: 'BIRD', db: 'db_a', subcategory: 'improper', questionId: 'c1', system: 'sys', mode: 'ground_truth' }, 'benchmark', true)
    expect(s).toMatchObject({ db: 'db_a', subcategory: 'improper', questionId: null })
  })

  it('brings the interpretation back to the first one for a question with one meaning', () => {
    expect(resolveSelection(d, { db: 'db_b', subcategory: 'improper', questionId: 'd2', meaning: 1, system: 'sys', mode: 'ground_truth' }, 'benchmark', true).meaning).toBe(0)
  })

  it('in presentation leaves unchosen what is not chosen, and drops only what has no rows left', () => {
    // the collection and the database are those of the default question: the rest is chosen in front of the audience
    expect(resolveSelection(d, {}, 'generate', false)).toMatchObject({ collection: 'BIRD', db: 'db_a', subcategory: null, style: null, difficulty: null, questionId: null })
    expect(resolveSelection(demo({ demo_defaults: {} }), {}, 'generate', false).db).toBe('all')
    expect(resolveSelection(d, { db: 'db_a', subcategory: 'scope', style: 'interrogative', difficulty: 'simple' }, 'generate', false)).toMatchObject({ subcategory: 'scope', style: null, difficulty: 'simple' })
    expect(resolveSelection(d, {}, 'benchmark', false)).toMatchObject({ db: 'db_b', system: 'old-sys', mode: 'ground_truth', questionId: null })
  })
})

describe('choosing in the sentence', () => {
  it('a new subcategory clears style, difficulty and question, then the screen fills them again', () => {
    const before = resolveSelection(d, {}, 'generate', true)
    expect(choose(d, before, 'subcategory', 'improper', 'generate', true)).toMatchObject({ subcategory: 'improper', questionId: 'c1', style: 'formal', difficulty: 'simple' })
    expect(choose(d, before, 'subcategory', 'improper', 'generate', false)).toMatchObject({ subcategory: 'improper', questionId: null, style: null, difficulty: null })
  })

  it('in presentation style and difficulty can be chosen before the subcategory, as the sentence reads', () => {
    let s = resolveSelection(d, {}, 'generate', false)
    s = choose(d, s, 'style', 'colloquial', 'generate', false)
    expect(s).toMatchObject({ style: 'colloquial', subcategory: null })
    s = choose(d, s, 'difficulty', 'moderate', 'generate', false)
    expect(s).toMatchObject({ style: 'colloquial', difficulty: 'moderate', subcategory: null })
    s = choose(d, s, 'subcategory', 'scope', 'generate', false)
    expect(s).toMatchObject({ subcategory: 'scope', style: 'colloquial', difficulty: 'moderate', questionId: null })
    expect(nextUnset(s)).toBe('questionId')
  })

  it('a choice keeps the other parts that still have questions with it, and clears those that do not', () => {
    const s = sel({ db: 'db_a', subcategory: 'scope', style: 'formal', difficulty: 'simple' })
    expect(choose(d, s, 'subcategory', 'improper', 'generate', false)).toMatchObject({ subcategory: 'improper', style: 'formal', difficulty: 'simple' })
    expect(choose(d, s, 'style', 'colloquial', 'generate', false)).toMatchObject({ subcategory: 'scope', style: 'colloquial', difficulty: null })
  })

  it('counts for a value the questions left after the parts it does not fit with are cleared', () => {
    const s = sel({ db: 'db_a', style: 'colloquial' })
    const sub = Object.fromEntries(options(d, s, 'subcategory', 'generate').map((o) => [o.value, o]))
    expect(sub.scope).toMatchObject({ count: 1, disabled: false })
    expect(sub.improper).toMatchObject({ count: 1, disabled: false })
  })

  it('in presentation the right arrow fills the next unchosen part, in the order of the sentence', () => {
    let s = resolveSelection(d, {}, 'generate', false)
    const order: (string | null)[] = []
    while (nextUnset(s)) {
      order.push(nextUnset(s))
      s = fillNext(d, s, 'generate')
    }
    expect(order).toEqual(['subcategory', 'style', 'difficulty', 'questionId'])
    expect(s).toMatchObject({ subcategory: 'scope', style: 'colloquial', difficulty: 'moderate', questionId: 'b1' })
    expect(nextUnset(s)).toBeNull()
  })
})

describe('outcomes', () => {
  it('gives one outcome per interpretation, null where there is no dialogue', () => {
    expect(outcomes(index[1], 'sys', 'ground_truth')).toEqual([true, null])
    expect(outcomes(index[0], 'sys', 'ground_truth')).toEqual([null, null])
    expect(outcomes(index[6], 'sys', 'predicted')).toEqual([null])
  })
})

describe('detailUrls', () => {
  it('names one file per database of the selection, and none before a subcategory is chosen', () => {
    expect(detailUrls(d, sel(), 'questions')).toEqual([])
    expect(detailUrls(d, sel({ db: 'db_a', subcategory: 'scope' }), 'questions')).toEqual(['data/questions/BIRD/db_a/scope.json'])
    expect(detailUrls(d, sel({ subcategory: 'scope' }), 'questions')).toEqual(['data/questions/BIRD/db_a/scope.json', 'data/questions/BIRD/db_b/scope.json'])
  })

  it('asks for dialogues only where the index says there are some', () => {
    expect(detailUrls(d, sel({ subcategory: 'improper' }), 'dialogues')).toEqual(['data/dialogues/BIRD/db_b/improper.json'])
    expect(detailUrls(d, sel({ db: 'db_a', subcategory: 'improper' }), 'dialogues')).toEqual([])
  })
})
