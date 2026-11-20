import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useApp } from './state/app'
import { resolveFlags } from './state/flags'

const flags = resolveFlags({ search: location.search, env: import.meta.env })
useApp.getState().init(flags)

createRoot(document.getElementById('root')!).render(<App dataUrl={flags.dataUrl} />)
