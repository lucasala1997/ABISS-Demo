import { TriangleAlert } from 'lucide-react'
import type { Issue } from '../data/schema'

export function DataErrorScreen({ url, issues }: { url: string; issues: Issue[] }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-5 p-8" data-shot="data-error">
      <div className="flex items-center gap-3 text-fail">
        <TriangleAlert className="size-7" aria-hidden />
        <h1 className="text-2xl font-semibold">Demo data failed validation</h1>
      </div>
      <p className="text-ink-2">
        The UI reads everything from <code className="font-mono text-ink">{url}</code>. Fix the fields below and reload.
      </p>
      <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {issues.slice(0, 50).map((i, k) => (
          <li key={k} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 px-4 py-2.5">
            <code className="font-mono text-[0.85rem] font-semibold break-all text-ink">{i.path}</code>
            <span className="text-[0.9rem] text-ink-2">{i.message}</span>
          </li>
        ))}
      </ol>
      {issues.length > 50 && <p className="text-ink-3">…and {issues.length - 50} more.</p>}
    </main>
  )
}
