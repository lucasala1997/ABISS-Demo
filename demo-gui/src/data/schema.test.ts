import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDemoData } from './schema'

const raw = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../demo_data/abiss_demo_data.json'), 'utf8'))

describe('parseDemoData', () => {
  it('accepts the real demo JSON, including TO_FILL slots', () => {
    const r = parseDemoData(raw())
    expect(r.ok).toBe(true)
  })

  it('reports the field path when a required field is missing', () => {
    const d = raw()
    delete d.examples[0].nlq
    const r = parseDemoData(d)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues.map((i) => i.path)).toContain('examples[0].nlq')
  })

  it('accepts an example slot not selected yet', () => {
    const d = raw()
    d.examples.push({ id: 'ex_new', status: 'TO_FILL_FROM_ANNOTATIONS', subcategory: 'scope' })
    const r = parseDemoData(d)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.examples.find((e) => e.id === 'ex_new')?.selected).toBe(false)
  })

  it('reports an example pointing at an unknown database', () => {
    const d = raw()
    d.examples[0].db_id = 'nope'
    const r = parseDemoData(d)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues.map((i) => i.path)).toContain('examples[0].db_id')
  })

  it('reports an example with an unknown subcategory', () => {
    const d = raw()
    d.examples[1].subcategory = 'made_up'
    const r = parseDemoData(d)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues.map((i) => i.path)).toContain('examples[1].subcategory')
  })

  it('allows traces that point at a TO_FILL example id', () => {
    const d = raw()
    d.scenario1_generation_traces.push({ example_id: 'TO_FILL_X', provenance: 'illustrative', outcome: 'accepted', generation: [], validation: [] })
    expect(parseDemoData(d).ok).toBe(true)
  })

  const questionOnly = () => ({
    example_id: null,
    question: { nlq: 'List all European countries by GDP.', type: 'unanswerable', dataset: 'BIRD', subcategory: null, db_id: null },
    provenance: 'logged',
    outcome: 'rejected',
    rejected_at_stage: 7,
    generation: [],
    validation: [{ stage: 7, outcome: 'fail', est_latency_ms: 18000, votes: [{ model: 'GPT-OSS-120B', vote: 'fail', raw: true, est_latency_ms: null, rationale: null }] }],
  })

  it('accepts a logged trace that has only the question (no example, no database)', () => {
    const d = raw()
    d.scenario1_generation_traces.push(questionOnly())
    expect(parseDemoData(d).ok).toBe(true)
  })

  it('reports a trace with neither an example nor a question', () => {
    const d = raw()
    const t = questionOnly() as Record<string, unknown>
    delete t.question
    d.scenario1_generation_traces.push(t)
    const r = parseDemoData(d)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues.map((i) => i.path)).toContain(`scenario1_generation_traces[${d.scenario1_generation_traces.length - 1}].example_id`)
  })

  it('reports a pairwise vote against an unknown subcategory', () => {
    const d = raw()
    const t = questionOnly()
    t.validation[0].votes[0] = { ...t.validation[0].votes[0], against: 'nope' } as (typeof t.validation)[0]['votes'][0]
    d.scenario1_generation_traces.push(t)
    const r = parseDemoData(d)
    expect(r.ok).toBe(false)
    const i = d.scenario1_generation_traces.length - 1
    if (!r.ok) expect(r.issues.map((x) => x.path)).toContain(`scenario1_generation_traces[${i}].validation[0].votes[0].against`)
  })

  it('accepts stage vote meanings and a decision rule', () => {
    const d = raw()
    Object.assign(d.validation_stages[6], { decision_rule: 'any_removes', vote_meaning: 'x', decision: 'y', vote_labels: { true: 'found SQL', false: 'no SQL' } })
    expect(parseDemoData(d).ok).toBe(true)
    d.validation_stages[6].decision_rule = 'sometimes'
    expect(parseDemoData(d).ok).toBe(false)
  })

  it('accepts the answer contest of a simulated-user turn', () => {
    const d = raw()
    d.scenario3_mode_comparisons[0].modes.ground_truth.turns = [
      {
        role: 'simulated_user',
        relevancy: 'relevant',
        votes: [{ model: 'GPT-OSS-120B', label: 'relevant' }],
        text: 'one overall average',
        est_latency_ms: 13500,
        contest: {
          judgments: [{ judge: 'GPT-OSS-120B', a: 'GPT-OSS-120B', b: 'Qwen3.5-122B-A10B-FP8', winner: 'GPT-OSS-120B' }],
          wins: { 'GPT-OSS-120B': 1, 'Qwen3.5-122B-A10B-FP8': 0 },
          winner: 'GPT-OSS-120B',
          margin: 1,
        },
      },
    ]
    expect(parseDemoData(d).ok).toBe(true)
  })

  it('reads an optional AIR per category mode and rejects one that is not a number', () => {
    const d = raw()
    d.paper_results.ablation.bird.ground_truth.air = 79.5
    const ok = parseDemoData(d)
    expect(ok.ok && ok.data.paper_results.ablation.bird.ground_truth.air).toBe(79.5)
    d.paper_results.ablation.bird.ground_truth.air = 'high'
    const bad = parseDemoData(d)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.issues.map((x) => x.path)).toContain('paper_results.ablation.bird.ground_truth.air')
  })
  describe('scenario2_branches', () => {
    const turn = { role: 'agent', action: 'sql', sql: 'SELECT 1', est_latency_ms: 1000 }
    const opening = { role: 'agent', action: 'clarification', text: 'Which one?', est_latency_ms: 1000 }
    const branch = (over = {}) => ({
      id: 'collective',
      label: 'All',
      user_reply: 'All of them',
      turns: [turn],
      terminal: { action: 'sql', by: 'agent', sql: 'SELECT 1' },
      correct: true,
      provenance: 'logged',
      ...over,
    })
    const withBranches = (over = {}) => {
      const d = raw()
      d.scenario2_branches = {
        example_id: 'ex_scope',
        agent_model: 'mistral-small-3.2-24b',
        mode: 'ground_truth',
        opening_turn: opening,
        branches: [branch(), branch({ id: 'distributive', label: 'Each', user_reply: null, turns: [], terminal: null, correct: null, provenance: null })],
        ...over,
      }
      return d
    }
    const paths = (d: unknown) => {
      const r = parseDemoData(d)
      return r.ok ? [] : r.issues.map((i) => i.path)
    }

    it('keeps the section and accepts a branch that has not arrived', () => {
      const r = parseDemoData(withBranches())
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.scenario2_branches?.branches).toHaveLength(2)
    })
    it('is optional', () => {
      const d = raw()
      delete d.scenario2_branches
      expect(parseDemoData(d).ok).toBe(true)
    })
    it('reports an unknown example, agent and mode', () => {
      expect(paths(withBranches({ example_id: 'nope' }))).toContain('scenario2_branches.example_id')
      expect(paths(withBranches({ agent_model: 'nope' }))).toContain('scenario2_branches.agent_model')
      expect(paths(withBranches({ mode: 'nope' }))).toContain('scenario2_branches.mode')
    })
    it('requires a clarification as opening turn', () => {
      expect(paths(withBranches({ opening_turn: turn }))).toContain('scenario2_branches.opening_turn')
    })
    it('requires reply and provenance on a recorded branch', () => {
      expect(paths(withBranches({ branches: [branch({ user_reply: null })] }))).toContain('scenario2_branches.branches[0].user_reply')
      expect(paths(withBranches({ branches: [branch({ provenance: null })] }))).toContain('scenario2_branches.branches[0].provenance')
    })
    it('refuses two branches with the same id', () => {
      expect(paths(withBranches({ branches: [branch(), branch()] }))).toContain('scenario2_branches.branches[1].id')
    })
  })

  describe('the full trace of a rejected candidate', () => {
    const rejected = (d: ReturnType<typeof raw>) => d.scenario1_generation_traces.find((t: { outcome: string }) => t.outcome === 'rejected')
    const s7vote = (d: ReturnType<typeof raw>) => rejected(d).validation.find((v: { stage: number }) => v.stage === 7).votes[1]

    it('accepts the SQL of a vote, whether it runs and whether it is judged valid', () => {
      const d = raw()
      Object.assign(s7vote(d), { sql: 'SELECT 1', executes: true, judged_valid: true })
      Object.assign(rejected(d).question, { db_id: 'california_schools', evidence: ['e'], feedback: 'f' })
      const r = parseDemoData(d)
      expect(r.ok).toBe(true)
      if (r.ok) {
        const v = r.data.scenario1_generation_traces.find((t) => t.outcome === 'rejected')!.validation.find((x) => x.stage === 7)!.votes[1]
        expect(v).toMatchObject({ sql: 'SELECT 1', executes: true, judged_valid: true })
      }
    })
    it('still accepts the April trace, which has none of these fields', () => {
      const d = raw()
      expect(s7vote(d).sql).toBeUndefined()
      expect(parseDemoData(d).ok).toBe(true)
    })
    it('refuses a vote whose executes is not a boolean', () => {
      const d = raw()
      s7vote(d).executes = 'yes'
      expect(parseDemoData(d).ok).toBe(false)
    })
    it('refuses a candidate whose evidence is not a list', () => {
      const d = raw()
      rejected(d).question.evidence = 'e'
      expect(parseDemoData(d).ok).toBe(false)
    })
  })

  describe('models.agents[].in_council', () => {
    it('is optional', () => {
      const d = raw()
      for (const a of d.models.agents) delete a.in_council
      expect(parseDemoData(d).ok).toBe(true)
    })
    it('must be a boolean', () => {
      const d = raw()
      d.models.agents[0].in_council = 'yes'
      expect(parseDemoData(d).ok).toBe(false)
    })
  })

  it('accepts the mark of a measured time on the turn of an agent and refuses one that is not a boolean', () => {
    const d = raw()
    const turn = d.scenario2_branches.branches.find((b: { id: string }) => b.id === 'distributive').turns[0]
    turn.latency_measured = true
    expect(parseDemoData(d).ok).toBe(true)
    turn.latency_measured = 'yes'
    expect(parseDemoData(d).ok).toBe(false)
  })

  describe('attempt of stage 7, as the run logs it', () => {
    const vote = (d: ReturnType<typeof raw>) => d.scenario1_generation_traces.flatMap((t: { validation: { stage: number; votes: unknown[] }[] }) => t.validation).find((s: { stage: number; votes: unknown[] }) => s.stage === 7 && s.votes.length).votes[0]
    it('accepts problem, rows, judges and the mark of the writer', () => {
      const d = raw()
      Object.assign(vote(d), { problem: 'error', row_count: 3, wrote_question: true, judgments: [{ model: 'm', accepted: true, rationale: null, wrote_question: true }] })
      expect(parseDemoData(d).ok).toBe(true)
    })
    it('refuses a judge without a verdict', () => {
      const d = raw()
      Object.assign(vote(d), { judgments: [{ model: 'm', rationale: null }] })
      expect(parseDemoData(d).ok).toBe(false)
    })
  })
})

describe('parseDemoData, optional fields of the second version', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'aaaa000000000001',
    collection: 'BIRD',
    db_id: 'california_schools',
    subcategory: 'scope',
    type: 'ambiguous',
    style: 'formal',
    requested_difficulty: 'simple',
    generator_model: 'GPT-OSS-120B',
    nlq: 'q',
    outcome: 'rejected',
    rejected_at_stage: 2,
    meanings: 2,
    ...over,
  })
  const v2 = () => {
    const d = raw()
    d.collections = [{ id: 'BIRD', name: 'BIRD', status: 'replay', source: 's', n_databases: 5 }]
    d.question_index = [row()]
    d.demo_defaults = { generate: 'aaaa000000000001' }
    d.overview = { input_formats: { items: ['.sqlite'], source: 's' }, taxonomy_origin: { text: 't', source: 's' } }
    d.models.agents.push({ id: 'new-system', name: 'New-System' })
    d.models.generators = ['GPT-OSS-120B']
    return d
  }
  const paths = (d: unknown) => {
    const r = parseDemoData(d)
    return r.ok ? [] : r.issues.map((i) => i.path)
  }

  it('accepts collections, the question index, the defaults, the overview and an agent without parameters', () => {
    expect(paths(v2())).toEqual([])
  })

  it('reports an index row pointing at an unknown database, subcategory or collection', () => {
    const d = v2()
    d.question_index = [row({ db_id: 'nope' }), row({ id: 'b', subcategory: 'nope' }), row({ id: 'c', collection: 'nope' })]
    d.demo_defaults = {}
    expect(paths(d)).toEqual(['question_index[0].db_id', 'question_index[1].subcategory', 'question_index[2].collection'])
  })

  it('reports a default question that is not in the index', () => {
    const d = v2()
    d.demo_defaults = { generate: 'missing' }
    expect(paths(d)).toEqual(['demo_defaults.generate'])
  })
})
