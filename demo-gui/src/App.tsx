import * as Tooltip from '@radix-ui/react-tooltip'
import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { Redirect, Route, Router, Switch } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { DataErrorScreen } from './components/DataErrorScreen'
import { Shell } from './components/Shell'
import { DataContext } from './data/context'
import { loadDemoData } from './data/load'
import type { ParseResult } from './data/schema'
import { Benchmarking } from './screens/Benchmarking'
import { FourModes } from './screens/FourModes'
import { GenerateValidate } from './screens/GenerateValidate'
import { Overview } from './screens/Overview'
import { PaperResults } from './screens/PaperResults'
import { useApp } from './state/app'
import { useKeyboard } from './state/keyboard'

function Routes() {
  useKeyboard()
  const resetKey = useApp((s) => s.resetKey)
  const present = useApp((s) => s.present)
  // a screen starts from scratch when the demo is reset and when presentation mode changes
  return (
    <Switch key={`${resetKey}-${present}`}>
      <Route path="/" component={Overview} />
      <Route path="/generate" component={GenerateValidate} />
      <Route path="/benchmark" component={Benchmarking} />
      <Route path="/modes" component={FourModes} />
      <Route path="/results" component={PaperResults} />
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  )
}

export default function App({ dataUrl }: { dataUrl: string }) {
  const [result, setResult] = useState<ParseResult | null>(null)
  const present = useApp((s) => s.present)
  const paper = useApp((s) => s.paper)

  useEffect(() => {
    loadDemoData(dataUrl).then(setResult)
  }, [dataUrl])

  useEffect(() => {
    document.documentElement.dataset.present = String(present)
    document.documentElement.dataset.paper = String(paper)
  }, [present, paper])

  if (!result) return <div className="p-8 text-ink-3" role="status">Loading demo data…</div>
  if (!result.ok) return <DataErrorScreen url={dataUrl} issues={result.issues} />

  return (
    <DataContext.Provider value={result.data}>
      <MotionConfig reducedMotion="user">
        <Tooltip.Provider>
          <Router hook={useHashLocation}>
            <Shell>
              <Routes />
            </Shell>
          </Router>
        </Tooltip.Provider>
      </MotionConfig>
    </DataContext.Provider>
  )
}
