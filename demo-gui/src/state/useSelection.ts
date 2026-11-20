import { useMemo } from 'react'
import { useData } from '../data/context'
import { choose, fillNext, nextUnset, resolveSelection, rowsFor, type Field, type Screen } from '../data/questions'
import { useApp } from './app'

/** The choices of the sentence for one screen: resolved from the shared selection, with the setters the sentence uses. */
export function useSelection(screen: Screen) {
  const d = useData()
  const present = useApp((s) => s.present)
  const stored = useApp((s) => s.selection)
  const store = useApp((s) => s.setSelection)
  const sel = useMemo(() => resolveSelection(d, stored, screen, !present), [d, stored, screen, present])
  const rows = useMemo(() => rowsFor(d, sel, screen), [d, sel, screen])
  return {
    sel,
    /** the questions of the index that match the selection */
    rows,
    set: (field: Field | 'questionId' | 'meaning', value: string) => store(choose(d, sel, field, value, screen, !present)),
    /** the part of the sentence still to choose, in presentation */
    pending: nextUnset(sel),
    /** chooses it with its default value; false when nothing was left to choose */
    fillNext: () => {
      if (nextUnset(sel) === null) return false
      store(fillNext(d, sel, screen))
      return true
    },
  }
}
