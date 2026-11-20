import type { DemoData, QuestionIndexRow } from './schema'
import { shortModel } from './selectors'

/*
 * The choices of the sentence on top of the three screens, and what they leave: which questions of the index match,
 * which values each menu offers, and how a selection that no longer has rows falls back. Pure functions over the demo JSON.
 */

export type Screen = 'generate' | 'benchmark' | 'modes'

export interface Selection {
  collection: string
  /** a database id, or 'all' */
  db: string
  subcategory: string | null
  style: string | null
  /** the difficulty asked of the writer */
  difficulty: string | null
  /** a writer model, or 'any' */
  generator: string
  questionId: string | null
  /** the interpretation of an ambiguous question: 0 or 1 */
  meaning: number
  system: string | null
  mode: string | null
}

export type Field = 'collection' | 'db' | 'subcategory' | 'style' | 'difficulty' | 'generator' | 'system' | 'mode'

export interface Option {
  value: string
  label: string
  /** the questions this value would leave */
  count: number
  disabled: boolean
  note?: string
}

/** the three parts of the question, chosen in any order */
const PARTS = ['subcategory', 'style', 'difficulty'] as const
type Part = (typeof PARTS)[number]
/** the parts of the sentence that filter the questions: a collection or a database clears the three parts of the question */
type ChainField = 'collection' | 'db' | Part
const UNSET_ORDER = ['subcategory', 'style', 'difficulty', 'questionId'] as const

const index = (d: DemoData) => d.question_index ?? []

/** Whether a question has a recorded dialogue with a system (null: any) in a mode (null: any). */
function hasDialogue(r: QuestionIndexRow, system: string | null, mode: string | null): boolean {
  return (r.benchmarked ?? []).some(
    (b) => (system === null || b.system === system) && Object.entries(b.results).some(([m, values]) => (mode === null || m === mode) && values.some((v) => v !== null)),
  )
}

export function rowsFor(d: DemoData, sel: Selection, screen: Screen): QuestionIndexRow[] {
  return index(d).filter((r) => {
    if (r.collection !== sel.collection) return false
    if (sel.db !== 'all' && r.db_id !== sel.db) return false
    if (sel.subcategory !== null && r.subcategory !== sel.subcategory) return false
    if (sel.style !== null && r.style !== sel.style) return false
    if (sel.difficulty !== null && r.requested_difficulty !== sel.difficulty) return false
    if (screen === 'generate') return r.run !== 'legacy' && (sel.generator === 'any' || r.generator_model === sel.generator)
    return hasDialogue(r, sel.system, screen === 'benchmark' ? sel.mode : null)
  })
}

/**
 * Of the three parts of the question, keeps in the given order those that still have questions together; clears the others.
 * With chosen, that part is kept whatever it leaves: it is the choice just made.
 */
function keepFitting(d: DemoData, sel: Selection, screen: Screen, order: readonly Part[], chosen?: Part): Selection {
  const kept: Selection = { ...sel, subcategory: null, style: null, difficulty: null }
  if (chosen) kept[chosen] = sel[chosen]
  for (const k of order) if (k !== chosen && sel[k] !== null && rowsFor(d, { ...kept, [k]: sel[k] }, screen).length > 0) kept[k] = sel[k]
  return kept
}

/**
 * The selection with one part of the chain set. A collection or a database clears the three parts of the question; one of
 * those parts keeps the other two where they still have questions with it, so that they can be chosen in any order.
 */
function withField(d: DemoData, sel: Selection, field: ChainField, value: string, screen: Screen): Selection {
  const next: Selection = { ...sel, questionId: null }
  if (field === 'collection' || field === 'db') {
    if (field === 'collection') next.collection = value
    next.db = field === 'collection' ? 'all' : value
    return { ...next, subcategory: null, style: null, difficulty: null }
  }
  next[field] = value
  return keepFitting(d, next, screen, PARTS, field)
}

const subcategories = (d: DemoData) => d.taxonomy.categories.flatMap((c) => c.subcategories)

function chainValues(d: DemoData, sel: Selection, field: ChainField): { value: string; label: string }[] {
  switch (field) {
    case 'collection':
      return (d.collections ?? []).map((c) => ({ value: c.id, label: c.name }))
    case 'db':
      return [{ value: 'all', label: 'all databases' }, ...[...new Set(index(d).filter((r) => r.collection === sel.collection).map((r) => r.db_id))].sort().map((id) => ({ value: id, label: id }))]
    case 'subcategory':
      return subcategories(d).map((s) => ({ value: s.id, label: s.name }))
    case 'style':
      return d.styles.map((s) => ({ value: s, label: s }))
    case 'difficulty':
      return d.difficulties.map((x) => ({ value: x, label: x.replace(/_/g, ' ') }))
  }
}

/** What a menu of the sentence offers: every value, with the questions it would leave. */
export function options(d: DemoData, sel: Selection, field: Field, screen: Screen): Option[] {
  const inCollection = index(d).filter((r) => r.collection === sel.collection)
  if (field === 'generator') {
    const count = (g: string) => rowsFor(d, { ...sel, generator: g }, 'generate').length
    return [{ value: 'any', label: 'any model' }, ...(d.models.generators ?? []).map((g) => ({ value: g, label: shortModel(g) }))].map((o) => ({ ...o, count: count(o.value), disabled: count(o.value) === 0 }))
  }
  if (field === 'system')
    return d.models.agents.map((a) => {
      const count = inCollection.filter((r) => hasDialogue(r, a.id, null)).length
      return { value: a.id, label: shortModel(a.name), count, disabled: count === 0, ...(count === 0 ? { note: 'not in this run' } : {}) }
    })
  if (field === 'mode')
    return d.category_modes.map((m) => {
      const count = inCollection.filter((r) => hasDialogue(r, sel.system, m.id)).length
      return { value: m.id, label: m.label, count, disabled: count === 0 }
    })
  return chainValues(d, sel, field).map((o) => {
    const resultsOnly = field === 'collection' && d.collections?.find((c) => c.id === o.value)?.status === 'results_only'
    const count = rowsFor(d, withField(d, sel, field, o.value, screen), screen).length
    return { ...o, count, disabled: count === 0, ...(resultsOnly ? { note: 'results only' } : {}) }
  })
}

/** The system and the mode a screen opens on: those of its default question, else of the first question with a dialogue. */
function defaultSystemMode(d: DemoData, collection: string, screen: Screen): { system: string | null; mode: string | null } {
  const wanted = screen === 'generate' ? undefined : d.demo_defaults?.[screen]
  const rows = index(d).filter((r) => r.collection === collection && r.benchmarked?.length)
  const entry = (rows.find((r) => r.id === wanted) ?? rows[0])?.benchmarked?.[0]
  return { system: entry?.system ?? null, mode: entry ? (Object.keys(entry.results)[0] ?? null) : null }
}

/**
 * A complete, valid selection from what the screen has (the choices made on another screen, or nothing).
 * fill = true (outside presentation): every part gets a value, the wanted question if it still matches, else the default
 * question of the screen, else the first one. fill = false (presentation): what is not chosen stays unchosen, and only the
 * values that no longer have questions are dropped.
 */
export function resolveSelection(d: DemoData, wanted: Partial<Selection>, screen: Screen, fill: boolean): Selection {
  const replay = (d.collections ?? []).filter((c) => c.status === 'replay').map((c) => c.id)
  const collection = wanted.collection && replay.includes(wanted.collection) ? wanted.collection : (replay[0] ?? index(d)[0]?.collection ?? '')
  const fallback = defaultSystemMode(d, collection, screen)
  const sel: Selection = {
    collection,
    db: wanted.db ?? 'all',
    subcategory: wanted.subcategory ?? null,
    style: wanted.style ?? null,
    difficulty: wanted.difficulty ?? null,
    generator: wanted.generator ?? 'any',
    questionId: null,
    meaning: wanted.meaning ?? 0,
    system: wanted.system ?? fallback.system,
    mode: wanted.mode ?? fallback.mode,
  }

  if (!fill) {
    // the database of the default question, so that the candidates on show are those of one database
    const start = wanted.db === undefined ? index(d).find((r) => r.id === d.demo_defaults?.[screen] && r.collection === collection) : undefined
    if (start) sel.db = start.db_id
    Object.assign(sel, keepFitting(d, sel, screen, PARTS))
    const ready = sel.subcategory !== null && sel.style !== null && sel.difficulty !== null
    sel.questionId = ready && wanted.questionId && rowsFor(d, sel, screen).some((r) => r.id === wanted.questionId) ? wanted.questionId : null
    return sel
  }

  // the question: the wanted one, the default of the screen, the first; a screen of dialogues may leave style and difficulty
  const pick = (rows: QuestionIndexRow[]) => rows.find((r) => r.id === wanted.questionId) ?? rows.find((r) => r.id === d.demo_defaults?.[screen]) ?? rows[0]
  let row = pick(rowsFor(d, sel, screen))
  if (!row && screen !== 'generate') row = pick(rowsFor(d, { ...sel, style: null, difficulty: null }, screen))
  if (!row && wanted.db === undefined && wanted.subcategory === undefined) row = pick(rowsFor(d, { ...sel, db: 'all', subcategory: null, style: null, difficulty: null }, screen))
  if (!row) return sel
  const entry = row.benchmarked?.find((b) => b.system === sel.system) ?? row.benchmarked?.[0]
  return {
    ...sel,
    db: wanted.db ?? row.db_id,
    subcategory: row.subcategory,
    style: row.style,
    difficulty: row.requested_difficulty,
    questionId: row.id,
    meaning: sel.meaning < row.meanings ? sel.meaning : 0,
    ...(screen !== 'generate' && entry ? { system: entry.system, mode: sel.mode && entry.results[sel.mode] ? sel.mode : (Object.keys(entry.results)[0] ?? null) } : {}),
  }
}

/** A choice made in the sentence: the parts it does not fit with are cleared (see withField), then the screen resolves the rest. */
export function choose(d: DemoData, sel: Selection, field: Field | 'questionId' | 'meaning', value: string, screen: Screen, fill: boolean): Selection {
  if (field === 'questionId') return resolveSelection(d, { ...sel, questionId: value }, screen, fill)
  if (field === 'meaning') return { ...sel, meaning: Number(value) }
  if (field === 'generator' || field === 'system' || field === 'mode') return resolveSelection(d, { ...sel, [field]: value }, screen, fill)
  const next = withField(d, sel, field, value, screen)
  const partial: Partial<Selection> = { ...next, questionId: undefined }
  for (const k of ['subcategory', 'style', 'difficulty'] as const) if (next[k] === null) delete partial[k]
  if (field === 'collection') delete partial.db
  return resolveSelection(d, partial, screen, fill)
}

/** The next part of the sentence that is not chosen yet, in presentation. */
export function nextUnset(sel: Selection): (typeof UNSET_ORDER)[number] | null {
  return UNSET_ORDER.find((k) => sel[k] === null) ?? null
}

/** Chooses the next unchosen part: the value of the default question where it still fits, else the first value with questions. */
export function fillNext(d: DemoData, sel: Selection, screen: Screen): Selection {
  const field = nextUnset(sel)
  if (field === null) return sel
  const rows = rowsFor(d, sel, screen)
  const row = rows.find((r) => r.id === d.demo_defaults?.[screen]) ?? rows[0]
  if (!row) return sel
  if (field === 'questionId') return { ...sel, questionId: row.id, meaning: 0 }
  return { ...sel, [field]: field === 'difficulty' ? row.requested_difficulty : row[field] }
}

/** The outcome of each interpretation of a question with a system in a mode; null where there is no dialogue. */
export function outcomes(row: QuestionIndexRow, system: string | null, mode: string | null): (boolean | null)[] {
  const entry = row.benchmarked?.find((b) => system === null || b.system === system)
  const values = entry && (mode === null ? Object.values(entry.results)[0] : entry.results[mode])
  return values ?? Array.from({ length: row.meanings }, () => null)
}

/** The detail files a selection needs: one per database that has questions (or dialogues) of the chosen subcategory. */
export function detailUrls(d: DemoData, sel: Selection, kind: 'questions' | 'dialogues'): string[] {
  if (sel.subcategory === null) return []
  const has = (r: QuestionIndexRow) => (kind === 'questions' ? r.run !== 'legacy' : !!r.benchmarked?.length)
  const dbs = new Set(index(d).filter((r) => r.collection === sel.collection && r.subcategory === sel.subcategory && (sel.db === 'all' || r.db_id === sel.db) && has(r)).map((r) => r.db_id))
  return [...dbs].sort().map((db) => `data/${kind}/${sel.collection}/${db}/${sel.subcategory}.json`)
}
