import { describe, expect, it } from 'vitest'
import { keyAction } from './keys'

const key = (k: string, target: unknown = null, mods: Partial<{ altKey: boolean; metaKey: boolean; ctrlKey: boolean }> = {}) => ({ key: k, altKey: false, metaKey: false, ctrlKey: false, ...mods, target: target as EventTarget | null })
const inside = (role: string) => ({ tagName: 'DIV', closest: (sel: string) => (sel.includes(`[role="${role}"]`) ? {} : null) })
const plain = { tagName: 'DIV', closest: () => null }

describe('keyAction', () => {
  it('in presentation the arrows step forward and back', () => {
    expect(keyAction(key('ArrowRight', plain), true)).toBe('forward')
    expect(keyAction(key('ArrowLeft', plain), true)).toBe('back')
  })

  it('outside presentation the arrows are left to the page', () => {
    expect(keyAction(key('ArrowRight', plain), false)).toBeNull()
  })

  it('P toggles presentation in both states', () => {
    expect(keyAction(key('p', plain), false)).toBe('present')
    expect(keyAction(key('P', plain), true)).toBe('present')
  })

  it('in presentation the digits open the screens', () => {
    expect(keyAction(key('0', plain), true)).toEqual({ go: '/' })
    expect(keyAction(key('2', plain), true)).toEqual({ go: '/benchmark' })
    expect(keyAction(key('4', plain), true)).toEqual({ go: '/results' })
    expect(keyAction(key('2', plain), false)).toBeNull()
    expect(keyAction(key('7', plain), true)).toBeNull()
  })

  it('leaves the keys to an open menu, a list or a dialog', () => {
    expect(keyAction(key('ArrowRight', inside('listbox')), true)).toBeNull()
    expect(keyAction(key('ArrowRight', inside('menu')), true)).toBeNull()
    expect(keyAction(key('p', inside('dialog')), true)).toBeNull()
  })

  it('leaves the keys to a field the visitor is typing in', () => {
    expect(keyAction(key('ArrowRight', { tagName: 'INPUT', closest: () => null }), true)).toBeNull()
    expect(keyAction(key('p', { tagName: 'TEXTAREA', closest: () => null }), false)).toBeNull()
    expect(keyAction(key('p', { tagName: 'DIV', isContentEditable: true, closest: () => null }), false)).toBeNull()
  })

  it('leaves the shortcuts of the browser alone', () => {
    expect(keyAction(key('p', plain, { metaKey: true }), false)).toBeNull()
    expect(keyAction(key('ArrowRight', plain, { altKey: true }), true)).toBeNull()
  })

  it('works when the key has no target', () => {
    expect(keyAction(key('ArrowRight'), true)).toBe('forward')
  })
})
