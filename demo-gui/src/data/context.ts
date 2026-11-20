import { createContext, useContext } from 'react'
import type { DemoData } from './schema'

export const DataContext = createContext<DemoData | null>(null)

export function useData(): DemoData {
  const d = useContext(DataContext)
  if (!d) throw new Error('useData outside DataContext')
  return d
}
