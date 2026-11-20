import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { keyAction } from '../present/keys'
import { STEP_EVENT } from '../replay/useReplay'
import { useApp } from './app'

/** P toggles presentation; in presentation: ←/→ steps, 0–4 screens (see present/keys.ts). */
export function useKeyboard() {
  const [, navigate] = useLocation()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const app = useApp.getState()
      const action = keyAction(e, app.present)
      if (action === null) return
      if (action === 'present') app.togglePresent()
      else if (action === 'forward' || action === 'back') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent(STEP_EVENT, { detail: action === 'forward' ? 1 : -1 }))
      } else navigate(action.go)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}
