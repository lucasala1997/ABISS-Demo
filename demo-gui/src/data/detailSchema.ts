import { z } from 'zod'
import { Provenance, Turn, TypeId, formatPath, type Issue } from './schema'

/*
 * Zod schemas of the detail files, loaded when a database and a subcategory are chosen:
 * - data/questions/<collection>/<db>/<subcategory>.json: the candidates with their generation and validation trace;
 * - data/dialogues/<collection>/<db>/<subcategory>.json: the recorded dialogues of the benchmark.
 */

const Judgment = z.looseObject({ model: z.string(), accepted: z.boolean(), rationale: z.string().nullable(), wrote_question: z.boolean().optional() })

const RunVote = z.looseObject({
  model: z.string(),
  /** whether this vote speaks for keeping the question; none = no usable result, it leaves the count */
  vote: z.enum(['pass', 'fail', 'none']),
  raw: z.union([z.boolean(), z.number(), z.null()]).optional(),
  /** pairwise stage: the subcategory id the own category is compared with */
  against: z.string().optional(),
  /** what the model stated after its reasoning; null for a computed vote */
  rationale: z.string().nullable(),
  /** the model that wrote the question: its vote stays on record but does not count */
  wrote_question: z.boolean().optional(),
  /** challenger stages: the query the model wrote, whether it ran, its rows */
  sql: z.string().nullable().optional(),
  executes: z.boolean().optional(),
  problem: z.string().optional(),
  row_count: z.number().int().optional(),
  /** stage 7: whether the counted judges accepted the query, and how each judge voted */
  judged_valid: z.boolean().optional(),
  judgments: z.array(Judgment).optional(),
})

const StageCheck = z.looseObject({
  /** the interpretation this check is about; null = judged once for the whole question */
  meaning: z.number().int().nullable(),
  outcome: z.enum(['pass', 'fail']),
  /** the reasons the run wrote for a removal */
  reasons: z.array(z.string()),
  /** removed only because the other interpretation was removed */
  partner_removed: z.boolean(),
  votes: z.array(RunVote),
})

const StageRun = z.looseObject({
  stage: z.number().int(),
  /** skipped: the stage does not apply to this question; unreached: the question was removed before */
  outcome: z.enum(['pass', 'fail', 'skipped', 'unreached']),
  checks: z.array(StageCheck),
})

const Meaning = z.looseObject({
  record_id: z.string(),
  hidden_knowledge: z.string().nullable(),
  gt_sql: z.string().nullable(),
  feedback: z.string().nullable(),
  /** measured from the SQL; the requested one for an unanswerable question */
  difficulty: z.string(),
})

const QuestionDetail = z.looseObject({
  id: z.string(),
  type: TypeId,
  subcategory: z.string(),
  db_id: z.string(),
  style: z.string(),
  requested_difficulty: z.string(),
  generator_model: z.string(),
  nlq: z.string(),
  evidence: z.array(z.string()),
  meanings: z.array(Meaning).min(1),
  outcome: z.enum(['accepted', 'rejected']),
  rejected_at_stage: z.number().int().optional(),
  generation: z.array(z.looseObject({ step: z.enum(['question', 'sql']), model: z.string(), meaning: z.number().int().nullable() })),
  /** one entry per stage of validation_stages */
  validation: z.array(StageRun),
  provenance: Provenance,
})

const QuestionsFile = z.looseObject({
  collection: z.string(),
  db_id: z.string(),
  subcategory: z.string(),
  source: z.string(),
  questions: z.array(QuestionDetail),
})

const DialogueRun = z.looseObject({
  system: z.string(),
  mode: z.string(),
  meaning: z.number().int(),
  turns: z.array(Turn),
  predicted_subcategory: z.string().nullable(),
  /** EX for an answerable or ambiguous question; null where it does not apply */
  correct: z.boolean().nullable(),
  /** FB for an unanswerable question; null where it does not apply */
  explained: z.boolean().nullable(),
  matches_other_meaning: z.boolean().nullable().optional(),
  /** why EX gave its verdict, where it compared the result of the answer with the reference */
  ex_status: z.enum(['match', 'mismatch', 'error', 'timeout', 'no_result']).optional(),
  origin_note: z.string().nullable().optional(),
  outcome_note: z.string().nullable().optional(),
  reference_sql: z.string().nullable().optional(),
  provenance: Provenance,
})

const QuestionDialogues = z.looseObject({
  question_id: z.string(),
  question: z.looseObject({
    nlq: z.string(),
    type: TypeId,
    evidence: z.array(z.string()),
    meanings: z.array(z.looseObject({ hidden_knowledge: z.string().nullable(), gt_sql: z.string().nullable(), feedback: z.string().nullable(), label: z.string().optional() })).min(1),
  }),
  runs: z.array(DialogueRun),
})

const DialoguesFile = z.looseObject({
  collection: z.string(),
  db_id: z.string(),
  subcategory: z.string(),
  source: z.string(),
  dialogues: z.array(QuestionDialogues),
})

export type RunVote = z.infer<typeof RunVote>
export type StageCheck = z.infer<typeof StageCheck>
export type StageRun = z.infer<typeof StageRun>
export type Meaning = z.infer<typeof Meaning>
export type QuestionDetail = z.infer<typeof QuestionDetail>
export type QuestionsFile = z.infer<typeof QuestionsFile>
export type DialogueRun = z.infer<typeof DialogueRun>
export type QuestionDialogues = z.infer<typeof QuestionDialogues>
export type DialoguesFile = z.infer<typeof DialoguesFile>

export type DetailParse<T> = { ok: true; data: T } | { ok: false; issues: Issue[] }

function parseWith<T>(schema: z.ZodType<T>, input: unknown): DetailParse<T> {
  const r = schema.safeParse(input)
  if (r.success) return { ok: true, data: r.data }
  return { ok: false, issues: r.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })) }
}

export const parseQuestionsFile = (input: unknown): DetailParse<QuestionsFile> => parseWith(QuestionsFile, input)
export const parseDialoguesFile = (input: unknown): DetailParse<DialoguesFile> => parseWith(DialoguesFile, input)
