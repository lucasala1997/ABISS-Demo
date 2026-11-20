/* Which keys the demo handles. P toggles presentation; in presentation the arrows step and the digits open the screens. */

export const SCREEN_KEYS: Record<string, string> = { '0': '/', '1': '/generate', '2': '/benchmark', '3': '/modes', '4': '/results' }

export type KeyAction = 'present' | 'forward' | 'back' | { go: string } | null

interface KeyLike {
  key: string
  altKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  target: EventTarget | null
}

interface TargetLike {
  tagName?: string
  isContentEditable?: boolean
  closest?: (selector: string) => unknown
}

/** The visitor is typing, or an open menu, list or dialog uses the keys itself. */
function busy(target: EventTarget | null): boolean {
  const t = target as TargetLike | null
  if (!t) return false
  if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName ?? '')) return true
  return !!t.closest?.('[role="listbox"], [role="menu"], [role="dialog"]')
}

export function keyAction(e: KeyLike, present: boolean): KeyAction {
  if (e.altKey || e.metaKey || e.ctrlKey || busy(e.target)) return null
  if (e.key === 'p' || e.key === 'P') return 'present'
  if (!present) return null
  if (e.key === 'ArrowRight') return 'forward'
  if (e.key === 'ArrowLeft') return 'back'
  return SCREEN_KEYS[e.key] ? { go: SCREEN_KEYS[e.key] } : null
}
