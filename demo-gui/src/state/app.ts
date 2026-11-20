import { create } from 'zustand'
import type { Selection } from '../data/questions'
import type { Speed } from '../replay/engine'
import type { Flags } from './flags'

export interface AppState {
  dev: boolean
  present: boolean
  paper: boolean
  speed: Speed
  /** bumped by "Reset demo": screens are keyed on it and remount from scratch */
  resetKey: number
  /** the choices of the sentence, shared by the three screens; each screen resolves what is missing */
  selection: Partial<Selection>
  /** the database shown in the side sheet, null when it is closed */
  dbSheet: string | null
  init(f: Flags): void
  togglePresent(): void
  setSpeed(s: Speed): void
  setSelection(next: Partial<Selection>): void
  openDb(id: string): void
  closeDb(): void
  resetDemo(): void
}

/** In presentation the sentence is built by hand: these parts start unchosen. */
const unchosen = (s: Partial<Selection>): Partial<Selection> => ({ ...s, subcategory: undefined, style: undefined, difficulty: undefined, questionId: undefined })

export const useApp = create<AppState>((set, get) => ({
  dev: false,
  present: false,
  paper: false,
  speed: 1,
  resetKey: 0,
  selection: {},
  dbSheet: null,
  init: (f) => set({ dev: f.dev, present: f.present, paper: f.paper, speed: f.speed }),
  togglePresent: () => {
    const present = !get().present
    set({ present, selection: present ? unchosen(get().selection) : get().selection })
  },
  setSpeed: (speed) => set({ speed }),
  setSelection: (selection) => set({ selection }),
  openDb: (dbSheet) => set({ dbSheet }),
  closeDb: () => set({ dbSheet: null }),
  resetDemo: () => set((s) => ({ resetKey: s.resetKey + 1, selection: {}, dbSheet: null })),
}))
