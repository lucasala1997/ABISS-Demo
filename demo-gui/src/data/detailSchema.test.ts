import { describe, expect, it } from 'vitest'
import { parseDialoguesFile, parseQuestionsFile } from './detailSchema'

const question = () => ({
  id: 'aaaa000000000001',
  type: 'answerable',
  subcategory: 'ans_without_evidence',
  db_id: 'california_schools',
  style: 'formal',
  requested_difficulty: 'simple',
  generator_model: 'GPT-OSS-120B',
  nlq: 'How many schools?',
  evidence: [],
  meanings: [{ record_id: 'q_aaaa000000000001_0', hidden_knowledge: null, gt_sql: 'SELECT 1', feedback: null, difficulty: 'simple' }],
  outcome: 'accepted',
  generation: [{ step: 'question', model: 'GPT-OSS-120B', meaning: null }],
  validation: [{ stage: 3, outcome: 'pass', checks: [{ meaning: null, outcome: 'pass', reasons: [], partner_removed: false, votes: [{ model: 'm', vote: 'pass', raw: true, rationale: 'because' }] }] }],
  provenance: 'logged',
})
const questionsFile = () => ({ collection: 'BIRD', db_id: 'california_schools', subcategory: 'ans_without_evidence', source: 's', questions: [question()] })

describe('parseQuestionsFile', () => {
  it('accepts a minimal file', () => {
    expect(parseQuestionsFile(questionsFile()).ok).toBe(true)
  })

  it('reports the path of a missing field', () => {
    const f = questionsFile() as { questions: Record<string, unknown>[] }
    delete f.questions[0].validation
    const r = parseQuestionsFile(f)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0].path).toBe('questions[0].validation')
  })
})

describe('parseDialoguesFile', () => {
  it('accepts a user turn with the record of how its reply was chosen', () => {
    const r = parseDialoguesFile({
      collection: 'BIRD',
      db_id: 'california_schools',
      subcategory: 'scope',
      source: 's',
      dialogues: [
        {
          question_id: 'aaaa000000000001',
          question: { nlq: 'q', type: 'ambiguous', evidence: [], meanings: [{ hidden_knowledge: 'h', gt_sql: 'SELECT 1', feedback: null }] },
          runs: [
            {
              system: 'sys',
              mode: 'ground_truth',
              meaning: 0,
              predicted_subcategory: null,
              correct: true,
              explained: null,
              provenance: 'logged',
              turns: [
                { role: 'agent', action: 'clarification', text: 'which?' },
                {
                  role: 'simulated_user',
                  relevancy: 'relevant',
                  votes: [{ model: 'a', label: 'relevant' }],
                  text: 'this one',
                  choice: { order: ['a', 'b'], answer_model: 'b', all_leaked: false, answers: [{ model: 'a', text: 'x', clean: false, violations: ['leak'] }, { model: 'b', text: 'this one', clean: true, violations: [] }] },
                },
                { role: 'agent', action: 'failed', text: 'two actions' },
              ],
            },
          ],
        },
      ],
    })
    expect(r.ok ? [] : r.issues).toEqual([])
  })
})
