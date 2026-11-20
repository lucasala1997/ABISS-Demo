import { z } from 'zod'

/*
 * Zod schema for demo_data/abiss_demo_data.json.
 * Strict on the fields the UI reads, loose (passthrough) elsewhere so the JSON can grow.
 * Slots marked TO_FILL* are accepted; cross-references are checked after the shape.
 */

const TO_FILL = /^TO_FILL/
export const isToFill = (v: unknown): boolean => typeof v === 'string' && TO_FILL.test(v)

export const TypeId = z.enum(['answerable', 'ambiguous', 'unanswerable'])
export const Provenance = z.enum(['annotated', 'logged', 'illustrative'])
export const RelevancyId = z.enum(['relevant', 'technical', 'irrelevant'])
/** How a council stage turns the votes into pass/fail (see src/data/votes.ts). */
export const DecisionRule = z.enum(['majority_keeps', 'majority_removes', 'any_removes', 'pairwise', 'one_query_removes', 'any_keeps'])

const Meta = z.looseObject({
  schema_version: z.string(),
  title: z.string(),
  timings_are_estimates: z.boolean(),
  timings_note: z.string().optional(),
  examples_are_provisional: z.boolean().optional(),
  demo_default_db: z.string().optional(),
})

const Agent = z.looseObject({
  id: z.string(),
  name: z.string(),
  params: z.string().optional(),
  est_turn_latency_ms: z.number().optional(),
  /** the agent is one of models.council: shown as "council member" */
  in_council: z.boolean().optional(),
})

const Models = z.looseObject({
  council: z.array(z.string()).min(1),
  agents: z.array(Agent).min(1),
  demo_default_agent: z.string(),
  /** the models that write the questions in the run */
  generators: z.array(z.string()).optional(),
})

const Subcategory = z.looseObject({ id: z.string(), name: z.string(), definition: z.string() })

const Taxonomy = z.looseObject({
  types: z.array(z.looseObject({ id: TypeId, label: z.string(), color_token: z.string() })),
  categories: z.array(
    z.looseObject({ id: z.string(), name: z.string(), type: TypeId, subcategories: z.array(Subcategory).min(1) }),
  ),
})

/** Counts of one stage in one run. Records count each interpretation of an ambiguous question; questions count it once. */
const StageRunCounts = z.looseObject({
  checked_records: z.number().int(),
  removed_records: z.number().int(),
  partner_records: z.number().int(),
  left_records: z.number().int(),
  removed_questions: z.number().int(),
})

const ValidationStage = z.looseObject({
  id: z.number().int(),
  name: z.string(),
  applies_to: z.array(TypeId),
  uses_council: z.boolean(),
  paper_reject_rate: z.number().nullable().optional(),
  notes: z.string(),
  est_latency_ms: z.number().optional(),
  decision_rule: DecisionRule.optional(),
  /** a check that runs before stage 1 and has no number of its own */
  pre_check: z.boolean().optional(),
  /** when the stage checks only some subcategories of the types in applies_to */
  applies_to_subcategories: z.array(z.string()).optional(),
  /** what the stage did in the run, by collection id */
  run_counts: z.record(z.string(), StageRunCounts).optional(),
  /** what a `true` (or 0/1) vote means, and how the stage decides: shown as tooltips */
  vote_meaning: z.string().optional(),
  decision: z.string().optional(),
  /** short label for each raw vote value, keyed by String(raw) */
  vote_labels: z.record(z.string(), z.string()).optional(),
})

const SimulatedUser = z.looseObject({
  relevancy_labels: z.array(z.looseObject({ id: RelevancyId, label: z.string(), grounded_in: z.string() })),
  tie_break: RelevancyId,
  allowed_labels_by_type: z.record(z.string(), z.array(z.string())),
  max_clarification_turns: z.number().int().min(0),
  est_latency_ms: z.looseObject({
    label_vote_per_model: z.number(),
    reply_generation_per_model: z.number(),
    pairwise_tournament: z.number(),
    direct_refusal: z.number(),
  }),
})

const CategoryMode = z.looseObject({ id: z.string(), label: z.string(), system_sees: z.string() })

const Column = z.looseObject({ name: z.string(), type: z.string().optional(), pk: z.boolean().optional(), description: z.string().optional() })
const ForeignKey = z.looseObject({ column: z.string(), ref_table: z.string(), ref_column: z.string() })
const Table = z.looseObject({
  name: z.string(),
  columns: z.array(Column),
  foreign_keys: z.array(ForeignKey).optional(),
  /** the CREATE TABLE statement and the first rows, as the prompts show them to the models */
  create_sql: z.string().optional(),
  sample_rows: z.looseObject({ columns: z.array(z.string()), rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))) }).optional(),
})

const Database = z.looseObject({
  id: z.string(),
  dataset: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  used_by: z.array(z.string()),
  schema_status: z.string(),
  tables: z.array(Table),
  knowledge_base: z.array(z.string()),
})

const ExampleHead = z.looseObject({ id: z.string(), status: z.string(), subcategory: z.string() })

const SelectedExample = z.looseObject({
  id: z.string(),
  status: z.string(),
  subcategory: z.string(),
  type: TypeId,
  dataset: z.string(),
  db_id: z.string(),
  style: z.string(),
  difficulty: z.string(),
  nlq: z.string(),
  evidence: z.array(z.string()),
  hidden_knowledge: z.string().nullable(),
  gt_sql: z.array(z.string()).max(2),
  feedback: z.string().nullable(),
  provenance: Provenance,
  alternatives_record_indices: z.array(z.number().int()),
  annotation: z.looseObject({ record_index: z.number().int() }).optional(),
})

const CouncilJudgment = z.looseObject({
  model: z.string(),
  accepted: z.boolean(),
  rationale: z.string().nullable(),
  wrote_question: z.boolean().optional(),
})

const CouncilVote = z.looseObject({
  model: z.string(),
  /** whether this vote speaks for keeping the question (derived from `raw` and the stage rule); none = no usable result, it leaves the count */
  vote: z.enum(['pass', 'fail', 'none']),
  raw: z.union([z.boolean(), z.number(), z.null()]).optional(),
  /** stage 6 of the final run: this model's query gives the reference result of every reading, which removes the question */
  on_every_reading: z.boolean().optional(),
  /** pairwise stages: the subcategory id the question's own category is compared with */
  against: z.string().optional(),
  est_latency_ms: z.number().nullable().optional(),
  rationale: z.string().nullable(),
  /** stage 7, when the run logged the attempt: the query the model wrote, whether it runs and why not, its rows */
  sql: z.string().optional(),
  executes: z.boolean().optional(),
  problem: z.string().optional(),
  row_count: z.number().int().optional(),
  /** whether a majority of the council accepted the query, and how each judge voted; absent if it did not reach the judges */
  judged_valid: z.boolean().optional(),
  judgments: z.array(CouncilJudgment).optional(),
  /** the model that wrote the question: its vote stays on record but does not count */
  wrote_question: z.boolean().optional(),
})

const GenerationStep = z.looseObject({
  step: z.string(),
  /** null when the run did not log which model generated this step */
  model: z.string().nullable(),
  est_latency_ms: z.number(),
  output_ref: z.string(),
})

const StageResult = z.looseObject({
  stage: z.number().int(),
  outcome: z.enum(['pass', 'fail', 'skipped']),
  est_latency_ms: z.number(),
  votes: z.array(CouncilVote),
  reason: z.string().nullable().optional(),
})

/** A logged candidate kept only as text (e.g. a rejected one: the run stored its votes, not its NLQ object). */
const TraceQuestion = z.looseObject({
  nlq: z.string(),
  type: TypeId,
  dataset: z.string(),
  subcategory: z.string().nullable(),
  db_id: z.string().nullable(),
  /** an empty list: the run logged the question and it has no evidence; absent: not logged */
  evidence: z.array(z.string()).optional(),
  feedback: z.string().nullable().optional(),
  style: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  generator_model: z.string().nullable().optional(),
})

const GenerationTrace = z.looseObject({
  /** null when the trace carries its own `question` instead of pointing at an example */
  example_id: z.string().nullable(),
  question: TraceQuestion.optional(),
  /** what the run did not record for this trace, shown next to the question */
  not_logged: z.array(z.string()).optional(),
  source: z.string().optional(),
  provenance: Provenance,
  outcome: z.enum(['accepted', 'rejected']),
  rejected_at_stage: z.number().int().optional(),
  rejection_reason: z.string().nullable().optional(),
  note: z.string().optional(),
  generation: z.array(GenerationStep),
  validation: z.array(StageResult),
})

const AgentTurn = z.looseObject({
  role: z.literal('agent'),
  /** failed: the system gave no single valid action, and the conversation ends without an answer */
  action: z.enum(['clarification', 'sql', 'feedback', 'failed']),
  text: z.string().optional(),
  sql: z.string().optional(),
  est_latency_ms: z.number().optional(),
  /** true: the call has a time of its own, measured. The turns of a batch run do not, and stay estimates */
  latency_measured: z.boolean().optional(),
})

/** The council's pairwise contest between candidate replies: every judge compares every pair. */
const AnswerContest = z.looseObject({
  judgments: z.array(z.looseObject({ judge: z.string(), a: z.string(), b: z.string(), winner: z.string() })),
  wins: z.record(z.string(), z.number()),
  winner: z.string(),
  margin: z.number(),
})

/** Final run: the council members answer in a drawn order, and the first reply that passes the leak check is used. */
const ReplyChoice = z.looseObject({
  order: z.array(z.string()),
  answer_model: z.string().nullable(),
  all_leaked: z.boolean(),
  answers: z.array(z.looseObject({ model: z.string(), text: z.string(), clean: z.boolean(), violations: z.array(z.string()) })),
})

const UserTurn = z.looseObject({
  role: z.literal('simulated_user'),
  relevancy: RelevancyId,
  /** tested_system: this council member is also the system that asked the clarification; its vote counts as the others */
  votes: z.array(z.looseObject({ model: z.string(), label: RelevancyId, tested_system: z.boolean().optional() })),
  text: z.string(),
  est_latency_ms: z.number().optional(),
  contest: AnswerContest.optional(),
  choice: ReplyChoice.optional(),
  /** unanswerable question: a fixed refusal sentence, the council is not asked */
  fixed_refusal: z.boolean().optional(),
  /** under Technical: the fragments of the reference SQL the reply could use */
  resolved_fragments: z.array(z.string()).optional(),
  /** the votes gave Technical, but they pointed to no usable part of the reference SQL: the turn counts as Irrelevant */
  technical_without_node: z.boolean().optional(),
  /** a reply written by hand, not by the simulated user */
  by_hand: z.boolean().optional(),
})

export const Turn = z.discriminatedUnion('role', [AgentTurn, UserTurn])

const ModeRun = z.looseObject({
  turns: z.array(Turn),
  terminal: z.unknown().nullable(),
  correct: z.boolean().nullable(),
})

const ModeComparison = z.looseObject({
  example_id: z.string(),
  agent_model: z.string(),
  provenance: Provenance,
  predicted_subcategory: z.string().nullable(),
  modes: z.record(z.string(), ModeRun),
  note: z.string().optional(),
})

/** How a recorded branch ends. */
const BranchTerminal = z.looseObject({
  action: z.enum(['sql', 'feedback']),
  by: z.enum(['agent', 'human']),
  sql: z.string().optional(),
  text: z.string().optional(),
})

/** One recorded continuation of Ask the agent. No turns = the run has not arrived: the button stays disabled. */
const ScenarioBranch = z.looseObject({
  id: z.enum(['collective', 'distributive']),
  label: z.string(),
  user_reply: z.string().nullable(),
  turns: z.array(AgentTurn),
  terminal: BranchTerminal.nullable(),
  /** null: no reference SQL for this reading */
  correct: z.boolean().nullable(),
  provenance: Provenance.nullable(),
  /** where the reply and the turns come from, shown next to the dialogue */
  origin_note: z.string().nullable().optional(),
  /** what the outcome is measured against */
  outcome_note: z.string().nullable().optional(),
  reference_sql: z.string().nullable().optional(),
  reference_source_index: z.number().int().nullable().optional(),
  source: z.string().optional(),
})

const ScenarioBranches = z.looseObject({
  example_id: z.string(),
  agent_model: z.string(),
  mode: z.string(),
  opening_turn: AgentTurn,
  branches: z.array(ScenarioBranch).min(1),
})

const WhatIfVariant = z.looseObject({
  id: z.string(),
  label: z.string(),
  change: z
    .looseObject({ kind: z.enum(['schema', 'knowledge']), add: z.string().optional(), remove: z.string().optional() })
    .nullable(),
  resulting_type: TypeId,
  resulting_subcategory: z.string(),
  explanation: z.string(),
})

const WhatIf = z.looseObject({
  hidden_by_default: z.boolean(),
  items: z.array(
    z.looseObject({ example_id: z.string(), provenance: Provenance, variants: z.array(WhatIfVariant).min(1) }),
  ),
})

const MetricRow = z.looseObject({ ex_ans: z.number(), ex_amb: z.number(), fb: z.number(), air: z.number().optional() })

const PaperResults = z.looseObject({
  source: z.string(),
  ablation: z.record(z.string(), z.record(z.string(), MetricRow)),
  dataset_sizes: z.record(z.string(), z.number()).optional(),
  simulator_audit: z.record(z.string(), z.number()).optional(),
})

const Collection = z.looseObject({
  id: z.string(),
  name: z.string(),
  /** replay: the demo holds its questions; results_only: only its paper results */
  status: z.enum(['replay', 'results_only']),
  source: z.string(),
  n_databases: z.number().int(),
})

/** The dialogues recorded for a question with one system: by category mode, one outcome per interpretation (null = no dialogue). */
const BenchmarkedEntry = z.looseObject({ system: z.string(), results: z.record(z.string(), z.array(z.boolean().nullable())) })

/** One row per question of a run: what the filters and the cards need without loading its detail file. */
const QuestionIndexRow = z.looseObject({
  id: z.string(),
  collection: z.string(),
  db_id: z.string(),
  subcategory: z.string(),
  type: TypeId,
  style: z.string(),
  requested_difficulty: z.string(),
  generator_model: z.string().nullable(),
  nlq: z.string(),
  outcome: z.enum(['accepted', 'rejected']),
  rejected_at_stage: z.number().int().optional(),
  meanings: z.number().int().min(1),
  /** a question of an earlier run, kept only for its dialogues */
  run: z.literal('legacy').optional(),
  benchmarked: z.array(BenchmarkedEntry).optional(),
})

const Overview = z.looseObject({
  input_formats: z.looseObject({ items: z.array(z.string()), source: z.string() }).optional(),
  taxonomy_origin: z.looseObject({ text: z.string(), source: z.string() }).optional(),
})

const DemoDataShape = z.object({
  meta: Meta,
  models: Models,
  styles: z.array(z.string()),
  difficulties: z.array(z.string()),
  taxonomy: Taxonomy,
  validation_stages: z.array(ValidationStage),
  simulated_user: SimulatedUser,
  category_modes: z.array(CategoryMode),
  databases: z.array(Database),
  examples: z.array(ExampleHead),
  scenario1_generation_traces: z.array(GenerationTrace),
  scenario2_branches: ScenarioBranches.optional(),
  scenario3_mode_comparisons: z.array(ModeComparison),
  scenario4_whatif: WhatIf,
  paper_results: PaperResults,
  collections: z.array(Collection).optional(),
  question_index: z.array(QuestionIndexRow).optional(),
  demo_defaults: z.looseObject({ generate: z.string().optional(), benchmark: z.string().optional(), modes: z.string().optional() }).optional(),
  overview: Overview.optional(),
})

export type TypeIdT = z.infer<typeof TypeId>
export type ProvenanceT = z.infer<typeof Provenance>
export type RelevancyIdT = z.infer<typeof RelevancyId>
export type DecisionRuleT = z.infer<typeof DecisionRule>
export type TraceQuestion = z.infer<typeof TraceQuestion>
export type AnswerContest = z.infer<typeof AnswerContest>
export type AgentModel = z.infer<typeof Agent>
export type Subcategory = z.infer<typeof Subcategory>
export type ValidationStage = z.infer<typeof ValidationStage>
export type CategoryMode = z.infer<typeof CategoryMode>
export type Database = z.infer<typeof Database>
export type Table = z.infer<typeof Table>
export type CouncilVote = z.infer<typeof CouncilVote>
export type GenerationTrace = z.infer<typeof GenerationTrace>
export type StageResult = z.infer<typeof StageResult>
export type Turn = z.infer<typeof Turn>
export type AgentTurn = z.infer<typeof AgentTurn>
export type UserTurn = z.infer<typeof UserTurn>
export type ModeComparison = z.infer<typeof ModeComparison>
export type ScenarioBranch = z.infer<typeof ScenarioBranch>
export type ScenarioBranches = z.infer<typeof ScenarioBranches>
export type WhatIfVariant = z.infer<typeof WhatIfVariant>
export type MetricRow = z.infer<typeof MetricRow>
export type Collection = z.infer<typeof Collection>
export type BenchmarkedEntry = z.infer<typeof BenchmarkedEntry>
export type QuestionIndexRow = z.infer<typeof QuestionIndexRow>
export type StageRunCounts = z.infer<typeof StageRunCounts>
export type ReplyChoice = z.infer<typeof ReplyChoice>

export type SelectedExample = z.infer<typeof SelectedExample> & { selected: true }
export type PlaceholderExample = z.infer<typeof ExampleHead> & { selected: false }
export type Example = SelectedExample | PlaceholderExample

export type DemoData = Omit<z.infer<typeof DemoDataShape>, 'examples'> & { examples: Example[] }

export interface Issue {
  path: string
  message: string
}

export type ParseResult = { ok: true; data: DemoData } | { ok: false; issues: Issue[] }

export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  let out = ''
  for (const p of path) out += typeof p === 'number' ? `[${p}]` : `${out ? '.' : ''}${String(p)}`
  return out || '(root)'
}

function crossCheck(d: z.infer<typeof DemoDataShape>, examples: Example[], issues: Issue[]) {
  const add = (path: string, message: string) => issues.push({ path, message })
  const subcatType = new Map<string, string>()
  for (const c of d.taxonomy.categories) for (const s of c.subcategories) subcatType.set(s.id, c.type)
  const dbIds = new Set(d.databases.map((x) => x.id))
  const exIds = new Set(examples.map((e) => e.id))
  const stageIds = new Set(d.validation_stages.map((s) => s.id))
  const modeIds = new Set(d.category_modes.map((m) => m.id))
  const agentIds = new Set(d.models.agents.map((a) => a.id))

  if (!agentIds.has(d.models.demo_default_agent))
    add('models.demo_default_agent', `unknown agent "${d.models.demo_default_agent}"`)

  examples.forEach((e, i) => {
    if (!subcatType.has(e.subcategory)) add(`examples[${i}].subcategory`, `unknown subcategory "${e.subcategory}"`)
    if (!e.selected) return
    if (!dbIds.has(e.db_id)) add(`examples[${i}].db_id`, `unknown database "${e.db_id}"`)
    const t = subcatType.get(e.subcategory)
    if (t && t !== e.type) add(`examples[${i}].type`, `type "${e.type}" does not match subcategory type "${t}"`)
  })

  const refEx = (path: string, id: string) => {
    if (!isToFill(id) && !exIds.has(id)) add(path, `unknown example "${id}"`)
  }

  d.scenario1_generation_traces.forEach((t, i) => {
    if (t.example_id !== null) refEx(`scenario1_generation_traces[${i}].example_id`, t.example_id)
    else if (!t.question) add(`scenario1_generation_traces[${i}].example_id`, 'null requires a "question" object')
    if (t.question?.subcategory && !subcatType.has(t.question.subcategory))
      add(`scenario1_generation_traces[${i}].question.subcategory`, `unknown subcategory "${t.question.subcategory}"`)
    if (t.question?.db_id && !dbIds.has(t.question.db_id)) add(`scenario1_generation_traces[${i}].question.db_id`, `unknown database "${t.question.db_id}"`)
    t.generation.forEach((g, j) => {
      const m = g.output_ref.match(/^examples\[([^\]]+)\]/)
      if (!m) add(`scenario1_generation_traces[${i}].generation[${j}].output_ref`, 'expected "examples[<id>]..."')
      else refEx(`scenario1_generation_traces[${i}].generation[${j}].output_ref`, m[1])
    })
    t.validation.forEach((s, j) => {
      if (!stageIds.has(s.stage)) add(`scenario1_generation_traces[${i}].validation[${j}].stage`, `unknown stage ${s.stage}`)
      s.votes.forEach((v, k) => {
        if (v.against !== undefined && !subcatType.has(v.against))
          add(`scenario1_generation_traces[${i}].validation[${j}].votes[${k}].against`, `unknown subcategory "${v.against}"`)
      })
    })
    if (t.outcome === 'rejected' && t.rejected_at_stage === undefined)
      add(`scenario1_generation_traces[${i}].rejected_at_stage`, 'required when outcome is "rejected"')
  })

  const sb = d.scenario2_branches
  if (sb) {
    refEx('scenario2_branches.example_id', sb.example_id)
    if (!agentIds.has(sb.agent_model)) add('scenario2_branches.agent_model', `unknown agent "${sb.agent_model}"`)
    if (!modeIds.has(sb.mode)) add('scenario2_branches.mode', `unknown category mode "${sb.mode}"`)
    if (sb.opening_turn.action !== 'clarification') add('scenario2_branches.opening_turn', 'expected a clarification')
    const seen = new Set<string>()
    sb.branches.forEach((b, i) => {
      const at = `scenario2_branches.branches[${i}]`
      if (seen.has(b.id)) add(`${at}.id`, `duplicate branch "${b.id}"`)
      seen.add(b.id)
      if (b.turns.length === 0) return
      if (b.user_reply === null) add(`${at}.user_reply`, 'a recorded branch needs the reply that leads to it')
      if (b.provenance === null) add(`${at}.provenance`, 'a recorded branch needs a provenance')
    })
  }

  d.scenario3_mode_comparisons.forEach((c, i) => {
    refEx(`scenario3_mode_comparisons[${i}].example_id`, c.example_id)
    if (!agentIds.has(c.agent_model)) add(`scenario3_mode_comparisons[${i}].agent_model`, `unknown agent "${c.agent_model}"`)
    if (c.predicted_subcategory && !subcatType.has(c.predicted_subcategory))
      add(`scenario3_mode_comparisons[${i}].predicted_subcategory`, `unknown subcategory "${c.predicted_subcategory}"`)
    for (const k of Object.keys(c.modes))
      if (!modeIds.has(k)) add(`scenario3_mode_comparisons[${i}].modes.${k}`, `unknown category mode "${k}"`)
  })

  const collectionIds = new Set(d.collections?.map((c) => c.id))
  const indexIds = new Set<string>()
  d.question_index?.forEach((q, i) => {
    indexIds.add(q.id)
    if (!dbIds.has(q.db_id)) add(`question_index[${i}].db_id`, `unknown database "${q.db_id}"`)
    if (!subcatType.has(q.subcategory)) add(`question_index[${i}].subcategory`, `unknown subcategory "${q.subcategory}"`)
    if (!collectionIds.has(q.collection)) add(`question_index[${i}].collection`, `unknown collection "${q.collection}"`)
  })
  for (const [screen, id] of Object.entries(d.demo_defaults ?? {}))
    if (typeof id === 'string' && !indexIds.has(id)) add(`demo_defaults.${screen}`, `question "${id}" is not in question_index`)

  d.scenario4_whatif.items.forEach((it, i) => {
    refEx(`scenario4_whatif.items[${i}].example_id`, it.example_id)
    it.variants.forEach((v, j) => {
      if (!subcatType.has(v.resulting_subcategory))
        add(`scenario4_whatif.items[${i}].variants[${j}].resulting_subcategory`, `unknown subcategory "${v.resulting_subcategory}"`)
    })
  })
}

export function parseDemoData(input: unknown): ParseResult {
  const shape = DemoDataShape.safeParse(input)
  if (!shape.success) {
    return { ok: false, issues: shape.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })) }
  }
  const issues: Issue[] = []
  const examples: Example[] = shape.data.examples.map((head, i) => {
    if (isToFill(head.status)) return { ...head, selected: false as const }
    const full = SelectedExample.safeParse(head)
    if (!full.success) {
      for (const iss of full.error.issues) issues.push({ path: formatPath(['examples', i, ...iss.path]), message: iss.message })
      return { ...head, selected: false as const }
    }
    return { ...full.data, selected: true as const }
  })
  crossCheck(shape.data, examples, issues)
  if (issues.length) return { ok: false, issues }
  return { ok: true, data: { ...shape.data, examples } }
}
